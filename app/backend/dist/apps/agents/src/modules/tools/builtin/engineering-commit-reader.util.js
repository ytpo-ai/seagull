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
exports.codeUpdatesReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
function execGit(command, cwd) {
    try {
        const output = (0, child_process_1.execSync)(command, {
            encoding: 'utf-8',
            cwd,
            maxBuffer: 10 * 1024 * 1024,
        });
        return { output };
    }
    catch (error) {
        return { output: '', error: error.message || 'Git command failed' };
    }
}
function getRecentCommits(hours, limit, cwd) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const format = '%H%n%h%n%an%n%ad%n%s%n%b%n---END---';
    const gitLogResult = execGit(`git log --since="${since}" --format="${format}" -n ${limit}`, cwd);
    if (gitLogResult.error) {
        return { commits: [], error: `GIT_ERROR: ${gitLogResult.error}. Make sure this is a git repository.` };
    }
    if (!gitLogResult.output.trim()) {
        return { commits: [] };
    }
    const commits = [];
    const commitBlocks = gitLogResult.output.split('---END---').filter((block) => block.trim());
    for (const block of commitBlocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 5)
            continue;
        const [hash, shortHash, author, date, subject, ...bodyLines] = lines;
        const body = bodyLines.join('\n').trim();
        const filesOutput = execGit(`git diff --name-only ${hash}~1..${hash}`, cwd);
        const files = filesOutput.output
            .split('\n')
            .map((f) => f.trim())
            .filter((f) => f);
        commits.push({
            hash,
            shortHash,
            author,
            date,
            subject,
            body,
            files: files.slice(0, 20),
        });
    }
    return { commits };
}
exports.codeUpdatesReader = {
    read(options = {}) {
        const { hours = 24, limit = 20, workspaceRoot } = options;
        const cwd = workspaceRoot || process.env.AGENT_WORKSPACE_ROOT || process.cwd();
        if (!fs.existsSync(cwd)) {
            return {
                commits: [],
                totalCommits: 0,
                error: `WORKSPACE_ROOT_NOT_FOUND: Directory does not exist: ${cwd}. Please check AGENT_WORKSPACE_ROOT configuration.`,
                workspaceRoot: cwd,
            };
        }
        const isGitRepo = fs.existsSync(path.join(cwd, '.git'));
        if (!isGitRepo) {
            return {
                commits: [],
                totalCommits: 0,
                error: `NOT_A_GIT_REPOSITORY: ${cwd} is not a git repository. Code updates require a valid git repository.`,
                workspaceRoot: cwd,
            };
        }
        const result = getRecentCommits(hours, limit, cwd);
        if (result.error) {
            return {
                commits: [],
                totalCommits: 0,
                error: result.error,
                workspaceRoot: cwd,
            };
        }
        return {
            commits: result.commits,
            totalCommits: result.commits.length,
            workspaceRoot: cwd,
        };
    },
};
//# sourceMappingURL=engineering-commit-reader.util.js.map