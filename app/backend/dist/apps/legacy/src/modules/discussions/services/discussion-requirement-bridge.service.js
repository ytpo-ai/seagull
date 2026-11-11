"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionRequirementBridgeService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../../../../libs/auth/src/index");
const unwrap_response_envelope_1 = require("../../../shared/common/utils/unwrap-response-envelope");
let DiscussionRequirementBridgeService = class DiscussionRequirementBridgeService {
    constructor() {
        this.baseUrl = process.env.ENGINEERING_INTELLIGENCE_SERVICE_URL || 'http://localhost:3004';
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
        this.timeout = Number(process.env.ENGINEERING_INTELLIGENCE_CLIENT_TIMEOUT_MS || 20000);
    }
    buildSignedHeaders() {
        const now = Date.now();
        const context = {
            employeeId: 'legacy-service',
            role: 'system',
            issuedAt: now,
            expiresAt: now + 60 * 1000,
        };
        const encoded = (0, auth_1.encodeUserContext)(context);
        const signature = (0, auth_1.signEncodedContext)(encoded, this.contextSecret);
        return {
            'x-user-context': encoded,
            'x-user-signature': signature,
            'content-type': 'application/json',
        };
    }
    async createRequirementFromDiscussion(input) {
        const projectId = String(input.projectId || '').trim();
        const payload = {
            title: String(input.title || '').trim(),
            description: String(input.description || '').trim(),
            priority: input.priority || 'medium',
            category: 'feature',
            complexity: 'low',
            createdById: input.createdById ? String(input.createdById).trim() : undefined,
            createdByName: input.createdByName ? String(input.createdByName).trim() : undefined,
            createdByType: 'human',
            projectId: projectId || undefined,
            localProjectId: projectId || undefined,
            discussionSource: {
                spaceId: input.source.spaceId,
                spaceTitle: input.source.spaceTitle,
                threadId: input.source.threadId,
                threadTitle: input.source.threadTitle,
                messageId: input.source.messageId,
                messagePreview: input.source.messagePreview,
            },
        };
        const response = await axios_1.default.post(`${this.baseUrl}/api/ei/requirements`, payload, {
            headers: this.buildSignedHeaders(),
            timeout: this.timeout,
        });
        const result = (0, unwrap_response_envelope_1.unwrapResponseEnvelope)(response.data);
        return {
            requirementId: String(result.requirementId || ''),
            title: String(result.title || payload.title),
        };
    }
};
exports.DiscussionRequirementBridgeService = DiscussionRequirementBridgeService;
exports.DiscussionRequirementBridgeService = DiscussionRequirementBridgeService = __decorate([
    (0, common_1.Injectable)()
], DiscussionRequirementBridgeService);
//# sourceMappingURL=discussion-requirement-bridge.service.js.map