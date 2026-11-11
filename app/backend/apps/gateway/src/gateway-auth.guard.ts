import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { verifyEmployeeToken } from '@libs/auth';
import { GatewayUserContext } from '@libs/contracts';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Employee, EmployeeDocument } from '../../../src/shared/schemas/employee.schema';
import {
  ProjectApiKey,
  ProjectApiKeyDocument,
} from '../../../src/shared/schemas/project-api-key.schema';

type PublicRouteRule = {
  path: string;
  method?: string;
};

type LifeScriptJwtPayload = {
  employeeId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp: number;
};

/** Project API Key 前缀标识 */
const PROJECT_API_KEY_PREFIX = 'sk-proj-';

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/refresh',
  '/api/invitations/validate',
  '/api/invitations/accept',
  '/api/health',
]);

const PUBLIC_ROUTE_RULES: PublicRouteRule[] = [
  { path: '/api/life-script/auth/exchange' },
  { path: '/api/life-script/upload' },
  { path: '/api/life-script/submissions', method: 'POST' },
];

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  private readonly logger = new Logger(GatewayAuthGuard.name);

  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(ProjectApiKey.name)
    private readonly projectApiKeyModel: Model<ProjectApiKeyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path = req.originalUrl?.split('?')[0] || req.url;
    const method = String(req.method || 'GET').toUpperCase();

    if (this.isPublicPath(path, method)) {
      return true;
    }

    // 提取 Bearer token（支持 header 或 query param）
    const token = this.extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    // 模式 1: Project API Key 认证（sk-proj- 前缀）
    if (token.startsWith(PROJECT_API_KEY_PREFIX)) {
      return this.authenticateByProjectApiKey(req, token);
    }

    // 模式 2: LifeScript JWT 认证
    if (path.startsWith('/api/life-script')) {
      return this.authenticateLifeScriptToken(req, token);
    }

    // 模式 3: 员工 JWT 认证
    return this.authenticateByEmployeeJwt(req, token);
  }

  // ==================== Project API Key 认证 ====================

  private async authenticateByProjectApiKey(
    req: any,
    rawKey: string,
  ): Promise<boolean> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.projectApiKeyModel
      .findOne({ keyHash, isActive: true })
      .exec();

    if (!apiKey) {
      this.logger.warn(`Project API Key auth failed: invalid or inactive key`);
      throw new UnauthorizedException('Invalid Project API Key');
    }

    // 更新最后使用时间（异步，不阻塞认证）
    this.projectApiKeyModel
      .updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() })
      .exec()
      .catch((err) =>
        this.logger.warn(`Failed to update API Key usage time: ${err.message}`),
      );

    const userContext: GatewayUserContext = {
      employeeId: `proj-key:${apiKey._id}`,
      role: 'project-api-key',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000, // 1 小时有效
    };

    // 附加项目 Key 上下文到 request，供 Proxy 和下游服务使用
    (req as any).projectApiKeyContext = {
      authMode: 'project-api-key',
      projectId: apiKey.projectId,
      allowedAgentIds: apiKey.agentIds || [],
      keyId: apiKey._id.toString(),
      keyName: apiKey.name,
    };

    req.userContext = userContext;

    this.logger.log(
      `Project API Key authenticated: key=${apiKey.name} project=${apiKey.projectId} agentIds=${apiKey.agentIds?.length || 'all'}`,
    );
    return true;
  }

  // ==================== 员工 JWT 认证 ====================

  private async authenticateByEmployeeJwt(req: any, token: string): Promise<boolean> {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const payload = verifyEmployeeToken(token, secret);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const employee = await this.employeeModel
      .findOne({ id: payload.employeeId })
      .select({ role: 1 })
      .lean()
      .exec();

    const userContext: GatewayUserContext = {
      employeeId: payload.employeeId,
      email: payload.email,
      role: String(employee?.role || ''),
      issuedAt: Date.now(),
      expiresAt: payload.exp,
    };

    req.userContext = userContext;
    return true;
  }

  // ==================== 辅助方法 ====================

  private isPublicPath(path: string, method: string): boolean {
    if (PUBLIC_PATHS.has(path)) {
      return true;
    }

    return PUBLIC_ROUTE_RULES.some((rule) => {
      if (rule.path !== path) {
        return false;
      }
      if (!rule.method) {
        return true;
      }
      return rule.method === method;
    });
  }

  private extractBearerToken(req: any): string {
    const authHeader = req.headers.authorization as string | undefined;
    const queryToken = String(req.query?.access_token || '').trim();

    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return queryToken;
  }

  private authenticateLifeScriptToken(req: any, token: string): boolean {
    const secret = process.env.LS_JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('LS_JWT_SECRET not configured');
    }

    const payload = verifyEmployeeToken(token, secret) as LifeScriptJwtPayload | null;
    if (!payload?.employeeId) {
      throw new UnauthorizedException('Invalid or expired LifeScript token');
    }

    const userContext: GatewayUserContext = {
      employeeId: payload.employeeId,
      email: payload.email || '',
      role: String(payload.role || ''),
      issuedAt: payload.iat || Date.now(),
      expiresAt: payload.exp,
    };

    req.userContext = userContext;
    return true;
  }
}