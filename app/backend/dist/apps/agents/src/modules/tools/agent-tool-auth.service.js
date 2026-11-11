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
exports.AgentToolAuthService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const crypto_1 = require("crypto");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_tool_credential_schema_1 = require("../../schemas/agent-tool-credential.schema");
const agent_tool_token_revocation_schema_1 = require("../../schemas/agent-tool-token-revocation.schema");
let AgentToolAuthService = class AgentToolAuthService {
    getAuthMode() {
        const raw = String(process.env.TOOLS_AUTH_MODE || 'legacy').trim().toLowerCase();
        if (raw === 'jwt-strict' || raw === 'hybrid')
            return raw;
        return 'legacy';
    }
    isStrictPermissionEnabled() {
        const raw = String(process.env.TOOLS_AUTH_STRICT_PERMISSIONS || 'false').trim().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
    }
    constructor(credentialModel, tokenRevocationModel, agentModel) {
        this.credentialModel = credentialModel;
        this.tokenRevocationModel = tokenRevocationModel;
        this.agentModel = agentModel;
        this.tokenSecret = String(process.env.AGENT_TOOLS_JWT_SECRET || '').trim();
        this.issuer = String(process.env.AGENT_TOOLS_JWT_ISSUER || 'harbin-agents-auth').trim();
        this.audience = String(process.env.AGENT_TOOLS_JWT_AUDIENCE || 'tools-api').trim();
        this.tokenTtlSeconds = Math.max(60, Math.min(3600, Number(process.env.AGENT_TOOLS_JWT_TTL_SECONDS || 600)));
        this.credentialPepper = String(process.env.AGENT_TOOLS_CREDENTIAL_PEPPER || '').trim();
        if (!this.tokenSecret) {
            throw new Error('AGENT_TOOLS_JWT_SECRET is required');
        }
    }
    buildAgentLookupQuery(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId) {
            return { id: '' };
        }
        if (mongoose_2.Types.ObjectId.isValid(normalizedAgentId)) {
            return {
                $or: [{ id: normalizedAgentId }, { _id: new mongoose_2.Types.ObjectId(normalizedAgentId) }],
            };
        }
        return { id: normalizedAgentId };
    }
    async createCredential(input) {
        const agentId = String(input.agentId || '').trim();
        if (!agentId) {
            throw new common_1.UnauthorizedException('agentId is required');
        }
        const agent = await this.agentModel.findOne(this.buildAgentLookupQuery(agentId)).lean().exec();
        if (!agent) {
            throw new common_1.UnauthorizedException(`agent not found: ${agentId}`);
        }
        const agentSecret = `as_live_${(0, crypto_1.randomBytes)(24).toString('hex')}`;
        const keyId = `ak_live_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
        const now = new Date();
        const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
        const credential = new this.credentialModel({
            id: (0, uuid_1.v4)(),
            agentId,
            keyId,
            secretHash: this.hashSecret(agentSecret),
            status: 'active',
            label: String(input.label || '').trim() || undefined,
            createdBy: String(input.createdBy || '').trim() || undefined,
            scopeTemplate: this.normalizeScopes(input.scopeTemplate),
            expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
            lastUsedAt: now,
        });
        await credential.save();
        return {
            credentialId: credential.id,
            keyId,
            agentSecret,
            expiresAt: credential.expiresAt ? credential.expiresAt.toISOString() : undefined,
            scopeTemplate: credential.scopeTemplate || [],
        };
    }
    async revokeCredential(input) {
        const credentialId = String(input.credentialId || '').trim();
        const keyId = String(input.keyId || '').trim();
        if (!credentialId && !keyId) {
            throw new common_1.UnauthorizedException('credentialId or keyId is required');
        }
        const credential = await this.credentialModel
            .findOne(credentialId ? { id: credentialId } : { keyId })
            .exec();
        if (!credential) {
            throw new common_1.UnauthorizedException('credential not found');
        }
        credential.status = 'revoked';
        await credential.save();
        return { revoked: true };
    }
    async rotateCredential(input) {
        const credentialId = String(input.credentialId || '').trim();
        const keyId = String(input.keyId || '').trim();
        if (!credentialId && !keyId) {
            throw new common_1.UnauthorizedException('credentialId or keyId is required');
        }
        const credential = await this.credentialModel
            .findOne(credentialId ? { id: credentialId } : { keyId })
            .exec();
        if (!credential) {
            throw new common_1.UnauthorizedException('credential not found');
        }
        credential.status = 'revoked';
        credential.rotatedAt = new Date();
        await credential.save();
        return this.createCredential({
            agentId: credential.agentId,
            label: credential.label,
            createdBy: credential.createdBy,
            scopeTemplate: credential.scopeTemplate || [],
            expiresAt: input.expiresAt,
        });
    }
    async issueToken(input) {
        const keyId = String(input.agentKeyId || '').trim();
        const secret = String(input.agentSecret || '').trim();
        if (!keyId || !secret) {
            throw new common_1.UnauthorizedException('agentKeyId and agentSecret are required');
        }
        const credential = await this.credentialModel.findOne({ keyId }).exec();
        if (!credential) {
            throw new common_1.UnauthorizedException('invalid agent credentials');
        }
        if (credential.status !== 'active') {
            throw new common_1.UnauthorizedException('agent credential is not active');
        }
        if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
            credential.status = 'expired';
            await credential.save();
            throw new common_1.UnauthorizedException('agent credential expired');
        }
        if (!this.safeEqual(this.hashSecret(secret), String(credential.secretHash || ''))) {
            throw new common_1.UnauthorizedException('invalid agent credentials');
        }
        const agent = await this.agentModel.findOne(this.buildAgentLookupQuery(credential.agentId)).lean().exec();
        if (!agent || agent.isActive !== true) {
            throw new common_1.UnauthorizedException('agent not found or inactive');
        }
        const assignedScopes = this.normalizeScopes((agent.tools || []).map((toolId) => `tool:execute:${String(toolId || '').trim()}`));
        const allowedByCredential = this.normalizeScopes(credential.scopeTemplate || []);
        const requested = this.normalizeScopes(input.requestedScopes);
        const baseScopes = allowedByCredential.length ? this.intersectScopes(assignedScopes, allowedByCredential) : assignedScopes;
        const finalScopes = requested.length ? this.intersectScopes(baseScopes, requested) : baseScopes;
        if (!finalScopes.length) {
            throw new common_1.UnauthorizedException('no allowed tool scopes for this credential');
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const claims = {
            iss: this.issuer,
            aud: this.audience,
            sub: `agent:${credential.agentId}`,
            agentId: credential.agentId,
            toolScopes: finalScopes,
            permissions: Array.from(new Set((agent.permissions || []).map((item) => String(item || '').trim()).filter(Boolean))),
            jti: (0, uuid_1.v4)(),
            iat: nowSec,
            exp: nowSec + this.tokenTtlSeconds,
            originSessionId: String(input.originSessionId || '').trim() || undefined,
        };
        credential.lastUsedAt = new Date();
        await credential.save();
        return {
            accessToken: this.sign(claims),
            tokenType: 'Bearer',
            expiresIn: this.tokenTtlSeconds,
            scope: finalScopes.join(' '),
        };
    }
    async revokeToken(input) {
        const jti = String(input.jti || '').trim();
        const token = String(input.token || '').trim();
        let claims = null;
        if (!jti) {
            if (!token) {
                throw new common_1.UnauthorizedException('token or jti is required');
            }
            claims = await this.verifyToken(token);
        }
        const resolvedJti = jti || String(claims?.jti || '').trim();
        const resolvedAgentId = String(input.agentId || claims?.agentId || '').trim();
        const resolvedExp = input.expiresAt
            ? new Date(input.expiresAt)
            : claims?.exp
                ? new Date(claims.exp * 1000)
                : new Date(Date.now() + this.tokenTtlSeconds * 1000);
        if (!resolvedJti || !resolvedAgentId || Number.isNaN(resolvedExp.getTime())) {
            throw new common_1.UnauthorizedException('invalid token revocation payload');
        }
        await this.tokenRevocationModel
            .updateOne({ jti: resolvedJti }, {
            $set: {
                jti: resolvedJti,
                agentId: resolvedAgentId,
                reason: String(input.reason || '').trim() || 'revoked',
                expiresAt: resolvedExp,
            },
        }, { upsert: true })
            .exec();
        return { revoked: true, jti: resolvedJti, agentId: resolvedAgentId };
    }
    async verifyToken(token) {
        const payload = this.verify(token);
        if (!payload || typeof payload !== 'object') {
            throw new common_1.UnauthorizedException('invalid token payload');
        }
        const claims = payload;
        if (claims.iss !== this.issuer) {
            throw new common_1.UnauthorizedException('invalid token issuer');
        }
        if (claims.aud !== this.audience) {
            throw new common_1.UnauthorizedException('invalid token audience');
        }
        if (!claims.agentId) {
            throw new common_1.UnauthorizedException('invalid token subject');
        }
        const nowSec = Math.floor(Date.now() / 1000);
        if (!claims.exp || claims.exp <= nowSec) {
            throw new common_1.UnauthorizedException('token expired');
        }
        const revoked = await this.tokenRevocationModel.findOne({ jti: claims.jti }).select({ _id: 1 }).lean().exec();
        if (revoked) {
            throw new common_1.UnauthorizedException('token revoked');
        }
        claims.toolScopes = this.normalizeScopes(claims.toolScopes);
        claims.permissions = Array.from(new Set((claims.permissions || []).map((item) => String(item || '').trim()).filter(Boolean)));
        return claims;
    }
    normalizeScopes(scopes) {
        return Array.from(new Set((Array.isArray(scopes) ? scopes : [])
            .map((scope) => String(scope || '').trim())
            .filter((scope) => scope.startsWith('tool:execute:') || scope === 'tool:execute:*')));
    }
    intersectScopes(base, other) {
        const baseSet = new Set(base);
        if (baseSet.has('tool:execute:*')) {
            return other.length ? other : ['tool:execute:*'];
        }
        const hasWildcard = other.includes('tool:execute:*');
        if (hasWildcard) {
            return base;
        }
        return other.filter((scope) => baseSet.has(scope));
    }
    hashSecret(secret) {
        return (0, crypto_1.createHmac)('sha256', this.credentialPepper).update(secret).digest('hex');
    }
    safeEqual(a, b) {
        const aBuffer = Buffer.from(String(a || ''), 'utf8');
        const bBuffer = Buffer.from(String(b || ''), 'utf8');
        if (aBuffer.length !== bBuffer.length) {
            return false;
        }
        return (0, crypto_1.timingSafeEqual)(aBuffer, bBuffer);
    }
    sign(payload) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = (0, crypto_1.createHmac)('sha256', this.tokenSecret).update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }
    verify(token) {
        const parts = String(token || '').split('.');
        if (parts.length !== 3) {
            throw new common_1.UnauthorizedException('invalid token format');
        }
        const [encodedHeader, encodedPayload, signature] = parts;
        const expected = (0, crypto_1.createHmac)('sha256', this.tokenSecret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');
        if (!this.safeEqual(signature, expected)) {
            throw new common_1.UnauthorizedException('invalid token signature');
        }
        try {
            const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
            if (header.alg !== 'HS256' || header.typ !== 'JWT') {
                throw new common_1.UnauthorizedException('invalid token header');
            }
            return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        }
        catch {
            throw new common_1.UnauthorizedException('invalid token payload');
        }
    }
};
exports.AgentToolAuthService = AgentToolAuthService;
exports.AgentToolAuthService = AgentToolAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_tool_credential_schema_1.AgentToolCredential.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_tool_token_revocation_schema_1.AgentToolTokenRevocation.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AgentToolAuthService);
//# sourceMappingURL=agent-tool-auth.service.js.map