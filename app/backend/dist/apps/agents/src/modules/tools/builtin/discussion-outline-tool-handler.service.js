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
var DiscussionOutlineToolHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionOutlineToolHandler = void 0;
const common_1 = require("@nestjs/common");
const internal_api_client_service_1 = require("../internal-api-client.service");
let DiscussionOutlineToolHandler = DiscussionOutlineToolHandler_1 = class DiscussionOutlineToolHandler {
    constructor(internalApiClient) {
        this.internalApiClient = internalApiClient;
        this.logger = new common_1.Logger(DiscussionOutlineToolHandler_1.name);
    }
    async manage(params, agentId, executionContext) {
        const action = this.parseAction(params?.action);
        const spaceId = this.resolveSpaceId(params, executionContext);
        const sectionId = String(params?.sectionId || '').trim() || undefined;
        if (!spaceId) {
            return this.errorEnvelope({
                code: 'discussion_outline_invalid_input',
                message: 'discussion_outline_manage requires spaceId',
                action,
                spaceId,
                sectionId,
                agentId,
            });
        }
        try {
            const spaceDetail = await this.internalApiClient.callDiscussionApi('GET', `/${encodeURIComponent(spaceId)}`);
            const expectedProjectId = this.resolveExpectedProjectId(params, executionContext);
            const spaceProjectId = String(spaceDetail?.projectId || '').trim();
            if (expectedProjectId && spaceProjectId && expectedProjectId !== spaceProjectId) {
                throw new Error(`discussion_outline_project_mismatch: expectedProjectId=${expectedProjectId} actualProjectId=${spaceProjectId}`);
            }
            const data = await this.dispatchAction({
                action,
                params,
                spaceId,
                sectionId,
            });
            if (action === 'enrich_section') {
                const validated = await this.validateEnrichResult({
                    spaceId,
                    sectionId,
                    enrichResult: data,
                });
                return {
                    ok: true,
                    action,
                    spaceId,
                    sectionId,
                    projectId: spaceProjectId || expectedProjectId,
                    data: {
                        ...data,
                        acceptedEntries: validated.entries,
                        fallbackReason: validated.fallbackReason,
                    },
                    trace: {
                        agentId,
                        executedAt: new Date().toISOString(),
                    },
                };
            }
            return {
                ok: true,
                action,
                spaceId,
                sectionId,
                projectId: spaceProjectId || expectedProjectId,
                data,
                trace: {
                    agentId,
                    executedAt: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'discussion_outline_tool_failed');
            const [code, ...rest] = message.split(':');
            const finalCode = code && code.startsWith('discussion_outline_') ? code : 'discussion_outline_tool_failed';
            const finalMessage = rest.length ? rest.join(':').trim() : message;
            this.logger.warn(`[discussion_outline_tool_error] action=${action} spaceId=${spaceId} sectionId=${sectionId || 'none'} agentId=${agentId || 'none'} reason=${finalCode}`);
            return this.errorEnvelope({
                code: finalCode,
                message: finalMessage,
                action,
                spaceId,
                sectionId,
                agentId,
            });
        }
    }
    parseAction(rawAction) {
        const action = String(rawAction || '')
            .trim()
            .toLowerCase();
        const allowed = new Set([
            'get_outline',
            'create_section',
            'update_section',
            'delete_section',
            'reorder_section',
            'enrich_section',
            'clear_enrichments',
        ]);
        if (!allowed.has(action)) {
            throw new Error(`discussion_outline_invalid_action: expected one of ${Array.from(allowed).join(', ')}, received ${action || 'empty'}`);
        }
        return action;
    }
    resolveSpaceId(params, executionContext) {
        const collaborationContext = executionContext?.collaborationContext && typeof executionContext.collaborationContext === 'object'
            ? executionContext.collaborationContext
            : {};
        const candidates = [
            params?.spaceId,
            collaborationContext.spaceId,
            collaborationContext.discussionSpaceId,
            collaborationContext.teamId,
            executionContext?.teamId,
        ];
        for (const candidate of candidates) {
            const value = String(candidate || '').trim();
            if (value) {
                return value;
            }
        }
        return '';
    }
    resolveExpectedProjectId(params, executionContext) {
        const collaborationContext = executionContext?.collaborationContext && typeof executionContext.collaborationContext === 'object'
            ? executionContext.collaborationContext
            : {};
        const projectBinding = collaborationContext.projectBinding && typeof collaborationContext.projectBinding === 'object'
            ? collaborationContext.projectBinding
            : {};
        const candidates = [
            params?.projectId,
            executionContext?.projectId,
            collaborationContext.projectId,
            projectBinding.projectId,
        ];
        for (const candidate of candidates) {
            const value = String(candidate || '').trim();
            if (value) {
                return value;
            }
        }
        return undefined;
    }
    async dispatchAction(input) {
        const { action, params, spaceId, sectionId } = input;
        switch (action) {
            case 'get_outline':
                return this.internalApiClient.callDiscussionApi('GET', `/${encodeURIComponent(spaceId)}/outline`);
            case 'create_section': {
                const title = String(params.title || '').trim();
                if (!title) {
                    throw new Error('discussion_outline_invalid_input: create_section requires title');
                }
                return this.internalApiClient.callDiscussionApi('POST', `/${encodeURIComponent(spaceId)}/outline/sections`, {
                    title,
                    ...(Object.prototype.hasOwnProperty.call(params || {}, 'description')
                        ? { description: params.description }
                        : {}),
                    ...(Object.prototype.hasOwnProperty.call(params || {}, 'parentSectionId')
                        ? { parentSectionId: params.parentSectionId }
                        : {}),
                    ...(Object.prototype.hasOwnProperty.call(params || {}, 'order') ? { order: params.order } : {}),
                    ...(Object.prototype.hasOwnProperty.call(params || {}, 'status') ? { status: params.status } : {}),
                    ...(Object.prototype.hasOwnProperty.call(params || {}, 'metadata') ? { metadata: params.metadata } : {}),
                });
            }
            case 'update_section': {
                if (!sectionId) {
                    throw new Error('discussion_outline_invalid_input: update_section requires sectionId');
                }
                const body = {};
                if (Object.prototype.hasOwnProperty.call(params || {}, 'title'))
                    body.title = params.title;
                if (Object.prototype.hasOwnProperty.call(params || {}, 'description'))
                    body.description = params.description;
                if (Object.prototype.hasOwnProperty.call(params || {}, 'parentSectionId'))
                    body.parentSectionId = params.parentSectionId;
                if (Object.prototype.hasOwnProperty.call(params || {}, 'order'))
                    body.order = params.order;
                if (Object.prototype.hasOwnProperty.call(params || {}, 'status'))
                    body.status = params.status;
                if (Object.prototype.hasOwnProperty.call(params || {}, 'metadata'))
                    body.metadata = params.metadata;
                if (!Object.keys(body).length) {
                    throw new Error('discussion_outline_invalid_input: update_section requires at least one update field');
                }
                return this.internalApiClient.callDiscussionApi('PUT', `/${encodeURIComponent(spaceId)}/outline/sections/${encodeURIComponent(sectionId)}`, body);
            }
            case 'delete_section': {
                if (!sectionId) {
                    throw new Error('discussion_outline_invalid_input: delete_section requires sectionId');
                }
                return this.internalApiClient.callDiscussionApi('DELETE', `/${encodeURIComponent(spaceId)}/outline/sections/${encodeURIComponent(sectionId)}`);
            }
            case 'reorder_section': {
                if (!sectionId) {
                    throw new Error('discussion_outline_invalid_input: reorder_section requires sectionId');
                }
                const hasOrder = Object.prototype.hasOwnProperty.call(params || {}, 'order');
                const hasParent = Object.prototype.hasOwnProperty.call(params || {}, 'parentSectionId');
                if (!hasOrder && !hasParent) {
                    throw new Error('discussion_outline_invalid_input: reorder_section requires order or parentSectionId');
                }
                return this.internalApiClient.callDiscussionApi('PUT', `/${encodeURIComponent(spaceId)}/outline/sections/${encodeURIComponent(sectionId)}`, {
                    ...(hasOrder ? { order: params.order } : {}),
                    ...(hasParent ? { parentSectionId: params.parentSectionId } : {}),
                });
            }
            case 'enrich_section': {
                if (!sectionId) {
                    throw new Error('discussion_outline_invalid_input: enrich_section requires sectionId');
                }
                return this.internalApiClient.callDiscussionApi('POST', `/${encodeURIComponent(spaceId)}/outline/sections/${encodeURIComponent(sectionId)}/enrich`);
            }
            case 'clear_enrichments': {
                if (!sectionId) {
                    throw new Error('discussion_outline_invalid_input: clear_enrichments requires sectionId');
                }
                return this.internalApiClient.callDiscussionApi('DELETE', `/${encodeURIComponent(spaceId)}/outline/sections/${encodeURIComponent(sectionId)}/enrichments`);
            }
        }
    }
    async validateEnrichResult(input) {
        const sectionId = String(input.sectionId || '').trim();
        if (!sectionId) {
            throw new Error('discussion_outline_invalid_input: enrich_section requires sectionId');
        }
        const query = new URLSearchParams({
            outlineSectionId: sectionId,
            limit: '20',
        });
        const listResult = await this.internalApiClient.callDiscussionApi('GET', `/${encodeURIComponent(input.spaceId)}/knowledge?${query.toString()}`);
        const rawEntries = Array.isArray(listResult)
            ? listResult
            : Array.isArray(listResult?.list)
                ? listResult.list
                : Array.isArray(listResult?.entries)
                    ? listResult.entries
                    : [];
        const entries = rawEntries
            .filter((item) => item && typeof item === 'object')
            .filter((item) => String(item.title || '').trim())
            .filter((item) => String(item.content || '').trim());
        const fallbackReason = String(input.enrichResult?.enrichmentMeta?.fallbackReason || '').trim() || undefined;
        if (!entries.length && !fallbackReason) {
            throw new Error('discussion_outline_enrich_result_rejected: enrich_section requires structured entries or fallbackReason');
        }
        return {
            entries,
            fallbackReason,
        };
    }
    errorEnvelope(input) {
        return {
            ok: false,
            action: input.action,
            spaceId: input.spaceId,
            sectionId: input.sectionId,
            error: {
                code: input.code,
                message: input.message,
                reason: input.code,
            },
            trace: {
                agentId: input.agentId,
                action: input.action,
                spaceId: input.spaceId,
                sectionId: input.sectionId,
                emittedAt: new Date().toISOString(),
            },
        };
    }
};
exports.DiscussionOutlineToolHandler = DiscussionOutlineToolHandler;
exports.DiscussionOutlineToolHandler = DiscussionOutlineToolHandler = DiscussionOutlineToolHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [internal_api_client_service_1.InternalApiClient])
], DiscussionOutlineToolHandler);
//# sourceMappingURL=discussion-outline-tool-handler.service.js.map