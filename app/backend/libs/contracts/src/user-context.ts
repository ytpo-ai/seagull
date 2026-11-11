export interface GatewayUserContext {
  employeeId: string;
  email?: string;
  role?: string;
  issuedAt: number;
  expiresAt: number;
  /** 认证模式：'jwt' | 'project-api-key' | 'internal-signature' */
  authMode?: string;
}

/** Project API Key 认证附加上下文 */
export interface ProjectApiKeyContext {
  authMode: 'project-api-key';
  projectId: string;
  /** 此 Key 可访问的 Agent ID 列表；为空表示可访问项目下所有 Agent */
  allowedAgentIds: string[];
  keyId: string;
  keyName: string;
}

export interface StreamChunkEvent {
  sessionId: string;
  type: 'start' | 'chunk' | 'done' | 'error';
  payload?: string;
  timestamp: number;
}
