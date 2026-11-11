"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var SkillDocLoaderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillDocLoaderService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const fs_2 = require("fs");
const path = __importStar(require("path"));
let SkillDocLoaderService = SkillDocLoaderService_1 = class SkillDocLoaderService {
    constructor() {
        this.logger = new common_1.Logger(SkillDocLoaderService_1.name);
    }
    resolveWorkspaceRoot() {
        const cwd = process.cwd();
        const candidates = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')];
        for (const candidate of candidates) {
            const docsPath = path.join(candidate, 'docs');
            if ((0, fs_2.existsSync)(docsPath)) {
                return candidate;
            }
        }
        return cwd;
    }
    resolveSkillDocsDir() {
        const root = this.resolveWorkspaceRoot();
        const configuredDir = process.env.SKILL_DOCS_DIR?.trim();
        if (!configuredDir) {
            return path.join(root, 'docs', 'skill');
        }
        return path.resolve(path.isAbsolute(configuredDir) ? configuredDir : path.join(root, configuredDir));
    }
    async loadDocs() {
        const docsDir = this.resolveSkillDocsDir();
        if (!(0, fs_2.existsSync)(docsDir)) {
            this.logger.warn(`Skill docs directory does not exist: ${docsDir}`);
            return [];
        }
        const entries = await fs_1.promises.readdir(docsDir, { withFileTypes: true });
        const markdownFiles = entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
            .map((entry) => path.join(docsDir, entry.name))
            .sort((left, right) => left.localeCompare(right));
        const loaded = [];
        for (const filePath of markdownFiles) {
            const parsed = await this.parseSkillDoc(filePath);
            if (parsed) {
                loaded.push(parsed);
            }
        }
        return loaded;
    }
    async parseSkillDoc(filePath) {
        try {
            const raw = await fs_1.promises.readFile(filePath, 'utf8');
            const { frontmatter, content } = this.splitFrontmatter(raw);
            const doc = this.toLoadedSkillDoc(filePath, frontmatter, content);
            return doc;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to parse skill doc ${filePath}: ${message}`);
            return null;
        }
    }
    splitFrontmatter(raw) {
        const normalized = raw.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        if (lines[0]?.trim() !== '---') {
            return { frontmatter: {}, content: normalized.trim() };
        }
        let closingIndex = -1;
        for (let i = 1; i < lines.length; i += 1) {
            if (lines[i].trim() === '---') {
                closingIndex = i;
                break;
            }
        }
        if (closingIndex < 0) {
            return { frontmatter: {}, content: normalized.trim() };
        }
        const frontmatterLines = lines.slice(1, closingIndex);
        const contentLines = lines.slice(closingIndex + 1);
        return {
            frontmatter: this.parseYamlLike(frontmatterLines),
            content: contentLines.join('\n').trim(),
        };
    }
    parseYamlLike(lines) {
        const normalized = lines.map((line) => line.replace(/\t/g, '  '));
        const { value } = this.parseBlock(normalized, 0, 0);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
    parseBlock(lines, start, indent) {
        let index = start;
        while (index < lines.length) {
            const line = lines[index];
            if (!line.trim() || line.trimStart().startsWith('#')) {
                index += 1;
                continue;
            }
            const lineIndent = this.countIndent(line);
            if (lineIndent < indent) {
                return { value: {}, nextIndex: index };
            }
            if (line.trimStart().startsWith('- ')) {
                return this.parseArray(lines, index, indent);
            }
            return this.parseObject(lines, index, indent);
        }
        return { value: {}, nextIndex: index };
    }
    parseObject(lines, start, indent) {
        const result = {};
        let index = start;
        while (index < lines.length) {
            const line = lines[index];
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                index += 1;
                continue;
            }
            const lineIndent = this.countIndent(line);
            if (lineIndent < indent)
                break;
            if (lineIndent > indent) {
                index += 1;
                continue;
            }
            if (trimmed.startsWith('- '))
                break;
            const separator = trimmed.indexOf(':');
            if (separator <= 0) {
                index += 1;
                continue;
            }
            const key = trimmed.slice(0, separator).trim();
            const rest = trimmed.slice(separator + 1).trim();
            if (!rest) {
                const nested = this.parseBlock(lines, index + 1, indent + 2);
                result[key] = nested.value;
                index = nested.nextIndex;
                continue;
            }
            result[key] = this.parseScalar(rest);
            index += 1;
        }
        return { value: result, nextIndex: index };
    }
    parseArray(lines, start, indent) {
        const result = [];
        let index = start;
        while (index < lines.length) {
            const line = lines[index];
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                index += 1;
                continue;
            }
            const lineIndent = this.countIndent(line);
            if (lineIndent < indent)
                break;
            if (lineIndent > indent) {
                index += 1;
                continue;
            }
            if (!trimmed.startsWith('- '))
                break;
            const rest = trimmed.slice(2).trim();
            if (!rest) {
                const nested = this.parseBlock(lines, index + 1, indent + 2);
                result.push(nested.value);
                index = nested.nextIndex;
                continue;
            }
            const inlineSeparator = rest.indexOf(': ');
            if (inlineSeparator > 0) {
                const key = rest.slice(0, inlineSeparator).trim();
                const valuePart = rest.slice(inlineSeparator + 2).trim();
                const item = {};
                if (valuePart) {
                    item[key] = this.parseScalar(valuePart);
                    const tail = this.parseObject(lines, index + 1, indent + 2);
                    result.push({ ...item, ...tail.value });
                    index = tail.nextIndex;
                    continue;
                }
                const nested = this.parseBlock(lines, index + 1, indent + 2);
                item[key] = nested.value;
                result.push(item);
                index = nested.nextIndex;
                continue;
            }
            result.push(this.parseScalar(rest));
            index += 1;
        }
        return { value: result, nextIndex: index };
    }
    parseScalar(value) {
        const normalized = value.trim();
        if (!normalized.length)
            return '';
        if ((normalized.startsWith('"') && normalized.endsWith('"')) ||
            (normalized.startsWith("'") && normalized.endsWith("'"))) {
            return normalized.slice(1, -1);
        }
        if (normalized === 'true')
            return true;
        if (normalized === 'false')
            return false;
        if (normalized === 'null')
            return null;
        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
            return Number(normalized);
        }
        return normalized;
    }
    countIndent(line) {
        const match = line.match(/^\s*/);
        return match ? match[0].length : 0;
    }
    toLoadedSkillDoc(filePath, frontmatter, content) {
        const contentHash = content ? (0, crypto_1.createHash)('sha256').update(content).digest('hex') : undefined;
        const metadata = frontmatter.metadata && typeof frontmatter.metadata === 'object'
            ? { ...frontmatter.metadata }
            : {};
        const tags = this.normalizeStringArray(frontmatter.tags)
            || this.normalizeStringArray(metadata.tags)
            || undefined;
        return {
            filePath,
            slug: this.normalizeOptionalString(frontmatter.slug),
            name: this.normalizeOptionalString(frontmatter.name),
            description: this.normalizeOptionalString(frontmatter.description),
            category: this.normalizeOptionalString(frontmatter.category),
            tags,
            sourceType: this.normalizeSourceType(frontmatter.sourceType),
            sourceUrl: this.normalizeOptionalString(frontmatter.sourceUrl),
            provider: this.normalizeOptionalString(frontmatter.provider),
            version: this.normalizeOptionalString(frontmatter.version),
            status: this.normalizeStatus(frontmatter.status),
            confidenceScore: this.normalizeOptionalNumber(frontmatter.confidenceScore),
            discoveredBy: this.normalizeOptionalString(frontmatter.discoveredBy),
            metadata,
            content: content || undefined,
            contentType: this.normalizeOptionalString(frontmatter.contentType) || 'text/markdown',
            contentHash,
            contentSize: content ? Buffer.byteLength(content, 'utf8') : 0,
        };
    }
    normalizeOptionalString(value) {
        if (typeof value !== 'string')
            return undefined;
        const normalized = value.trim();
        return normalized.length ? normalized : undefined;
    }
    normalizeOptionalNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) {
            return Number(value.trim());
        }
        return undefined;
    }
    normalizeStringArray(value) {
        if (!Array.isArray(value))
            return undefined;
        const normalized = value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean);
        return normalized.length ? Array.from(new Set(normalized)) : undefined;
    }
    normalizeSourceType(value) {
        if (value !== 'manual' && value !== 'github' && value !== 'web' && value !== 'internal') {
            return undefined;
        }
        return value;
    }
    normalizeStatus(value) {
        if (value !== 'active' && value !== 'experimental' && value !== 'deprecated' && value !== 'disabled') {
            return undefined;
        }
        return value;
    }
};
exports.SkillDocLoaderService = SkillDocLoaderService;
exports.SkillDocLoaderService = SkillDocLoaderService = SkillDocLoaderService_1 = __decorate([
    (0, common_1.Injectable)()
], SkillDocLoaderService);
//# sourceMappingURL=skill-doc-loader.service.js.map