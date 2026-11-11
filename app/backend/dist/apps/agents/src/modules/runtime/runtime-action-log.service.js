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
exports.RuntimeActionLogIngestionService = void 0;
const common_1 = require("@nestjs/common");
const agent_action_log_service_1 = require("../action-logs/agent-action-log.service");
let RuntimeActionLogIngestionService = class RuntimeActionLogIngestionService {
    constructor(agentActionLogService) {
        this.agentActionLogService = agentActionLogService;
        this.maxPayloadChars = Number(process.env.RUNTIME_ACTION_LOG_SYNC_MAX_PAYLOAD_CHARS || 12000);
        this.maxToolOutputChars = Number(process.env.RUNTIME_ACTION_LOG_SYNC_MAX_TOOL_OUTPUT_CHARS || 8000);
        this.previewChars = Number(process.env.RUNTIME_ACTION_LOG_SYNC_PREVIEW_CHARS || 2000);
        this.allowedEventTypes = new Set([
            'run.started',
            'run.step.started',
            'run.completed',
            'run.failed',
            'run.paused',
            'run.resumed',
            'run.cancelled',
            'tool.pending',
            'tool.running',
            'tool.completed',
            'tool.failed',
            'permission.asked',
            'permission.replied',
            'permission.denied',
        ]);
    }
    async syncRuntimeEvent(event) {
        if (!this.allowedEventTypes.has(event.eventType)) {
            return;
        }
        const payload = this.compactPayloadForSync(event);
        await this.agentActionLogService.recordRuntimeHookEvent({
            eventId: event.eventId,
            eventType: event.eventType,
            agentId: event.agentId,
            sessionId: event.sessionId,
            runId: event.runId,
            taskId: event.taskId,
            messageId: event.messageId,
            partId: event.partId,
            toolCallId: event.toolCallId,
            sequence: event.sequence,
            timestamp: event.timestamp,
            traceId: event.traceId,
            payload,
        });
    }
    compactPayloadForSync(event) {
        const rawPayload = event.payload && typeof event.payload === 'object' ? event.payload : {};
        let compactPayload = rawPayload;
        if (event.eventType === 'tool.completed') {
            compactPayload = this.compactToolCompletedPayload(rawPayload);
        }
        const compactPayloadText = this.safeStringify(compactPayload);
        if (compactPayloadText.length <= this.maxPayloadChars) {
            return compactPayload;
        }
        const toolFields = this.extractToolFields(compactPayload);
        return {
            ...toolFields,
            payloadTruncated: true,
            payloadOriginalSize: compactPayloadText.length,
            payloadPreview: compactPayloadText.slice(0, this.previewChars),
        };
    }
    compactToolCompletedPayload(payload) {
        const output = payload.output;
        if (output === undefined) {
            return payload;
        }
        const outputText = this.safeStringify(output);
        if (outputText.length <= this.maxToolOutputChars) {
            return payload;
        }
        const { output: _output, ...rest } = payload;
        return {
            ...rest,
            outputTruncated: true,
            outputSize: outputText.length,
            outputType: Array.isArray(output) ? 'array' : typeof output,
            outputPreview: outputText.slice(0, this.previewChars),
        };
    }
    safeStringify(value) {
        try {
            const serialized = JSON.stringify(value);
            if (serialized !== undefined) {
                return serialized;
            }
        }
        catch {
        }
        return String(value);
    }
    extractToolFields(payload) {
        const toolId = typeof payload.toolId === 'string' ? payload.toolId : undefined;
        const toolName = typeof payload.toolName === 'string' ? payload.toolName : undefined;
        const params = payload.params !== undefined ? payload.params : payload.input;
        if (params === undefined) {
            return {
                ...(toolId ? { toolId } : {}),
                ...(toolName ? { toolName } : {}),
            };
        }
        const paramsText = this.safeStringify(params);
        if (paramsText.length <= this.previewChars) {
            return {
                ...(toolId ? { toolId } : {}),
                ...(toolName ? { toolName } : {}),
                params,
            };
        }
        return {
            ...(toolId ? { toolId } : {}),
            ...(toolName ? { toolName } : {}),
            paramsTruncated: true,
            paramsSize: paramsText.length,
            paramsPreview: paramsText.slice(0, this.previewChars),
        };
    }
};
exports.RuntimeActionLogIngestionService = RuntimeActionLogIngestionService;
exports.RuntimeActionLogIngestionService = RuntimeActionLogIngestionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agent_action_log_service_1.AgentActionLogService])
], RuntimeActionLogIngestionService);
//# sourceMappingURL=runtime-action-log.service.js.map