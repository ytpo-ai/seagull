import api from '../lib/axios';
import type {
  Project,
  ProjectApiKey,
  CreateProjectDto,
  UpdateProjectDto,
  CreateApiKeyDto,
  CreateApiKeyResponse,
} from '../types';
import type { Agent } from '../types';

const projectService = {
  // ==================== Project CRUD ====================

  async createProject(dto: CreateProjectDto): Promise<Project> {
    const res = await api.post('/projects', dto);
    return res.data;
  },

  async getProjects(): Promise<Project[]> {
    const res = await api.get('/projects');
    return res.data;
  },

  async getProject(id: string): Promise<Project> {
    const res = await api.get(`/projects/${id}`);
    return res.data;
  },

  async updateProject(id: string, dto: UpdateProjectDto): Promise<Project> {
    const res = await api.put(`/projects/${id}`, dto);
    return res.data;
  },

  async deleteProject(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  // ==================== Agent 分配 ====================

  async getProjectAgents(projectId: string): Promise<Agent[]> {
    const res = await api.get(`/projects/${projectId}/agents`);
    return res.data;
  },

  async assignAgent(projectId: string, agentId: string): Promise<{ project: Project; agent: Agent }> {
    const res = await api.post(`/projects/${projectId}/agents`, { agentId });
    return res.data;
  },

  async removeAgent(projectId: string, agentId: string): Promise<{ project: Project; agent: Agent }> {
    const res = await api.delete(`/projects/${projectId}/agents/${agentId}`);
    return res.data;
  },

  // ==================== API Key 管理 ====================

  async createApiKey(projectId: string, dto: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const res = await api.post(`/projects/${projectId}/api-keys`, dto);
    return res.data;
  },

  async getApiKeys(projectId: string): Promise<ProjectApiKey[]> {
    const res = await api.get(`/projects/${projectId}/api-keys`);
    return res.data;
  },

  async revokeApiKey(projectId: string, keyId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/api-keys/${keyId}`);
  },
};

export default projectService;