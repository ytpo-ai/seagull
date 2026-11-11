import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { decodeUserContext, verifyEncodedContext } from '@libs/auth';

@Injectable()
export class InternalContextMiddleware implements NestMiddleware {
  private readonly contextSecret = String(process.env.INTERNAL_CONTEXT_SECRET || '').trim();

  constructor() {
    if (!this.contextSecret) {
      throw new Error('INTERNAL_CONTEXT_SECRET is required');
    }
  }

  use(req: any, _res: any, next: () => void): void {
    const path = req.originalUrl?.split('?')[0] || req.url;
    if (path === '/api/health') {
      next();
      return;
    }

    const authMode = String(process.env.TOOLS_AUTH_MODE || 'legacy').trim().toLowerCase();
    if (path === '/api/tools/auth/agent-token' && (authMode === 'hybrid' || authMode === 'jwt-strict')) {
      next();
      return;
    }
    const authHeader = req.headers.authorization as string | undefined;
    const hasBearer = Boolean(authHeader?.startsWith('Bearer '));
    if (hasBearer && (path === '/api/tools/auth/agent-token' || path.startsWith('/api/tools/'))) {
      if (authMode === 'hybrid' || authMode === 'jwt-strict') {
        next();
        return;
      }
    }

    const encodedContext = req.headers['x-user-context'] as string | undefined;
    const signature = req.headers['x-user-signature'] as string | undefined;

    if (!encodedContext || !signature) {
      throw new UnauthorizedException('Missing internal user context');
    }

    const valid = verifyEncodedContext(encodedContext, signature, this.contextSecret);
    if (!valid) {
      throw new UnauthorizedException('Invalid internal user context signature');
    }

    req.userContext = decodeUserContext(encodedContext);

    // 解码 Gateway 转发的 Project API Key 上下文
    const projectApiKeyHeader = req.headers['x-project-api-key-context'] as string | undefined;
    if (projectApiKeyHeader) {
      try {
        const decoded = Buffer.from(projectApiKeyHeader, 'base64url').toString('utf8');
        req.projectApiKeyContext = JSON.parse(decoded);
      } catch {
        // 解析失败不阻塞请求，降级处理
      }
    }

    next();
  }
}
