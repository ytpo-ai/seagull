import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Logger,
} from '@nestjs/common';
import { GatewayUserContext } from '@libs/contracts';
import { decodeUserContext, verifyEncodedContext } from '@libs/auth';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateApiKeyDto,
  AssignAgentDto,
} from './dto/project.dto';

const INTERNAL_CONTEXT_SECRET = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';

@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * 从网关头中可选提取用户上下文（不强制，兼容内部调用）
   * 提取失败时返回 null，业务层按 "内部调用" 处理
   */
  private tryGetUserContext(req: any): GatewayUserContext | null {
    const encoded = req.headers['x-user-context'] as string | undefined;
    const signature = req.headers['x-user-signature'] as string | undefined;

    if (!encoded || !signature) {
      return null;
    }

    if (!verifyEncodedContext(encoded, signature, INTERNAL_CONTEXT_SECRET)) {
      this.logger.debug('User context signature verification failed, treating as internal call');
      return null;
    }

    const userContext = decodeUserContext(encoded);
    if (!userContext.employeeId) {
      return null;
    }

    return userContext;
  }

  // ==================== Project CRUD ====================

  @Post()
  async createProject(@Body() dto: CreateProjectDto, @Req() req: any) {
    return this.projectsService.createProject(dto);
  }

  @Get()
  async getAllProjects(@Req() req: any) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.getAllProjects(userContext);
  }

  @Get(':id')
  async getProject(@Param('id') id: string, @Req() req: any) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.getProject(id, userContext);
  }

  @Put(':id')
  async updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: any,
  ) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.updateProject(id, dto, userContext);
  }

  @Delete(':id')
  async deleteProject(@Param('id') id: string, @Req() req: any) {
    const userContext = this.tryGetUserContext(req);
    await this.projectsService.deleteProject(id, userContext);
    return { message: '项目已删除' };
  }

  // ==================== Agent 分配 ====================

  @Get(':id/agents')
  async getProjectAgents(@Param('id') projectId: string, @Req() req: any) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.getProjectAgents(projectId, userContext);
  }

  @Post(':id/agents')
  async assignAgent(
    @Param('id') projectId: string,
    @Body() dto: AssignAgentDto,
    @Req() req: any,
  ) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.assignAgent(projectId, dto, userContext);
  }

  @Delete(':id/agents/:agentId')
  async removeAgent(
    @Param('id') projectId: string,
    @Param('agentId') agentId: string,
    @Req() req: any,
  ) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.removeAgent(projectId, agentId, userContext);
  }

  // ==================== API Key 管理 ====================

  @Post(':id/api-keys')
  async createApiKey(
    @Param('id') projectId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: any,
  ) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.createApiKey(projectId, dto, userContext);
  }

  @Get(':id/api-keys')
  async getApiKeys(@Param('id') projectId: string, @Req() req: any) {
    const userContext = this.tryGetUserContext(req);
    return this.projectsService.getApiKeys(projectId, userContext);
  }

  @Delete(':id/api-keys/:keyId')
  async revokeApiKey(
    @Param('id') projectId: string,
    @Param('keyId') keyId: string,
    @Req() req: any,
  ) {
    const userContext = this.tryGetUserContext(req);
    await this.projectsService.revokeApiKey(projectId, keyId, userContext);
    return { message: 'API Key 已撤销' };
  }
}