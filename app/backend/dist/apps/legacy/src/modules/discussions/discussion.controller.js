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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionController = void 0;
const common_1 = require("@nestjs/common");
const discussion_space_schema_1 = require("../../shared/schemas/discussion-space.schema");
const discussion_message_service_1 = require("./services/discussion-message.service");
const discussion_knowledge_service_1 = require("./services/discussion-knowledge.service");
const discussion_outline_service_1 = require("./services/discussion-outline.service");
const discussion_participant_service_1 = require("./services/discussion-participant.service");
const discussion_sediment_service_1 = require("./services/discussion-sediment.service");
const discussion_space_service_1 = require("./services/discussion-space.service");
const discussion_thread_service_1 = require("./services/discussion-thread.service");
const discussion_message_stream_service_1 = require("./services/discussion-message-stream.service");
const discussion_requirement_bridge_service_1 = require("./services/discussion-requirement-bridge.service");
let DiscussionController = class DiscussionController {
    constructor(discussionSpaceService, discussionThreadService, discussionMessageService, discussionParticipantService, discussionKnowledgeService, discussionOutlineService, discussionSedimentService, discussionMessageStreamService, discussionRequirementBridgeService) {
        this.discussionSpaceService = discussionSpaceService;
        this.discussionThreadService = discussionThreadService;
        this.discussionMessageService = discussionMessageService;
        this.discussionParticipantService = discussionParticipantService;
        this.discussionKnowledgeService = discussionKnowledgeService;
        this.discussionOutlineService = discussionOutlineService;
        this.discussionSedimentService = discussionSedimentService;
        this.discussionMessageStreamService = discussionMessageStreamService;
        this.discussionRequirementBridgeService = discussionRequirementBridgeService;
    }
    async createSpace(dto) {
        const space = await this.discussionSpaceService.createSpace(dto);
        const rootThread = await this.discussionThreadService.createRootThread(space.id);
        await this.discussionSpaceService.setRootThread(space.id, rootThread.id);
        await this.discussionParticipantService.ensureCreatorParticipant(space.id, dto.creatorId);
        if (dto.initialParticipants?.length) {
            for (const participant of dto.initialParticipants) {
                await this.discussionParticipantService.addParticipant(space.id, participant);
            }
        }
        if (dto.category === discussion_space_schema_1.DiscussionSpaceCategory.INDUSTRY_OBSERVATION) {
            await this.discussionOutlineService.createGenerateOutlineTask(space.id, {
                industryContext: dto.industryContext,
            });
        }
        return this.discussionSpaceService.getSpaceById(space.id);
    }
    async listSpaces(status, includeArchivedRaw, category, creatorId, projectId, tagsRaw) {
        const includeArchived = includeArchivedRaw === '1' || includeArchivedRaw === 'true';
        const query = {
            status,
            includeArchived,
            category,
            creatorId,
            projectId,
            tags: tagsRaw?.split(',').map((tag) => tag.trim()).filter(Boolean),
        };
        return this.discussionSpaceService.listSpaces(query);
    }
    async getSpaceDetail(spaceId) {
        const [space, threadTree, participants] = await Promise.all([
            this.discussionSpaceService.getSpaceById(spaceId),
            this.discussionThreadService.listThreadTree(spaceId),
            this.discussionParticipantService.listParticipants(spaceId),
        ]);
        return {
            ...space,
            threadTree,
            participants,
        };
    }
    async updateSpace(spaceId, dto) {
        return this.discussionSpaceService.updateSpace(spaceId, dto);
    }
    async updateSpaceStatus(spaceId, status, operatorId) {
        return this.discussionSpaceService.updateStatus(spaceId, status, operatorId);
    }
    async archiveSpaceByAction(spaceId, operatorId) {
        return this.discussionSpaceService.archiveSpace(spaceId, operatorId);
    }
    async unarchiveSpace(spaceId) {
        return this.discussionSpaceService.unarchiveSpace(spaceId);
    }
    async archiveSpace(spaceId) {
        return this.discussionSpaceService.archiveSpace(spaceId);
    }
    async createThread(spaceId, dto) {
        return this.discussionThreadService.createThread(spaceId, dto);
    }
    async getThreadTree(spaceId) {
        return this.discussionThreadService.listThreadTree(spaceId);
    }
    async getThread(spaceId, threadId) {
        return this.discussionThreadService.getThreadById(spaceId, threadId);
    }
    async updateThread(spaceId, threadId, dto) {
        return this.discussionThreadService.updateThread(spaceId, threadId, dto);
    }
    async deleteThread(spaceId, threadId) {
        return this.discussionThreadService.deleteThread(spaceId, threadId);
    }
    async sendMessage(spaceId, threadId, dto) {
        return this.discussionMessageService.sendMessage(spaceId, threadId, dto);
    }
    async triggerDataAnalysis(spaceId, dto) {
        return this.discussionMessageService.createDataUpdateAnalysisMessage(spaceId, dto);
    }
    async listMessages(spaceId, threadId, limit) {
        return this.discussionMessageService.listMessages(spaceId, threadId, Number(limit || 100));
    }
    async linkMessageKnowledge(spaceId, threadId, messageId, dto) {
        const knowledgeEntryIds = await this.discussionKnowledgeService.linkExistingKnowledgeEntriesToMessage({
            spaceId,
            threadId,
            messageId,
            knowledgeEntryIds: dto.knowledgeEntryIds,
        });
        return {
            linked: true,
            messageId,
            knowledgeEntryIds,
        };
    }
    async streamThreadMessages(spaceId, threadId) {
        return this.discussionMessageStreamService.streamThreadMessages(spaceId, threadId);
    }
    async branchFromMessage(spaceId, threadId, messageId, dto) {
        const [sourceMessage, parentThread] = await Promise.all([
            this.discussionMessageService.getMessageById(spaceId, threadId, messageId),
            this.discussionThreadService.getThreadById(spaceId, threadId),
        ]);
        const thread = await this.discussionThreadService.createThread(spaceId, {
            title: dto.title,
            parentThreadId: threadId,
            branchFromMessageId: messageId,
            contextSummary: dto.contextSummary,
            branchOrigin: dto.branchOrigin,
        });
        await this.discussionMessageService.createBranchContextMessage({
            spaceId,
            threadId: thread.id,
            parentThreadTitle: parentThread.title,
            sourceMessage,
        });
        return thread;
    }
    async createRequirementFromMessage(spaceId, threadId, messageId, dto) {
        const [space, thread, message] = await Promise.all([
            this.discussionSpaceService.getSpaceById(spaceId),
            this.discussionThreadService.getThreadById(spaceId, threadId),
            this.discussionMessageService.getMessageById(spaceId, threadId, messageId),
        ]);
        const messagePreview = String(message.content || '').trim().slice(0, 200);
        const title = String(dto.title || '').trim() || messagePreview || '讨论转化需求';
        const description = String(dto.description || '').trim() || String(message.content || '').trim();
        const result = await this.discussionRequirementBridgeService.createRequirementFromDiscussion({
            title,
            description,
            priority: dto.priority || 'medium',
            projectId: dto.projectId || space.projectId,
            createdById: dto.createdById,
            createdByName: dto.createdByName,
            source: {
                spaceId,
                spaceTitle: space.title,
                threadId,
                threadTitle: thread.title,
                messageId,
                messagePreview,
            },
        });
        return {
            requirementId: result.requirementId,
            title: result.title,
        };
    }
    async addParticipant(spaceId, dto) {
        return this.discussionParticipantService.addParticipant(spaceId, dto);
    }
    async listParticipants(spaceId) {
        return this.discussionParticipantService.listParticipants(spaceId);
    }
    async updateParticipant(spaceId, participantId, dto) {
        return this.discussionParticipantService.updateParticipant(spaceId, participantId, dto);
    }
    async removeParticipant(spaceId, participantId) {
        await this.discussionParticipantService.removeParticipant(spaceId, participantId);
        await this.discussionSpaceService.clearDefaultReplyAgentIfMatched(spaceId, participantId);
        return { removed: true };
    }
    async createKnowledgeEntry(spaceId, dto) {
        return this.discussionKnowledgeService.createKnowledgeEntry(spaceId, dto);
    }
    async listKnowledgeEntries(spaceId, threadId, outlineSectionId, participantId, keyword, credibility, limit) {
        const query = {
            threadId,
            outlineSectionId,
            participantId,
            keyword,
            credibility,
            limit: limit ? Number(limit) : undefined,
        };
        return this.discussionKnowledgeService.listKnowledgeEntries(spaceId, query);
    }
    async getKnowledgeCoverage(spaceId) {
        return this.discussionOutlineService.getKnowledgeCoverage(spaceId);
    }
    async deleteKnowledgeEntry(spaceId, knowledgeEntryId) {
        return this.discussionKnowledgeService.deleteKnowledgeEntry(spaceId, knowledgeEntryId);
    }
    async generateOutline(spaceId, industryContext) {
        return this.discussionOutlineService.generateOutline(spaceId, { industryContext });
    }
    async generateOutlineTask(spaceId, industryContext) {
        return this.discussionOutlineService.createGenerateOutlineTask(spaceId, { industryContext });
    }
    async getOutline(spaceId) {
        return this.discussionOutlineService.getOutline(spaceId);
    }
    async updateOutline(spaceId, dto) {
        return this.discussionOutlineService.updateOutline(spaceId, dto);
    }
    async addOutlineSection(spaceId, dto) {
        return this.discussionOutlineService.addSection(spaceId, dto);
    }
    async updateOutlineSection(spaceId, sectionId, dto) {
        return this.discussionOutlineService.updateSection(spaceId, sectionId, dto);
    }
    async deleteOutlineSection(spaceId, sectionId) {
        return this.discussionOutlineService.deleteSection(spaceId, sectionId);
    }
    async clearOutlineSectionEnrichments(spaceId, sectionId) {
        return this.discussionOutlineService.clearSectionEnrichment(spaceId, sectionId);
    }
    async getOrCreateSectionThread(spaceId, sectionId, sectionTitle) {
        return this.discussionThreadService.getOrCreateSectionThread(spaceId, sectionId, sectionTitle);
    }
    async enrichOutlineSection(spaceId, sectionId) {
        return this.discussionOutlineService.enrichSection(spaceId, sectionId);
    }
    async enrichOutlineSectionTask(spaceId, sectionId) {
        return this.discussionOutlineService.createEnrichSectionTask(spaceId, sectionId);
    }
    async enrichAllOutlineSections(spaceId) {
        return this.discussionOutlineService.enrichAllDraftSections(spaceId);
    }
    async streamOutlineTaskEvents(spaceId, taskId, _accessToken) {
        return this.discussionOutlineService.streamOutlineTaskEvents(spaceId, taskId);
    }
    async updateSedimentMode(spaceId, dto) {
        return this.discussionSedimentService.updateSedimentMode(spaceId, dto.mode);
    }
    async generateSediment(spaceId, dto) {
        return this.discussionSedimentService.createSedimentTask({
            spaceId,
            mode: dto.mode,
            title: dto.title,
            threadScope: dto.threadScope,
        });
    }
    async streamSedimentTaskEvents(spaceId, taskId, _accessToken) {
        return this.discussionSedimentService.streamSedimentTaskEvents(spaceId, taskId);
    }
    async getLatestSediment(spaceId) {
        return this.discussionSedimentService.getLatestSediment(spaceId);
    }
    async getSedimentHistory(spaceId, limit) {
        const query = {
            limit: limit ? Number(limit) : undefined,
        };
        return this.discussionSedimentService.listSedimentHistory(spaceId, query.limit);
    }
    async deleteSedimentHistory(spaceId, historyId, operatorId) {
        const dto = {
            operatorId: String(operatorId || '').trim(),
        };
        return this.discussionSedimentService.deleteSedimentHistory(spaceId, historyId, dto.operatorId);
    }
};
exports.DiscussionController = DiscussionController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "createSpace", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('includeArchived')),
    __param(2, (0, common_1.Query)('category')),
    __param(3, (0, common_1.Query)('creatorId')),
    __param(4, (0, common_1.Query)('projectId')),
    __param(5, (0, common_1.Query)('tags')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "listSpaces", null);
