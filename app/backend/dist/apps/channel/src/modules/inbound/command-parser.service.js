"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandParserService = void 0;
const common_1 = require("@nestjs/common");
let CommandParserService = class CommandParserService {
    parse(text) {
        const rawText = String(text || '').trim();
        if (!rawText.startsWith('/')) {
            return {
                type: 'chat',
                args: { prompt: rawText },
                rawText,
            };
        }
        const [command = '', ...rest] = rawText.split(/\s+/);
        const subcommand = String(rest[0] || '').trim().toLowerCase();
        const tail = rest.slice(1).join(' ').trim();
        const commandTail = rest.join(' ').trim();
        if (command === '/help') {
            return {
                type: 'help',
                args: {},
                rawText,
            };
        }
        if (command === '/bind') {
            const tokenMatch = commandTail.match(/^token:([A-Za-z0-9_.-]+)(?:\s+.*)?$/i);
            return {
                type: 'bind',
                args: tokenMatch
                    ? {
                        token: tokenMatch[1],
                    }
                    : {
                        email: commandTail,
                    },
                rawText,
            };
        }
        if (command === '/plan') {
            if (subcommand === 'new') {
                return {
                    type: 'plan_new',
                    args: { prompt: tail },
                    rawText,
                };
            }
            if (subcommand === 'status') {
                return {
                    type: 'plan_status',
                    args: { planId: tail },
                    rawText,
                };
            }
            if (subcommand === 'cancel') {
                return {
                    type: 'plan_cancel',
                    args: { id: tail },
                    rawText,
                };
            }
            return {
                type: 'unknown_command',
                args: {},
                rawText,
            };
        }
        if (command === '/agent') {
            if (subcommand === 'chat') {
                return {
                    type: 'agent_chat',
                    args: this.parseAgentArgs(tail),
                    rawText,
                };
            }
            return {
                type: 'unknown_command',
                args: {},
                rawText,
            };
        }
        if (command === '/session') {
            if (subcommand === 'reset') {
                return {
                    type: 'session_reset',
                    args: {},
                    rawText,
                };
            }
            return {
                type: 'unknown_command',
                args: {},
                rawText,
            };
        }
        if (command === '/meeting') {
            if (subcommand === 'list') {
                return {
                    type: 'meeting_list',
                    args: {},
                    rawText,
                };
            }
            if (subcommand === 'create') {
                return {
                    type: 'meeting_create',
                    args: {
                        title: tail,
                    },
                    rawText,
                };
            }
            if (subcommand === 'join') {
                return {
                    type: 'meeting_join',
                    args: {
                        meetingId: tail,
                    },
                    rawText,
                };
            }
            if (subcommand === 'leave') {
                return {
                    type: 'meeting_leave',
                    args: {},
                    rawText,
                };
            }
            if (subcommand === 'end') {
                return {
                    type: 'meeting_end',
                    args: {},
                    rawText,
                };
            }
            return {
                type: 'unknown_command',
                args: {},
                rawText,
            };
        }
        return {
            type: 'unknown_command',
            args: {},
            rawText,
        };
    }
    parseAgentArgs(input) {
        const normalized = String(input || '').trim();
        if (!normalized) {
            return {
                agentId: '',
                prompt: '',
            };
        }
        const splitIndex = normalized.indexOf(' ');
        if (splitIndex < 0) {
            return {
                agentId: normalized,
                prompt: '',
            };
        }
        return {
            agentId: normalized.slice(0, splitIndex).trim(),
            prompt: normalized.slice(splitIndex + 1).trim(),
        };
    }
};
exports.CommandParserService = CommandParserService;
exports.CommandParserService = CommandParserService = __decorate([
    (0, common_1.Injectable)()
], CommandParserService);
//# sourceMappingURL=command-parser.service.js.map