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
var MeetingOrchestrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingOrchestrationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const contracts_1 = require("../../../../libs/contracts/src/index");
const meeting_schema_1 = require("../../../shared/schemas/meeting.schema");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const meeting_event_service_1 = require("./meeting-event.service");
const meeting_agent_state_service_1 = require("./meeting-agent-state.service");
const meeting_lifecycle_service_1 = require("./meeting-lifecycle.service");
const meeting_participant_service_1 = require("./meeting-participant.service");
const meeting_message_service_1 = require("./meeting-message.service");
let MeetingOrchestrationService = MeetingOrchestrationService_1 = class MeetingOrchestrationService {
    constructor(meetingModel, agentClientService, eventService, agentStateService, lifecycleService, participantService, messageService) {
        this.meetingModel = meetingModel;
        this.agentClientService = agentClientService;
        this.eventService = eventService;
        this.agentStateService = agentStateService;
        this.lifecycleService = lifecycleService;
        this.participantService = participantService;
        this.messageService = messageService;
        this.logger = new common_1.Logger(MeetingOrchestrationService_1.name);
        this.modelManagementAgentName = 'model management agent';
        this.responseDedupWindowMs = 15000;
        this.recentResponseKeys = new Map();
        this.latestModelSearchPhrases = ['搜索最新openai模型', 'search latest openai models'];
        this.modelListPhrases = ['当前有哪些模型', 'list models'];
        this.memoRecordPhrases = ['记录到备忘录', 'append to memo'];
        this.operationLogPhrases = ['查看操作日志', 'operation log'];
        this.agentListPhrases = ['查看agent列表', 'list agents'];
    }
    buildResponseDedupKey(meetingId, agentId, triggerMessage) {
        const triggerId = String(triggerMessage.id || '').trim();
        if (triggerId) {
            return `${meetingId}:${agentId}:${triggerId}`;
        }
        const fallback = [triggerMessage.senderId || '', triggerMessage.timestamp?.toISOString?.() || '', triggerMessage.content || '']
            .join('|')
            .slice(0, 300);
        return `${meetingId}:${agentId}:${fallback}`;
    }
    shouldProcessResponse(dedupKey) {
        const now = Date.now();
        for (const [key, timestamp] of this.recentResponseKeys.entries()) {
            if (now - timestamp > this.responseDedupWindowMs) {
                this.recentResponseKeys.delete(key);
            }
        }
        const existing = this.recentResponseKeys.get(dedupKey);
        if (existing && now - existing <= this.responseDedupWindowMs) {
            return false;
        }
        this.recentResponseKeys.set(dedupKey, now);
        return true;
    }
    buildMeetingResponseTaskDescription(triggerMessage) {
        const latestMessage = String(triggerMessage.content || '').replace(/\s+/g, ' ').trim();
        if (!latestMessage) {
            return '请对会议中的发言做出回应';
        }
        const maxLen = 180;
        const excerpt = latestMessage.length > maxLen ? `${latestMessage.slice(0, maxLen)}...` : latestMessage;
        return `请对会议中的发言做出回应。最新发言：${excerpt}`;
    }
    buildMeetingTeamContext(meeting, triggerMessage, participantProfiles) {
        return contracts_1.CollaborationContextFactory.meeting({
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            meetingDescription: meeting.description,
            meetingType: meeting.type,
            agenda: meeting.agenda,
            initiatorId: triggerMessage.senderId,
            participants: meeting.participants.map((p) => ({
                id: p.participantId,
                type: p.participantType === 'employee' ? 'employee' : 'agent',
                role: p.role === 'host' ? 'host' : 'participant',
            })),
            participantProfiles,
        });
    }
    extractMentionTokens(content) {
        if (!content || !content.includes('@')) {
            return [];
        }
        const matches = content.matchAll(/@([^\s@，。,.!?！？:：;；]+)/g);
        const tokens = new Set();
        for (const match of matches) {
            const raw = (match[1] || '').trim();
            const normalized = raw
                .replace(/^@+/, '')
                .replace(/[，。,.!?！？:：;；]+$/g, '')
                .toLowerCase();
            if (normalized) {
                tokens.add(normalized);
            }
        }
        return Array.from(tokens);
    }
    buildMentionAliases(agentId, agentName) {
        const aliases = new Set();
        aliases.add(agentId.toLowerCase());
        if (!agentName) {
            return aliases;
        }
        const normalizedName = agentName.toLowerCase().trim();
        if (normalizedName) {
            aliases.add(normalizedName);
            aliases.add(normalizedName.replace(/\s+/g, ''));
            normalizedName
                .split(/\s+/)
                .filter(Boolean)
                .forEach((part) => aliases.add(part));
        }
        return aliases;
    }
    async resolveMentionedAgentIds(meeting, content) {
        const tokens = this.extractMentionTokens(content);
        if (tokens.length === 0) {
            return [];
        }
        const presentAgentParticipants = meeting.participants.filter((p) => p.isPresent && p.participantType === 'agent');
        if (presentAgentParticipants.length === 0) {
            return [];
        }
        const mentioned = new Set();
        const uniqueAgentIds = Array.from(new Set(presentAgentParticipants.map((p) => p.participantId)));
        for (const agentId of uniqueAgentIds) {
            const agent = await this.agentClientService.getAgent(agentId);
            const aliases = this.buildMentionAliases(agentId, agent?.name);
            for (const token of tokens) {
                if (aliases.has(token)) {
                    mentioned.add(agentId);
                }
            }
        }
        return Array.from(mentioned);
    }
    isLatestModelSearchIntent(content) {
        return this.hasBracketPhraseIntent(content, this.latestModelSearchPhrases);
    }
    isModelListIntent(content) {
        return this.hasBracketPhraseIntent(content, this.modelListPhrases);
    }
    isMemoRecordIntent(content) {
        return this.hasBracketPhraseIntent(content, this.memoRecordPhrases);
    }
    isModelManagementIntent(content) {
        return this.isLatestModelSearchIntent(content) || this.isModelListIntent(content);
    }
    isOperationLogIntent(content) {
        return this.hasBracketPhraseIntent(content, this.operationLogPhrases);
    }
    isAgentListIntent(content) {
        return this.hasBracketPhraseIntent(content, this.agentListPhrases);
    }
    hasBracketPhraseIntent(content, phrases) {
        const commands = this.extractBracketCommands(content);
        if (!commands.length) {
            return false;
        }
        const phraseSet = new Set(phrases.map((phrase) => this.normalizeIntentPhrase(phrase)));
        return commands.some((command) => phraseSet.has(command));
    }
    extractBracketCommands(content) {
        const text = String(content || '');
        if (!text) {
            return [];
        }
        const matches = text.matchAll(/[\[【]([^\]】\n]{1,120})[\]】]/g);
        const commands = new Set();
        for (const match of matches) {
            const raw = String(match?.[1] || '');
            const normalized = this.normalizeIntentPhrase(raw);
            if (normalized) {
                commands.add(normalized);
            }
        }
        return Array.from(commands);
    }
    normalizeIntentPhrase(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    formatOperationLogResponse(result) {
        const total = Number(result?.total || 0);
        const logs = Array.isArray(result?.logs) ? result.logs : [];
        if (total === 0 || logs.length === 0) {
            return '目前在系统的操作日志中没有记录。请问您需要查看特定时间段的日志吗？';
        }
        const latest = logs[0];
        const latestTime = latest?.timestamp ? new Date(latest.timestamp).toLocaleString('zh-CN') : '未知时间';
        const latestAction = latest?.action || latest?.resource || '未知操作';
        return [
            `我知道，当前共检索到 ${total} 条与你相关的系统操作日志。`,
            `最近一条是 ${latestTime}，操作为 ${latestAction}。`,
            '如果你需要，我可以继续按时间段或操作类型帮你筛选。',
        ].join('\n');
    }
    formatAgentListResponse(result) {
        const total = Number(result?.total || 0);
        const visible = Number(result?.visible || 0);
        const agents = Array.isArray(result?.agents) ? result.agents : [];
        if (visible === 0 || agents.length === 0) {
            return '我查到了系统当前没有可见的 Agent。若需要，我可以继续帮你筛选隐藏 Agent 或按角色查询。';
        }
        const rows = agents.slice(0, 8).map((item) => {
            const name = String(item?.name || '未命名 Agent');
            const role = String(item?.role || 'unknown-role');
            const status = item?.isActive === true ? 'active' : 'inactive';
            return `- ${name}（${role}，${status}）`;
        });
        return [
            `我知道，当前系统共登记 ${total} 个 Agent，其中可见 ${visible} 个。`,
            '可见 Agent 示例：',
            ...rows,
            rows.length < visible ? `（其余 ${visible - rows.length} 个可继续展开）` : '',
        ]
            .filter((line) => line)
            .join('\n');
    }
    async respondWithOperationLogSummary(meetingId, meetingTitle, assistantAgentId, triggerMessage) {
        try {
            const execution = await this.agentClientService.executeToolQuery('human_operation_log_mcp_list', assistantAgentId, {
                page: 1,
                pageSize: 20,
            }, {
                source: 'meeting.operation_log_intent',
                context: {
                    executionMode: 'chat',
                    collaborationContext: {
                        meetingId,
                        meetingTitle,
                    },
                },
            });
            const result = execution?.result || execution?.data?.result;
            const content = this.formatOperationLogResponse(result || {});
            await this.messageService.sendMessage(meetingId, {
                senderId: assistantAgentId,
                senderType: 'agent',
                content,
                type: 'conclusion',
                metadata: {
                    relatedMessageId: triggerMessage.id,
                },
            });
            return true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown operation log query error';
            this.logger.warn(`Operation log routing failed in meeting ${meetingId}: ${message}`);
            return false;
        }
    }
    async respondWithAgentListSummary(meetingId, meetingTitle, responderAgentId, triggerMessage) {
        try {
            const execution = await this.agentClientService.executeToolQuery('agents_mcp_list', responderAgentId, {
                includeHidden: false,
                limit: 30,
            }, {
                source: 'meeting.agent_list_intent',
                context: {
                    executionMode: 'chat',
                    collaborationContext: {
                        meetingId,
                        meetingTitle,
                    },
                },
            });
            const result = execution?.result || execution?.data?.result;
            const content = this.formatAgentListResponse(result || {});
            await this.messageService.sendMessage(meetingId, {
                senderId: responderAgentId,
                senderType: 'agent',
                content,
                type: 'conclusion',
                metadata: {
                    relatedMessageId: triggerMessage.id,
                },
            });
            return true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown agent list query error';
            this.logger.warn(`Agent list routing failed in meeting ${meetingId}: ${message}`);
            return false;
        }
    }
    async pickModelManagementResponder(presentAgents) {
        for (const participant of presentAgents) {
            const agent = await this.agentClientService.getAgent(participant.participantId);
            if (!agent)
                continue;
            const normalizedName = String(agent.name || '').toLowerCase().trim();
            if (normalizedName === this.modelManagementAgentName) {
                return participant.participantId;
            }
        }
        return null;
    }
    async triggerAgentResponses(meetingId, triggerMessage) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting || meeting.status !== meeting_schema_1.MeetingStatus.ACTIVE)
            return;
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        let presentAgents = meeting.participants.filter(p => p.isPresent &&
            p.participantType === 'agent');
        if (presentAgents.length === 0) {
            const standbyAgents = meeting.participants.filter(p => !p.isPresent && p.participantType === 'agent');
            if (standbyAgents.length > 0) {
                const now = new Date();
                standbyAgents.forEach((p) => {
                    p.isPresent = true;
                    p.joinedAt = now;
                });
                await meeting.save();
                presentAgents = standbyAgents;
            }
        }
        if (presentAgents.length === 0)
            return;
        let responderCandidates = presentAgents.filter((participant) => participant.participantId !== triggerMessage.senderId);
        const isMemoRecord = this.isMemoRecordIntent(triggerMessage.content || '');
        const routeToModelManagementAgent = this.isModelManagementIntent(triggerMessage.content || '') && !isMemoRecord;
        if (routeToModelManagementAgent) {
            const modelAgentId = await this.pickModelManagementResponder(responderCandidates);
            if (modelAgentId) {
                responderCandidates = responderCandidates.filter((participant) => participant.participantId === modelAgentId);
            }
        }
        const mentionTokens = this.extractMentionTokens(triggerMessage.content || '');
        if (mentionTokens.length > 0) {
            const mentionedAgentIds = await this.resolveMentionedAgentIds(meeting, triggerMessage.content || '');
            if (mentionedAgentIds.length === 0) {
                await this.messageService.addSystemMessage(meetingId, '未匹配到被 @ 的在场 Agent，请检查名称后重试。');
                return;
            }
            responderCandidates = responderCandidates.filter((p) => mentionedAgentIds.includes(p.participantId));
        }
        if (this.isOperationLogIntent(triggerMessage.content || '') && responderCandidates.length > 0) {
            const queryResponder = responderCandidates[0];
            const handled = await this.respondWithOperationLogSummary(meetingId, meeting.title, queryResponder.participantId, triggerMessage);
            if (handled) {
                return;
            }
        }
        if (this.isAgentListIntent(triggerMessage.content || '')) {
            const queryResponderId = responderCandidates[0]?.participantId;
            if (queryResponderId) {
                const handled = await this.respondWithAgentListSummary(meetingId, meeting.title, queryResponderId, triggerMessage);
                if (handled) {
                    return;
                }
            }
        }
        const finalResponders = responderCandidates;
        if (finalResponders.length === 0) {
            return;
        }
        const responders = [...finalResponders].sort(() => 0.5 - Math.random());
        const responderTasks = responders.map((participant) => ({
            participant,
            token: (0, uuid_1.v4)(),
        }));
        await Promise.all(responderTasks.map(({ participant, token }) => this.agentStateService.setAgentState(meetingId, participant.participantId, 'thinking', {
            reason: 'awaiting_response',
            token,
        })));
        for (let i = 0; i < responderTasks.length; i += 1) {
            const current = responderTasks[i];
            const delay = 800 + i * 700 + Math.random() * 500;
            setTimeout(async () => {
                await this.generateAgentResponse(meetingId, current.participant.participantId, triggerMessage, current.token);
            }, delay);
        }
    }
    async generateAgentResponse(meetingId, agentId, triggerMessage, stateToken) {
        try {
            const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
            if (!meeting || meeting.status !== meeting_schema_1.MeetingStatus.ACTIVE)
                return;
            const latestTriggerMessage = this.messageService.getMessageById(meeting, triggerMessage.id);
            if (!latestTriggerMessage) {
                this.logger.log(`Skip response because trigger message was removed: ${triggerMessage.id}`);
                return;
            }
            if (latestTriggerMessage.metadata?.pendingResponsePaused) {
                this.logger.log(`Skip response because trigger message is paused: ${triggerMessage.id}`);
                return;
            }
            const agent = await this.agentClientService.getAgent(agentId);
            if (!agent)
                return;
            this.logger.log(`Generating response for agent ${agent.name} in meeting ${meetingId}`);
            const contextMessages = await this.buildMeetingResponseContext(meeting, triggerMessage);
            const participantProfiles = await this.participantService.buildParticipantContextProfiles(meeting);
            const task = {
                title: `参与会议讨论: ${meeting.title}`,
                description: this.buildMeetingResponseTaskDescription(triggerMessage),
                type: 'meeting',
                priority: 'medium',
                status: 'in_progress',
                assignedAgents: [agentId],
                teamId: meetingId,
                messages: contextMessages,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const responseDedupKey = this.buildResponseDedupKey(meetingId, agentId, triggerMessage);
            if (!this.shouldProcessResponse(responseDedupKey)) {
                this.logger.log(`Skip duplicate meeting response generation: meetingId=${meetingId} agentId=${agentId} triggerMessageId=${triggerMessage.id || 'N/A'}`);
                return;
            }
            const response = await this.agentClientService.executeTask(agentId, task, {
                executionMode: 'chat',
                collaborationContext: this.buildMeetingTeamContext(meeting, triggerMessage, participantProfiles),
            });
            const messageType = this.messageService.analyzeMessageType(response);
            await this.messageService.sendMessage(meetingId, {
                senderId: agentId,
                senderType: 'agent',
                content: response,
                type: messageType,
                metadata: {
                    confidence: 0.85,
                    relatedMessageId: triggerMessage.id,
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to generate response for agent ${agentId}: ${error.message}`);
        }
        finally {
            await this.agentStateService.clearAgentThinking(meetingId, agentId, { reason: 'response_finished', token: stateToken });
        }
    }
    async buildMeetingResponseContext(meeting, triggerMessage) {
        const messages = [];
        const participantProfiles = await this.participantService.buildParticipantContextProfiles(meeting);
        const participantNameLookup = this.participantService.buildParticipantDisplayNameMap(participantProfiles);
        const recentMessages = meeting.messages.slice(-10);
        for (const msg of recentMessages) {
            const senderDisplayName = this.participantService.resolveMessageSenderDisplayName(msg, participantNameLookup);
            messages.push({
                role: msg.senderType === 'agent' ? 'assistant' : 'user',
                content: `${senderDisplayName}: ${msg.content}`,
                timestamp: msg.timestamp,
            });
        }
        const triggerSenderName = this.participantService.resolveMessageSenderDisplayName(triggerMessage, participantNameLookup);
        let responseInstruction = '请对此做出回应。';
        const isMemoRecord = this.isMemoRecordIntent(triggerMessage.content || '');
        const isLatestSearch = this.isLatestModelSearchIntent(triggerMessage.content || '');
        const isModelList = this.isModelListIntent(triggerMessage.content || '');
        if (isLatestSearch && !isMemoRecord) {
            responseInstruction +=
                ' 当前用户命中了显式短语命令“[搜索最新openai模型]”，请优先联网搜索并返回候选模型与来源，并在结尾明确询问“是否需要添加到系统？”，未收到明确确认前不要执行模型入库。';
        }
        else if (isModelList && !isMemoRecord) {
            responseInstruction +=
                ' 当前用户命中了显式短语命令“[当前有哪些模型]”，请先调用模型列表工具获取实时数据，再按 name/provider/model/maxTokens 结构回答，不要返回 Agent 列表。';
        }
        messages.push({
            role: 'user',
            content: `[新消息] ${triggerSenderName}: ${triggerMessage.content}\n\n${responseInstruction}`,
            timestamp: new Date(),
        });
        return messages;
    }
    async catchUpAgent(meetingId, participant) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting)
            return;
        const agent = await this.agentClientService.getAgent(participant.id);
        if (!agent)
            return;
        const recentMessages = meeting.messages.slice(-5);
        if (recentMessages.length === 0)
            return;
        const participantProfiles = await this.participantService.buildParticipantContextProfiles(meeting);
        const participantNameLookup = this.participantService.buildParticipantDisplayNameMap(participantProfiles);
        const summary = recentMessages
            .map((m) => `${this.participantService.resolveMessageSenderDisplayName(m, participantNameLookup)}: ${m.content}`)
            .join('\n');
        const prompt = `你刚加入会议。会议目前的讨论如下：\n\n${summary}\n\n请发表一个简短的入场发言（1-2句话）。`;
        const task = {
            title: '加入会议',
            description: prompt,
            type: 'meeting',
            priority: 'low',
            status: 'in_progress',
            assignedAgents: [participant.id],
            teamId: meetingId,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                    timestamp: new Date(),
                },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        try {
            const triggerMessage = {
                id: (0, uuid_1.v4)(),
                senderId: 'system',
                senderType: 'system',
                content: prompt,
                type: 'introduction',
                timestamp: new Date(),
            };
            const response = await this.agentClientService.executeTask(participant.id, task, {
                executionMode: 'chat',
                collaborationContext: this.buildMeetingTeamContext(meeting, triggerMessage, participantProfiles),
            });
            await this.messageService.sendMessage(meetingId, {
                senderId: participant.id,
                senderType: 'agent',
                content: response,
                type: 'introduction',
            });
        }
        catch (error) {
            this.logger.error(`Failed to generate catch-up for agent: ${error.message}`);
        }
    }
};
exports.MeetingOrchestrationService = MeetingOrchestrationService;
exports.MeetingOrchestrationService = MeetingOrchestrationService = MeetingOrchestrationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(meeting_schema_1.Meeting.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        meeting_event_service_1.MeetingEventService,
        meeting_agent_state_service_1.MeetingAgentStateService,
        meeting_lifecycle_service_1.MeetingLifecycleService,
        meeting_participant_service_1.MeetingParticipantService,
        meeting_message_service_1.MeetingMessageService])
], MeetingOrchestrationService);
//# sourceMappingURL=meeting-orchestration.service.js.map