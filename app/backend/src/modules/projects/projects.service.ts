import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Project, ProjectDocument } from '../../shared/schemas/project.schema';
import {
  ProjectApiKey,
  ProjectApiKeyDocument,
} from '../../shared/schemas/project-api-key.schema';
import { Employee, EmployeeDocument } from '../../shared/schemas/employee.schema';
import { CreateProjectDto, UpdateProjectDto, CreateApiKeyDto, AssignAgentDto } from './dto/project.dto';
import { getTierByEmployeeRole } from '../../shared/role-tier';
import { GatewayUserContext } from '@libs/contracts';
import { AgentClientService } from '../agents-client/agent-client.service';
import type { Agent } from '../../shared/types';

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  localDirectory?: string;
  externalLink?: string;
  adminIds: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectApiKeyResponse {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  agentIds: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectApiKey.name) private projectApiKeyModel: Model<ProjectApiKeyDocument>,
    @InjectModel(Employee.name) private employeeModel: Model<EmployeeDocument>,
    private readonly agentClientService: AgentClientService,
  ) {}

  // ==================== 权限辅助 ====================

  /** 判断当前用户是否为系统管理员（leadership tier）；null 视为内部调用 */
  private async isSystemAdmin(userContext: GatewayUserContext | null): Promise<boolean> {
    if (!userContext) return true;
    const employee = await this.employeeModel.findOne({ id: userContext.employeeId }).exec();
    if (!employee) return false;
    return getTierByEmployeeRole(employee.role) === 'leadership';
  }

  /** 获取当前用户有权限访问的项目 ID 列表；null 视为全部 */
  private async getAccessibleProjectIds(userContext: GatewayUserContext | null): Promise<string[]> {
    if (!userContext) {
      const projects = await this.projectModel.find().select({ _id: 1 }).exec();
      return projects.map((p) => p._id.toString());
    }

    const employee = await this.employeeModel.findOne({ id: userContext.employeeId }).exec();
    if (!employee) return [];

    if (getTierByEmployeeRole(employee.role) === 'leadership') {
      const projects = await this.projectModel.find().select({ _id: 1 }).exec();
      return projects.map((p) => p._id.toString());
    }

    const projects = await this.projectModel
      .find({ adminIds: userContext.employeeId })
      .select({ _id: 1 })
      .exec();
    return projects.map((p) => p._id.toString());
  }

  /** 校验用户是否有指定项目的访问权限；null 视为内部调用跳过 */
  private async assertProjectAccess(projectId: string, userContext: GatewayUserContext | null): Promise<void> {
    if (!userContext) return;

    if (await this.isSystemAdmin(userContext)) return;

    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    if (!project.adminIds.includes(userContext.employeeId)) {
      throw new ForbiddenException('无权限访问该项目');
    }
  }

  // ==================== Project CRUD ====================

  async createProject(dto: CreateProjectDto): Promise<ProjectResponse> {
    const existing = await this.projectModel.findOne({ name: dto.name }).exec();
    if (existing) {
      throw new ConflictException(`项目 "${dto.name}" 已存在`);
    }

    const project = new this.projectModel({
      name: dto.name,
      description: dto.description,
      localDirectory: dto.localDirectory,
      externalLink: dto.externalLink,
      adminIds: dto.adminIds || [],
      isActive: true,
    });

    const saved = await project.save();
    this.logger.log(`Created project: ${saved._id} - ${saved.name}`);
    return this.toProjectResponse(saved);
  }

  async getAllProjects(userContext: GatewayUserContext | null): Promise<ProjectResponse[]> {
    const accessibleIds = await this.getAccessibleProjectIds(userContext);
    const projects = await this.projectModel
      .find({ _id: { $in: accessibleIds } })
      .sort({ createdAt: -1 })
      .exec();
    return projects.map((p) => this.toProjectResponse(p));
  }

  async getProject(projectId: string, userContext: GatewayUserContext | null): Promise<ProjectResponse> {
    await this.assertProjectAccess(projectId, userContext);
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    return this.toProjectResponse(project);
  }

  async updateProject(
    projectId: string,
    dto: UpdateProjectDto,
    userContext: GatewayUserContext | null,
  ): Promise<ProjectResponse> {
    await this.assertProjectAccess(projectId, userContext);

    if (dto.name) {
      const existing = await this.projectModel.findOne({
        name: dto.name,
        _id: { $ne: projectId },
      }).exec();
      if (existing) {
        throw new ConflictException(`项目 "${dto.name}" 已存在`);
      }
    }

    const updated = await this.projectModel.findByIdAndUpdate(
      projectId,
      { ...dto, updatedAt: new Date() },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundException('项目不存在');
    }

    this.logger.log(`Updated project: ${updated._id}`);
    return this.toProjectResponse(updated);
  }

  async deleteProject(projectId: string, userContext: GatewayUserContext | null): Promise<void> {
    const isSysAdmin = await this.isSystemAdmin(userContext);
    if (!isSysAdmin) {
      throw new ForbiddenException('只有系统管理员可以删除项目');
    }

    const result = await this.projectModel.findByIdAndDelete(projectId).exec();
    if (!result) {
      throw new NotFoundException('项目不存在');
    }

    await this.projectApiKeyModel.deleteMany({ projectId }).exec();
    this.logger.log(`Deleted project: ${projectId}`);
  }

  // ==================== Agent 分配 ====================

  async assignAgent(
    projectId: string,
    dto: AssignAgentDto,
    userContext: GatewayUserContext | null,
  ): Promise<{ project: ProjectResponse; agent: any }> {
    await this.assertProjectAccess(projectId, userContext);

    if (!dto.agentId) {
      throw new BadRequestException('agentId 不能为空');
    }

    const agent = await this.agentClientService.getAgent(dto.agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${dto.agentId} 不存在`);
    }

    const updatedAgent = await this.agentClientService.updateAgent(dto.agentId, { projectId } as any);

    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    this.logger.log(`Agent ${dto.agentId} assigned to project ${projectId}`);
    return {
      project: this.toProjectResponse(project),
      agent: updatedAgent,
    };
  }

  async removeAgent(
    projectId: string,
    agentId: string,
    userContext: GatewayUserContext | null,
  ): Promise<{ project: ProjectResponse; agent: any }> {
    await this.assertProjectAccess(projectId, userContext);

    const agent = await this.agentClientService.getAgent(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} 不存在`);
    }
    if (agent.projectId !== projectId) {
      throw new BadRequestException(`Agent ${agentId} 不属于项目 ${projectId}`);
    }

    const updatedAgent = await this.agentClientService.updateAgent(agentId, { projectId: null } as any);

    const project = await this.projectModel.findById(projectId).exec();
    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    this.logger.log(`Agent ${agentId} removed from project ${projectId}`);
    return {
      project: this.toProjectResponse(project),
      agent: updatedAgent,
    };
  }

  async getProjectAgents(projectId: string, userContext: GatewayUserContext | null): Promise<Agent[]> {
    await this.assertProjectAccess(projectId, userContext);
    return this.agentClientService.getAllAgents({ projectId });
  }

  // ==================== API Key 管理 ====================

  private generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
    const rawKey = `sk-proj-${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 16) + '...';
    return { rawKey, keyHash, keyPrefix };
  }

  async createApiKey(
    projectId: string,
    dto: CreateApiKeyDto,
    userContext: GatewayUserContext | null,
  ): Promise<{ apiKey: ProjectApiKeyResponse; rawKey: string }> {
    await this.assertProjectAccess(projectId, userContext);

    const existing = await this.projectApiKeyModel.findOne({
      projectId,
      name: dto.name,
    }).exec();
    if (existing) {
      throw new ConflictException(`API Key "${dto.name}" 在该项目中已存在`);
    }

    const { rawKey, keyHash, keyPrefix } = this.generateApiKey();

    const apiKey = new this.projectApiKeyModel({
      projectId,
      name: dto.name,
      keyHash,
      keyPrefix,
      agentIds: dto.agentIds || [],
      isActive: true,
    });

    const saved = await apiKey.save();
    this.logger.log(`Created API Key for project ${projectId}: ${saved._id}`);

    return {
      apiKey: this.toApiKeyResponse(saved),
      rawKey,
    };
  }

  async getApiKeys(projectId: string, userContext: GatewayUserContext | null): Promise<ProjectApiKeyResponse[]> {
    await this.assertProjectAccess(projectId, userContext);
    const keys = await this.projectApiKeyModel
      .find({ projectId })
      .sort({ createdAt: -1 })
      .exec();
    return keys.map((k) => this.toApiKeyResponse(k));
  }

  async revokeApiKey(
    projectId: string,
    keyId: string,
    userContext: GatewayUserContext | null,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, userContext);

    const key = await this.projectApiKeyModel.findOneAndUpdate(
      { _id: keyId, projectId },
      { isActive: false, updatedAt: new Date() },
      { new: true },
    ).exec();

    if (!key) {
      throw new NotFoundException('API Key 不存在');
    }

    this.logger.log(`Revoked API Key ${keyId} in project ${projectId}`);
  }

  async verifyApiKey(rawKey: string): Promise<{ projectId: string; agentIds: string[] } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await this.projectApiKeyModel.findOne({
      keyHash,
      isActive: true,
    }).exec();

    if (!key) return null;

    await this.projectApiKeyModel.updateOne(
      { _id: key._id },
      { lastUsedAt: new Date() },
    ).exec();

    return {
      projectId: key.projectId,
      agentIds: key.agentIds,
    };
  }

  // ==================== 响应格式化 ====================

  private toProjectResponse(project: ProjectDocument): ProjectResponse {
    return {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      localDirectory: project.localDirectory,
      externalLink: project.externalLink,
      adminIds: project.adminIds || [],
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private toApiKeyResponse(apiKey: ProjectApiKeyDocument): ProjectApiKeyResponse {
    return {
      id: apiKey._id.toString(),
      projectId: apiKey.projectId,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      agentIds: apiKey.agentIds || [],
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }
}