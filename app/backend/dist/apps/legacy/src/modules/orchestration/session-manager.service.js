"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManagerService = void 0;
const common_1 = require("@nestjs/common");
const agent_client_service_1 = require("../agents-client/agent-client.service");
let SessionManagerService = class SessionManagerService {
    constructor(agentClientService) {
        this.agentClientService = agentClientService;
    }
    async createSession(dto) {
        const session = await this.agentClientService.createSession({
            sessionId: dto.id,
            ownerType: dto.ownerType,
            ownerId: dto.ownerId,
            title: dto.title,
            planContext: dto.planContext,
            meetingContext: dto.meetingContext,
            metadata: dto.metadata,
        });
        if (!session) {
            throw new common_1.NotFoundException('Failed to create session');
        }
        return session;
    }
    async getSessionOrThrow(sessionId) {
        const normalized = String(sessionId || '').trim();
        if (!normalized) {
            throw new common_1.NotFoundException('Session not found');
        }
        const session = await this.agentClientService.getSession(normalized);
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    async listSessions(query) {
        return [];
    }
    async appendMessage(sessionId, message) {
        const session = await this.agentClientService.appendSessionMessage(sessionId, {
            role: message.role,
            content: message.content,
            status: 'completed',
            metadata: message.metadata,
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    async appendMessages(sessionId, messages) {
        let result = null;
        for (const message of messages) {
            result = await this.agentClientService.appendSessionMessage(sessionId, {
                role: message.role,
                content: message.content,
                status: 'completed',
                metadata: message.metadata,
            });
        }
        if (!result) {
            throw new common_1.NotFoundException('Session not found');
        }
        return result;
    }
    async archiveSession(sessionId, summary) {
        const session = await this.agentClientService.archiveSession(sessionId, summary);
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    async resumeSession(sessionId) {
        const session = await this.agentClientService.resumeSession(sessionId);
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    async getOrCreateAgentSession(agentId, linkedPlanId, title, linkedTaskId) {
        return this.createSession({
            ownerType: 'agent',
            ownerId: agentId,
            title,
            linkedPlanId,
            linkedTaskId,
            tags: ['orchestration', 'agent-run'],
        });
    }
};
exports.SessionManagerService = SessionManagerService;
exports.SessionManagerService = SessionManagerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agent_client_service_1.AgentClientService])
], SessionManagerService);
//# sourceMappingURL=session-manager.service.js.map