__decorate([
    (0, common_1.Get)(':spaceId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getSpaceDetail", null);
__decorate([
    (0, common_1.Put)(':spaceId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateSpace", null);
__decorate([
    (0, common_1.Put)(':spaceId/status'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Body)('operatorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateSpaceStatus", null);
__decorate([
    (0, common_1.Post)(':spaceId/archive'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)('operatorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "archiveSpaceByAction", null);
__decorate([
    (0, common_1.Post)(':spaceId/unarchive'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "unarchiveSpace", null);
__decorate([
    (0, common_1.Delete)(':spaceId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "archiveSpace", null);
__decorate([
    (0, common_1.Post)(':spaceId/threads'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "createThread", null);
__decorate([
    (0, common_1.Get)(':spaceId/threads'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getThreadTree", null);
__decorate([
    (0, common_1.Get)(':spaceId/threads/:threadId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getThread", null);
__decorate([
    (0, common_1.Put)(':spaceId/threads/:threadId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateThread", null);
__decorate([
    (0, common_1.Delete)(':spaceId/threads/:threadId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "deleteThread", null);
__decorate([
    (0, common_1.Post)(':spaceId/threads/:threadId/messages'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)(':spaceId/system/data-analysis'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "triggerDataAnalysis", null);
__decorate([
    (0, common_1.Get)(':spaceId/threads/:threadId/messages'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "listMessages", null);
__decorate([
    (0, common_1.Post)(':spaceId/threads/:threadId/messages/:messageId/knowledge/link'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "linkMessageKnowledge", null);
__decorate([
    (0, common_1.Sse)(':spaceId/threads/:threadId/messages/events'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "streamThreadMessages", null);
__decorate([
    (0, common_1.Post)(':spaceId/threads/:threadId/messages/:messageId/branch'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "branchFromMessage", null);
__decorate([
    (0, common_1.Post)(':spaceId/threads/:threadId/messages/:messageId/to-requirement'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('threadId')),
    __param(2, (0, common_1.Param)('messageId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "createRequirementFromMessage", null);
__decorate([
    (0, common_1.Post)(':spaceId/participants'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "addParticipant", null);
__decorate([
    (0, common_1.Get)(':spaceId/participants'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "listParticipants", null);
__decorate([
    (0, common_1.Put)(':spaceId/participants/:participantId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('participantId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateParticipant", null);
__decorate([
    (0, common_1.Delete)(':spaceId/participants/:participantId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('participantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "removeParticipant", null);
__decorate([
    (0, common_1.Post)(':spaceId/knowledge'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "createKnowledgeEntry", null);
__decorate([
    (0, common_1.Get)(':spaceId/knowledge'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Query)('threadId')),
    __param(2, (0, common_1.Query)('outlineSectionId')),
    __param(3, (0, common_1.Query)('participantId')),
    __param(4, (0, common_1.Query)('keyword')),
    __param(5, (0, common_1.Query)('credibility')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Object, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "listKnowledgeEntries", null);
__decorate([
    (0, common_1.Get)(':spaceId/knowledge/coverage'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getKnowledgeCoverage", null);
__decorate([
    (0, common_1.Delete)(':spaceId/knowledge/:knowledgeEntryId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('knowledgeEntryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "deleteKnowledgeEntry", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/generate'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)('industryContext')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "generateOutline", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/generate-task'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)('industryContext')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "generateOutlineTask", null);
__decorate([
    (0, common_1.Get)(':spaceId/outline'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getOutline", null);
__decorate([
    (0, common_1.Put)(':spaceId/outline'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateOutline", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/sections'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "addOutlineSection", null);
__decorate([
    (0, common_1.Put)(':spaceId/outline/sections/:sectionId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('sectionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateOutlineSection", null);
__decorate([
    (0, common_1.Delete)(':spaceId/outline/sections/:sectionId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('sectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "deleteOutlineSection", null);
__decorate([
    (0, common_1.Delete)(':spaceId/outline/sections/:sectionId/enrichments'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('sectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "clearOutlineSectionEnrichments", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/sections/:sectionId/thread'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('sectionId')),
    __param(2, (0, common_1.Body)('sectionTitle')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getOrCreateSectionThread", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/sections/:sectionId/enrich'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('sectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "enrichOutlineSection", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/sections/:sectionId/enrich-task'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('sectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "enrichOutlineSectionTask", null);
__decorate([
    (0, common_1.Post)(':spaceId/outline/enrich-all'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "enrichAllOutlineSections", null);
__decorate([
    (0, common_1.Sse)(':spaceId/outline/tasks/:taskId/events'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('taskId')),
    __param(2, (0, common_1.Query)('access_token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "streamOutlineTaskEvents", null);
__decorate([
    (0, common_1.Put)(':spaceId/sediment/mode'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "updateSedimentMode", null);
__decorate([
    (0, common_1.Post)(':spaceId/sediment/generate'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "generateSediment", null);
__decorate([
    (0, common_1.Sse)(':spaceId/sediment/tasks/:taskId/events'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('taskId')),
    __param(2, (0, common_1.Query)('access_token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "streamSedimentTaskEvents", null);
__decorate([
    (0, common_1.Get)(':spaceId/sediment/latest'),
    __param(0, (0, common_1.Param)('spaceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getLatestSediment", null);
__decorate([
    (0, common_1.Get)(':spaceId/sediment/history'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "getSedimentHistory", null);
__decorate([
    (0, common_1.Delete)(':spaceId/sediment/history/:historyId'),
    __param(0, (0, common_1.Param)('spaceId')),
    __param(1, (0, common_1.Param)('historyId')),
    __param(2, (0, common_1.Query)('operatorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], DiscussionController.prototype, "deleteSedimentHistory", null);
exports.DiscussionController = DiscussionController = __decorate([
    (0, common_1.Controller)('discussions'),
    __metadata("design:paramtypes", [discussion_space_service_1.DiscussionSpaceService,
        discussion_thread_service_1.DiscussionThreadService,
        discussion_message_service_1.DiscussionMessageService,
        discussion_participant_service_1.DiscussionParticipantService,
        discussion_knowledge_service_1.DiscussionKnowledgeService,
        discussion_outline_service_1.DiscussionOutlineService,
        discussion_sediment_service_1.DiscussionSedimentService,
        discussion_message_stream_service_1.DiscussionMessageStreamService,
        discussion_requirement_bridge_service_1.DiscussionRequirementBridgeService])
], DiscussionController);
//# sourceMappingURL=discussion.controller.js.map