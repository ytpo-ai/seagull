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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RuntimeRunDiagnosisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeRunDiagnosisService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../schemas/agent.schema");
const api_key_service_1 = require("../../../../../src/modules/api-keys/api-key.service");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const agent_run_score_service_1 = require("./agent-run-score.service");
const model_service_1 = require("../models/model.service");
let RuntimeRunDiagnosisService = RuntimeRunDiagnosisService_1 = class RuntimeRunDiagnosisService {
    constructor(persistence, runScoreService, modelService, apiKeyService, agentModel) {
        this.persistence = persistence;
        this.runScoreService = runScoreService;
        this.modelService = modelService;
        this.apiKeyService = apiKeyService;
        this.agentModel = agentModel;
        this.logger = new common_1.Logger(RuntimeRunDiagnosisService_1.name);
    }
    buildRecentContext(messages) {
        const result = [];
        let assistantRounds = 0;
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const item = messages[index];
            result.push(item);
            if (item.role === 'assistant') {
                assistantRounds += 1;
            }
            if (assistantRounds >= 15) {
                break;
            }
        }
        return result.reverse();
    }
    toCompactJson(value) {
        try {
            const raw = JSON.stringify(value);
            if (!raw)
                return '-';
            return raw.length > 1200 ? `${raw.slice(0, 1200)}...(truncated)` : raw;
        }
        catch {
            return '-';
        }
    }
    async buildDiagnosisInput(runId, question) {
        const run = await this.persistence.getRun(runId);
        if (!run) {
            throw new common_1.NotFoundException('Runtime run not found');
        }
        const [messagesWithParts, score, agent, initialSysMessages] = await Promise.all([
            this.persistence.listRunMessagesWithParts(runId),
            this.runScoreService.getScoreByRunId(runId),
            this.agentModel.findOne({ $or: [{ id: run.agentId }, { _id: run.agentId }] }).lean().exec(),
            run.sessionId ? this.persistence.getSessionInitialSystemMessages(run.sessionId) : Promise.resolve(undefined),
        ]);
        if (!agent?.model?.id || !agent?.model?.name || !agent?.model?.provider || !agent?.model?.model) {
            throw new common_1.NotFoundException('Agent model config not found');
        }
        const modelConfig = {
            id: String(agent.model.id),
            name: String(agent.model.name),
            provider: String(agent.model.provider),
            model: String(agent.model.model),
            maxTokens: Number(agent.model.maxTokens || 4096),
            temperature: 0.2,
            topP: Number(agent.model.topP ?? 1),
            reasoning: agent.model.reasoning,
        };
        let resolvedApiKey;
        const apiKeyId = agent.apiKeyId;
        if (apiKeyId) {
            const decrypted = await this.apiKeyService.getDecryptedKey(String(apiKeyId));
            if (decrypted) {
                resolvedApiKey = decrypted;
                this.logger.log(`[diagnose_api_key] runId=${runId} agent=${agent.name} source=custom`);
            }
            else {
                this.logger.warn(`[diagnose_api_key] runId=${runId} agent=${agent.name} customApiKeyNotAvailable fallback=system`);
            }
        }
        this.modelService.ensureProviderWithKey(modelConfig, resolvedApiKey);
        const initialSystemChatMessages = (initialSysMessages || []).map((msg) => ({
            role: 'system',
            content: String(msg.content || ''),
            timestamp: new Date(run.createdAt || Date.now()),
        }));
        const runSystemMessages = messagesWithParts
            .filter((message) => message.role === 'system')
            .map((message) => ({
            role: 'system',
            content: String(message.content || ''),
            timestamp: new Date(message.timestamp || Date.now()),
        }));
        const systemMessages = [...initialSystemChatMessages, ...runSystemMessages];
        const interactionMessages = this.buildRecentContext(messagesWithParts
            .filter((message) => message.role !== 'system')
            .map((message) => {
            const partSummary = (message.parts || [])
                .map((part) => `${part.type}${part.toolId ? `(${part.toolId})` : ''}:${part.error || part.content || this.toCompactJson(part.output || part.input)}`)
                .join('\n');
            const merged = [String(message.content || ''), partSummary].filter(Boolean).join('\n');
            return {
                role: message.role,
                content: merged,
                timestamp: new Date(message.timestamp || Date.now()),
            };
        }));
        const diagnosticSystem = {
            role: 'system',
            content: '你是一个 AI Agent 调试分析师。你会基于完整执行记录进行因果分析，明确指出具体轮次、触发规则、证据片段，并给出可执行改进建议。不要泛泛而谈。',
            timestamp: new Date(),
        };
        const scoreSummary = score
            ? `score=${Math.round(score.score)}/100 totalDeductions=${score.totalDeductions} rounds=${score.stats.totalRounds} toolCalls=${score.stats.totalToolCalls}`
            : 'score=unknown';
        const userPrompt = {
            role: 'user',
            content: [
                `RunId: ${runId}`,
                `TaskTitle: ${run.taskTitle || '-'}`,
                `Status: ${run.status}`,
                `ScoreSummary: ${scoreSummary}`,
                `Deductions: ${this.toCompactJson(score?.deductions || [])}`,
                '--- User Question ---',
                question,
                '--- Requirements ---',
                '1) 明确回答问题。',
                '2) 引用关键证据（轮次/消息/工具调用/扣分规则）。',
                '3) 输出 3-5 条可执行改进建议。',
            ].join('\n'),
            timestamp: new Date(),
        };
        const chatMessages = [
            diagnosticSystem,
            ...systemMessages,
            ...interactionMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
            })),
            userPrompt,
        ];
        return {
            modelConfig,
            chatMessages,
        };
    }
    async diagnose(runId, question) {
        const { modelConfig, chatMessages } = await this.buildDiagnosisInput(runId, question);
        const result = await this.modelService.chat(modelConfig.id, chatMessages, {
            temperature: 0.2,
            maxTokens: 1800,
        });
        return String(result.response || '').trim();
    }
    async diagnoseStream(runId, question, onChunk) {
        const { modelConfig, chatMessages } = await this.buildDiagnosisInput(runId, question);
        let fullText = '';
        await this.modelService.streamingChat(modelConfig.id, chatMessages, (token) => {
            const chunk = String(token || '');
            if (!chunk) {
                return;
            }
            fullText += chunk;
            onChunk(chunk);
        }, {
            temperature: 0.2,
            maxTokens: 1800,
        });
        return fullText.trim();
    }
};
exports.RuntimeRunDiagnosisService = RuntimeRunDiagnosisService;
exports.RuntimeRunDiagnosisService = RuntimeRunDiagnosisService = RuntimeRunDiagnosisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __metadata("design:paramtypes", [runtime_persistence_service_1.RuntimePersistenceService,
        agent_run_score_service_1.AgentRunScoreService,
        model_service_1.ModelService,
        api_key_service_1.ApiKeyService,
        mongoose_2.Model])
], RuntimeRunDiagnosisService);
//# sourceMappingURL=runtime-run-diagnosis.service.js.map