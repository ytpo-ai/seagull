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
var RepoToolHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoToolHandler = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const engineering_docs_reader_util_1 = require("./engineering-docs-reader.util");
const engineering_commit_reader_util_1 = require("./engineering-commit-reader.util");
const builtin_tool_definitions_1 = require("../builtin-tool-definitions");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let RepoToolHandler = RepoToolHandler_1 = class RepoToolHandler {
    constructor() {
        this.logger = new common_1.Logger(RepoToolHandler_1.name);
    }
    async getCodeDocsReader(params) {
        const maxFiles = Math.max(1, Math.min(Number(params?.maxFiles || 20), 50));
        const workspaceRoot = await this.resolveWorkspaceRoot();
        const result = engineering_docs_reader_util_1.codeDocsReader.read({
            focus: params?.focus,
            maxFiles,
            workspaceRoot,
        });
        if (result.error) {
            return {
                focus: params?.focus || 'all',
                workspaceRoot,
                totalDocs: result.totalFiles,
                returnedFiles: 0,
                files: [],
                error: result.error,
                errorType: result.errorType || result.error.split(':')[0],
                matchMode: result.matchMode || 'none',
                focusMatchedCount: result.focusMatchedCount || 0,
                suggestions: result.suggestions || [],
                fallbackApplied: result.fallbackApplied || false,
                retryCount: result.retryCount || 0,
                attemptedKeywords: result.attemptedKeywords || [],
                troubleshooting: [
                    'Check if AGENT_WORKSPACE_ROOT environment variable is set correctly',
                    'Verify the docs/ directory exists in the workspace root',
                    'Ensure the agent service has been restarted after setting environment variables',
                ],
                generatedAt: new Date().toISOString(),
            };
        }
        return {
            focus: params?.focus || 'all',
            workspaceRoot,
            totalDocs: result.totalFiles,
            returnedFiles: result.files.length,
            matchMode: result.matchMode || 'all',
            focusMatchedCount: result.focusMatchedCount ?? result.files.length,
            suggestions: result.suggestions || [],
            fallbackApplied: result.fallbackApplied || false,
            retryCount: result.retryCount || 0,
            attemptedKeywords: result.attemptedKeywords || [],
            files: result.files.map((f) => ({
                path: f.path,
                lastModified: f.lastModified,
                content: f.content,
            })),
            generatedAt: new Date().toISOString(),
        };
    }
    async getCodeUpdatesReader(params) {
        const hours = Math.max(1, Math.min(Number(params?.hours || 24), 168));
        const limit = Math.max(1, Math.min(Number(params?.limit || 20), 50));
        const workspaceRoot = await this.resolveWorkspaceRoot();
        const result = engineering_commit_reader_util_1.codeUpdatesReader.read({ hours, limit, workspaceRoot });
        if (result.error) {
            return {
                hours,
                limit,
                workspaceRoot,
                totalCommits: result.totalCommits,
                commits: [],
                error: result.error,
                errorType: result.error.split(':')[0],
                troubleshooting: [
                    'Verify AGENT_WORKSPACE_ROOT points to a valid git repository',
                    'Ensure the directory contains a .git folder',
                    'Check if git is installed and accessible',
                ],
                generatedAt: new Date().toISOString(),
            };
        }
        return {
            hours,
            limit,
            workspaceRoot,
            totalCommits: result.totalCommits,
            commits: result.commits,
            generatedAt: new Date().toISOString(),
        };
    }
    async executeDocsWrite(params) {
        const workspaceRoot = await this.resolveWorkspaceRoot();
        const rawFilePath = String(params?.filePath || '').trim();
        const content = String(params?.content || '');
        const requestedMode = String(params?.mode || 'create').trim().toLowerCase();
        const overwrite = params?.overwrite === true;
        if (!rawFilePath) {
            throw new Error('docs_write requires filePath');
        }
        if (!content.trim()) {
            throw new Error('docs_write requires content');
        }
        if (path.isAbsolute(rawFilePath)) {
            throw new Error('docs_write filePath must be relative path under docs/');
        }
        const normalizedRelPath = path.posix
            .normalize(rawFilePath.replace(/\\/g, '/'))
            .replace(/^\.\//, '');
        if (normalizedRelPath.includes('..')) {
            throw new Error('docs_write does not allow path traversal');
        }
        if (!normalizedRelPath.startsWith('docs/')) {
            throw new Error('docs_write only supports docs/** paths');
        }
        if (!normalizedRelPath.endsWith('.md')) {
            throw new Error('docs_write only supports .md files');
        }
        if (!['create', 'update', 'append'].includes(requestedMode)) {
            throw new Error('docs_write mode must be one of: create, update, append');
        }
        const docsRoot = path.resolve(workspaceRoot, 'docs');
        const targetPath = path.resolve(workspaceRoot, normalizedRelPath);
        if (!(targetPath === docsRoot || targetPath.startsWith(`${docsRoot}${path.sep}`))) {
            throw new Error('docs_write target path is outside docs directory');
        }
        const existedBefore = await this.fileExists(targetPath);
        if (requestedMode === 'create' && existedBefore && !overwrite) {
            throw new Error('docs_write create mode conflict: file exists, set overwrite=true to replace it');
        }
        if (requestedMode === 'update' && !existedBefore) {
            throw new Error('docs_write update mode requires an existing file');
        }
        if (requestedMode === 'append' && !existedBefore) {
            throw new Error('docs_write append mode requires an existing file');
        }
        const parentDir = path.dirname(targetPath);
        await (0, promises_1.mkdir)(parentDir, { recursive: true });
        if (requestedMode === 'append') {
            await (0, promises_1.appendFile)(targetPath, content, 'utf8');
        }
        else {
            await (0, promises_1.writeFile)(targetPath, content, 'utf8');
        }
        return {
            success: true,
            toolId: builtin_tool_definitions_1.TOOL_ID__ENGINEERING_DOCS_WRITE,
            workspaceRoot,
            filePath: normalizedRelPath,
            mode: requestedMode,
            overwrite,
            existedBefore,
            bytesWritten: Buffer.byteLength(content, 'utf8'),
            writtenAt: new Date().toISOString(),
        };
    }
    async executeRepoWriter(params) {
        const action = String(params?.action || '').trim().toLowerCase();
        if (action !== 'git-clone') {
            throw new Error('repo_writer only supports action=git-clone');
        }
        const repoUrl = this.validateHttpsRepoUrl(params?.repoUrl);
        const workspaceRoot = await this.resolveWorkspaceRoot();
        const branch = String(params?.branch || '').trim() || 'main';
        const timeoutMs = Math.max(5000, Number(process.env.REPO_WRITER_TIMEOUT_MS || 60000));
        const maxRepoSizeMb = Math.max(0, Number(process.env.REPO_WRITER_MAX_REPO_SIZE_MB || 512));
        const repoName = path
            .basename(new URL(repoUrl).pathname)
            .replace(/\.git$/i, '')
            .trim();
        const targetDir = this.normalizeRepoWriterTargetDir(params?.targetDir || repoName);
        const dataRoot = path.resolve(workspaceRoot, 'data');
        const reposRoot = path.resolve(dataRoot, 'repos');
        const localPath = path.resolve(reposRoot, targetDir);
        this.ensureInsideDir(localPath, dataRoot, 'repo_writer target path is outside data directory');
        await (0, promises_1.mkdir)(reposRoot, { recursive: true });
        const localExists = await this.fileExists(localPath);
        const hasGitRepo = localExists ? await this.isGitRepository(localPath) : false;
        if (localExists && !hasGitRepo) {
            throw new Error('repo_writer target directory exists but is not a git repository');
        }
        if (hasGitRepo) {
            await execFileAsync('git', ['-C', localPath, 'fetch', '--depth', '1', 'origin', branch], {
                cwd: workspaceRoot,
                timeout: timeoutMs,
                maxBuffer: 5 * 1024 * 1024,
            });
            await execFileAsync('git', ['-C', localPath, 'checkout', '-B', branch, `origin/${branch}`], {
                cwd: workspaceRoot,
                timeout: timeoutMs,
                maxBuffer: 5 * 1024 * 1024,
            });
        }
        else {
            await execFileAsync('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, localPath], {
                cwd: workspaceRoot,
                timeout: timeoutMs,
                maxBuffer: 5 * 1024 * 1024,
            });
        }
        const [fileCount, repoSizeBytes] = await Promise.all([
            this.countGitTrackedFiles(localPath),
            this.getDirectorySizeBytes(localPath),
        ]);
        if (maxRepoSizeMb > 0 && repoSizeBytes > maxRepoSizeMb * 1024 * 1024) {
            if (!hasGitRepo) {
                await this.cleanupRepoDirectory(localPath);
            }
            throw new Error(`repo_writer repository size exceeds limit (${maxRepoSizeMb}MB)`);
        }
        return {
            success: true,
            toolId: builtin_tool_definitions_1.TOOL_ID__ENGINEERING_REPO_WRITER,
            action: 'git-clone',
            repoUrl,
            branch,
            localPath,
            fileCount,
            repoSizeBytes,
            updated: hasGitRepo,
            completedAt: new Date().toISOString(),
        };
    }
    async executeRepoRead(params, executionContext) {
        const allowedCommands = ['git log', 'git show', 'git diff', 'cat', 'ls', 'grep', 'head', 'tail', 'find'];
        const command = (params.command || '').trim();
        const workspaceRoot = await this.resolveWorkspaceRoot(executionContext);
        if (!command) {
            return {
                error: 'MISSING_COMMAND: No command provided',
                command: '',
                workspaceRoot,
                troubleshooting: ['Provide a valid command parameter, e.g., "git log --oneline -10" or "ls docs/"'],
            };
        }
        const isAllowed = allowedCommands.some((cmd) => command.toLowerCase().startsWith(cmd.toLowerCase()));
        if (!isAllowed) {
            return {
                error: `COMMAND_NOT_ALLOWED: "${command}" is not permitted`,
                command,
                workspaceRoot,
                allowedCommands,
                troubleshooting: [`Only read-only commands are allowed: ${allowedCommands.join(', ')}`],
            };
        }
        try {
            const [file, ...args] = this.parseCommand(command);
            const { stdout, stderr } = await execFileAsync(file, args, {
                cwd: workspaceRoot,
                maxBuffer: 5 * 1024 * 1024,
            });
            const output = stdout || stderr;
            if (!output.trim()) {
                return {
                    command,
                    workspaceRoot,
                    output: '',
                    success: true,
                    message: 'Command executed successfully but returned no output',
                };
            }
            return {
                command,
                workspaceRoot,
                output,
                success: true,
            };
        }
        catch (error) {
            return {
                command,
                workspaceRoot,
                output: '',
                success: false,
                error: `COMMAND_FAILED: ${error.message}`,
                errorDetails: error.stderr || error.stdout,
                troubleshooting: [
                    'Check if the command syntax is correct',
                    'Verify the file or directory exists',
                    'Ensure you have read permissions',
                    `Working directory: ${workspaceRoot}`,
                ],
            };
        }
    }
    parseCommand(command) {
        const parts = [];
        let current = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;
        for (const char of command) {
            if (escaped) {
                current += char;
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
                continue;
            }
            if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }
            if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
                if (current) {
                    parts.push(current);
                    current = '';
                }
                continue;
            }
            current += char;
        }
        if (escaped) {
            current += '\\';
        }
        if (current) {
            parts.push(current);
        }
        return parts;
    }
    async resolveWorkspaceRoot(executionContext) {
        const collabCtx = (executionContext?.collaborationContext || {});
        this.logger.log(`[resolveWorkspaceRoot] localProjectPath=${executionContext?.localProjectPath || '-'} projectBinding.localPath=${collabCtx?.projectBinding?.localPath || '-'} scenarioMode=${collabCtx?.scenarioMode || '-'}`);
        const contextLocalPath = String(executionContext?.localProjectPath
            || executionContext?.collaborationContext?.projectBinding?.localPath
            || '').trim();
        if (contextLocalPath) {
            if (await this.fileExists(contextLocalPath)) {
                this.logger.log(`[resolveWorkspaceRoot] using project binding localPath: ${contextLocalPath}`);
                return contextLocalPath;
            }
            this.logger.warn(`[resolveWorkspaceRoot] project binding localPath not accessible: ${contextLocalPath}, falling back`);
        }
        const envWorkspaceRoot = process.env.AGENT_WORKSPACE_ROOT;
        if (envWorkspaceRoot) {
            if (await this.fileExists(path.join(envWorkspaceRoot, 'README.md'))) {
                return envWorkspaceRoot;
            }
        }
        const candidates = [
            process.cwd(),
            path.resolve(process.cwd(), '..'),
            path.resolve(process.cwd(), '../..'),
            path.resolve(__dirname, '../../../../../../'),
        ];
        for (const candidate of candidates) {
            if ((await this.fileExists(path.join(candidate, 'README.md'))) && (await this.fileExists(path.join(candidate, 'docs')))) {
                return candidate;
            }
        }
        return process.cwd();
    }
    async fileExists(target) {
        try {
            await (0, promises_1.access)(target);
            return true;
        }
        catch {
            return false;
        }
    }
    validateHttpsRepoUrl(rawUrl) {
        const repoUrl = String(rawUrl || '').trim();
        if (!repoUrl) {
            throw new Error('repo_writer requires repoUrl');
        }
        let parsed;
        try {
            parsed = new URL(repoUrl);
        }
        catch {
            throw new Error('repo_writer repoUrl must be a valid HTTPS URL');
        }
        if (parsed.protocol !== 'https:') {
            throw new Error('repo_writer only supports HTTPS repository URLs');
        }
        return parsed.toString();
    }
    normalizeRepoWriterTargetDir(rawTargetDir) {
        const normalized = path.posix
            .normalize(String(rawTargetDir || '').trim().replace(/\\/g, '/'))
            .replace(/^\.\//, '')
            .trim();
        if (!normalized || normalized === '.' || normalized.includes('..') || path.posix.isAbsolute(normalized)) {
            throw new Error('repo_writer targetDir is invalid');
        }
        return normalized;
    }
    ensureInsideDir(targetPath, baseDir, message) {
        const resolvedBase = path.resolve(baseDir);
        const resolvedTarget = path.resolve(targetPath);
        if (!(resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${path.sep}`))) {
            throw new Error(message);
        }
    }
    async isGitRepository(targetPath) {
        return this.fileExists(path.join(targetPath, '.git'));
    }
    async countGitTrackedFiles(repoPath) {
        const { stdout } = await execFileAsync('git', ['-C', repoPath, 'ls-files'], {
            maxBuffer: 5 * 1024 * 1024,
        });
        return stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean).length;
    }
    async getDirectorySizeBytes(rootDir) {
        let total = 0;
        const stack = [rootDir];
        while (stack.length) {
            const current = stack.pop();
            if (!current)
                continue;
            const entries = await (0, promises_1.readdir)(current, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === '.git') {
                        continue;
                    }
                    stack.push(entryPath);
                    continue;
                }
                if (entry.isFile()) {
                    const fileStat = await (0, promises_1.stat)(entryPath);
                    total += fileStat.size;
                }
            }
        }
        return total;
    }
    async cleanupRepoDirectory(targetPath) {
        try {
            await (0, promises_1.rm)(targetPath, { recursive: true, force: true });
        }
        catch {
        }
    }
};
exports.RepoToolHandler = RepoToolHandler;
exports.RepoToolHandler = RepoToolHandler = RepoToolHandler_1 = __decorate([
    (0, common_1.Injectable)()
], RepoToolHandler);
//# sourceMappingURL=engineering-repo-tool-handler.service.js.map