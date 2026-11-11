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
var ComposioService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposioService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@composio/core");
let ComposioService = ComposioService_1 = class ComposioService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ComposioService_1.name);
        this.composio = null;
        this.apiKey = this.configService.get('COMPOSIO_API_KEY');
        if (!this.isConfigured()) {
            this.logger.warn('Composio API key not configured');
            return;
        }
        try {
            this.composio = new core_1.Composio({ apiKey: this.apiKey });
            this.logger.log('Composio SDK initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize Composio SDK', error);
            this.composio = null;
        }
    }
    isConfigured() {
        return !!this.apiKey && this.apiKey !== 'your_composio_api_key_here';
    }
    getClient() {
        if (!this.composio) {
            throw new Error('Composio client not initialized');
        }
        return this.composio;
    }
    getToolkitSlugFromToolName(toolName) {
        if (toolName.startsWith('SERPAPI_'))
            return 'serpapi';
        if (toolName.startsWith('SLACK_'))
            return 'slack';
        if (toolName.startsWith('GMAIL_'))
            return 'gmail';
        return null;
    }
    async resolveConnectedAccount(toolkitSlug, preferredUserId) {
        const client = this.getClient();
        const query = {
            toolkit_slugs: [toolkitSlug],
            limit: 50,
        };
        if (preferredUserId)
            query.user_ids = [preferredUserId];
        const scoped = await client.client.connectedAccounts.list(query);
        if (scoped.items?.length) {
            const account = scoped.items[0];
            return {
                connectedAccountId: account.id,
                userId: account.user_id || preferredUserId || 'default',
            };
        }
        const fallback = await client.client.connectedAccounts.list({
            toolkit_slugs: [toolkitSlug],
            limit: 50,
        });
        if (!fallback.items?.length)
            return null;
        const account = fallback.items[0];
        return {
            connectedAccountId: account.id,
            userId: account.user_id || preferredUserId || 'default',
        };
    }
    async executeTool(execution) {
        if (!this.isConfigured()) {
            throw new Error('Composio API key not configured');
        }
        try {
            const client = this.getClient();
            const preferredUserId = execution.userId || this.configService.get('COMPOSIO_USER_ID') || undefined;
            const toolkitSlug = this.getToolkitSlugFromToolName(execution.toolName);
            const account = toolkitSlug ? await this.resolveConnectedAccount(toolkitSlug, preferredUserId) : null;
            const userId = account?.userId || preferredUserId || 'default';
            this.logger.log(`Executing ${execution.toolName} for user ${userId}`);
            const result = await client.tools.execute(execution.toolName, {
                userId,
                ...(account?.connectedAccountId ? { connectedAccountId: account.connectedAccountId } : {}),
                arguments: execution.input,
                dangerouslySkipVersionCheck: true,
            });
            return {
                successful: !!result?.successful,
                data: result?.data ?? result,
                error: result?.error || undefined,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Composio execution error';
            this.logger.error(`Composio tool execution failed: ${execution.toolName}`, error);
            return {
                successful: false,
                error: message,
            };
        }
    }
    async webSearch(query, maxResults = 10, userId) {
        return this.executeTool({
            toolName: 'SERPAPI_SEARCH',
            userId,
            input: {
                query,
                num: Math.min(maxResults, 20),
            },
        });
    }
    async slackSendMessage(channel, text, userId) {
        const normalized = channel.startsWith('#') ? channel.slice(1) : channel;
        return this.executeTool({
            toolName: 'SLACK_SEND_MESSAGE',
            userId,
            input: {
                channel: normalized,
                text,
            },
        });
    }
    async gmailSendEmail(to, subject, body, action = 'send', userId) {
        return this.executeTool({
            toolName: action === 'draft' ? 'GMAIL_CREATE_EMAIL_DRAFT' : 'GMAIL_SEND_EMAIL',
            userId,
            input: {
                to,
                subject,
                body,
            },
        });
    }
    async listAvailableTools() {
        if (!this.isConfigured() || !this.composio)
            return [];
        try {
            const tools = await this.composio.tools.getToolsEnum();
            if (Array.isArray(tools))
                return tools;
            return tools?.items || [];
        }
        catch (error) {
            this.logger.error('Failed to list Composio tools', error);
            return [];
        }
    }
    async getConnectedAccounts(userId) {
        if (!this.isConfigured() || !this.composio)
            return [];
        try {
            const query = { limit: 100 };
            if (userId)
                query.user_ids = [userId];
            const response = await this.composio.client.connectedAccounts.list(query);
            return response.items || [];
        }
        catch (error) {
            this.logger.error('Failed to get connected accounts', error);
            return [];
        }
    }
    async isToolConnected(toolName, userId) {
        const toolkit = this.getToolkitSlugFromToolName(toolName) || toolName.toLowerCase();
        const accounts = await this.getConnectedAccounts(userId);
        return accounts.some((a) => a?.toolkit?.slug === toolkit);
    }
};
exports.ComposioService = ComposioService;
exports.ComposioService = ComposioService = ComposioService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ComposioService);
//# sourceMappingURL=composio.service.js.map