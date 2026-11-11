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
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeDocsReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getAllMarkdownFiles(dir, baseDir) {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        if (entry.isDirectory()) {
            results.push(...getAllMarkdownFiles(fullPath, baseDir));
        }
        else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name === 'README')) {
            results.push(relativePath);
        }
    }
    return results;
}
function readMarkdownFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);
        return {
            content,
            lastModified: stats.mtime.toISOString(),
        };
    }
    catch {
        return null;
    }
}
function extractFocusKeywords(focus) {
    const normalized = focus.trim().toLowerCase();
    if (!normalized) {
        return [];
    }
    const keywords = new Set();
    keywords.add(normalized);
    const parts = normalized.split(/[^a-z0-9\u4e00-\u9fa5]+/i).filter(Boolean);
    for (const part of parts) {
        const hasChinese = /[\u4e00-\u9fa5]/.test(part);
        if (hasChinese && part.length >= 2) {
            keywords.add(part);
            continue;
        }
        if (!hasChinese && part.length >= 3) {
            keywords.add(part);
        }
    }
    return Array.from(keywords);
}
function getFilePriority(file) {
    const normalized = file.toLowerCase();
    if (normalized === 'readme.md' || normalized === 'readme')
        return 0;
    if (normalized.startsWith('features/'))
        return 1;
    if (normalized.startsWith('architecture/'))
        return 2;
    if (normalized.startsWith('api/'))
        return 3;
    if (normalized.startsWith('plan/'))
        return 4;
    if (normalized.startsWith('development/'))
        return 5;
    if (normalized.startsWith('technical/'))
        return 6;
    return 7;
}
function sortByPriority(files) {
    return [...files].sort((a, b) => {
        const scoreA = getFilePriority(a);
        const scoreB = getFilePriority(b);
        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }
        return a.localeCompare(b);
    });
}
exports.codeDocsReader = {
    read(options = {}) {
        const { focus, maxFiles = 20, workspaceRoot } = options;
        const root = workspaceRoot || process.env.AGENT_WORKSPACE_ROOT || process.cwd();
        const docsDir = path.resolve(root, 'docs');
        if (!fs.existsSync(root)) {
            return {
                files: [],
                totalFiles: 0,
                errorType: 'WORKSPACE_ROOT_NOT_FOUND',
                error: `WORKSPACE_ROOT_NOT_FOUND: Workspace root does not exist: ${root}. Please ensure AGENT_WORKSPACE_ROOT is set to a valid directory path.`,
                workspaceRoot: root,
                matchMode: 'none',
                focusMatchedCount: 0,
            };
        }
        if (!fs.existsSync(docsDir)) {
            return {
                files: [],
                totalFiles: 0,
                errorType: 'DOCS_DIRECTORY_NOT_FOUND',
                error: `DOCS_DIRECTORY_NOT_FOUND: docs/ directory not found at ${docsDir}. Check if the path is correct or if AGENT_WORKSPACE_ROOT is set properly. Current root: ${root}`,
                workspaceRoot: root,
                matchMode: 'none',
                focusMatchedCount: 0,
            };
        }
        const allFiles = getAllMarkdownFiles(docsDir, docsDir);
        if (allFiles.length === 0) {
            return {
                files: [],
                totalFiles: 0,
                errorType: 'NO_DOCS_FOUND',
                error: `NO_DOCS_FOUND: No markdown files found in ${docsDir}. The docs directory exists but contains no .md or README files.`,
                workspaceRoot: root,
                matchMode: 'none',
                focusMatchedCount: 0,
            };
        }
        let matchMode = 'all';
        let focusMatchedCount = allFiles.length;
        let fallbackApplied = false;
        let retryCount = 0;
        const loweredFocus = (focus || '').trim().toLowerCase();
        const attemptedKeywords = loweredFocus ? extractFocusKeywords(loweredFocus) : [];
        let candidateFiles = sortByPriority(allFiles);
        if (loweredFocus) {
            const pathMatches = allFiles.filter((file) => {
                const normalizedPath = file.toLowerCase();
                return attemptedKeywords.some((keyword) => normalizedPath.includes(keyword));
            });
            if (pathMatches.length > 0) {
                matchMode = 'path';
                focusMatchedCount = pathMatches.length;
                candidateFiles = sortByPriority(pathMatches);
            }
            else {
                const contentMatches = [];
                for (const file of allFiles) {
                    const fullPath = path.join(docsDir, file);
                    const result = readMarkdownFile(fullPath);
                    if (!result) {
                        continue;
                    }
                    const loweredContent = result.content.toLowerCase();
                    if (attemptedKeywords.some((keyword) => loweredContent.includes(keyword))) {
                        contentMatches.push(file);
                    }
                }
                if (contentMatches.length > 0) {
                    matchMode = 'content';
                    focusMatchedCount = contentMatches.length;
                    candidateFiles = sortByPriority(contentMatches);
                }
                else {
                    matchMode = 'fallback';
                    focusMatchedCount = 0;
                    fallbackApplied = true;
                    retryCount = 1;
                    candidateFiles = sortByPriority(allFiles);
                }
            }
        }
        const limitedFiles = candidateFiles.slice(0, maxFiles);
        const files = limitedFiles
            .map((file) => {
            const fullPath = path.join(docsDir, file);
            const result = readMarkdownFile(fullPath);
            if (!result)
                return null;
            return {
                path: file,
                ...result,
            };
        })
            .filter((f) => f !== null);
        return {
            files,
            totalFiles: allFiles.length,
            workspaceRoot: root,
            matchMode,
            focusMatchedCount,
            suggestions: ['README', 'feature', 'architecture', 'agent', 'api'],
            fallbackApplied,
            retryCount,
            attemptedKeywords,
        };
    },
};
//# sourceMappingURL=engineering-docs-reader.util.js.map