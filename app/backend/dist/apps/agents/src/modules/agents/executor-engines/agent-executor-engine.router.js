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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutorEngineRouter = void 0;
const common_1 = require("@nestjs/common");
const native_agent_executor_engine_1 = require("./native-agent-executor.engine");
const native_streaming_agent_executor_engine_1 = require("./native-streaming-agent-executor.engine");
const opencode_agent_executor_engine_1 = require("./opencode-agent-executor.engine");
const opencode_streaming_agent_executor_engine_1 = require("./opencode-streaming-agent-executor.engine");
let AgentExecutorEngineRouter = class AgentExecutorEngineRouter {
    constructor(nativeAgentExecutorEngine, nativeStreamingAgentExecutorEngine, opencodeAgentExecutorEngine, opencodeStreamingAgentExecutorEngine) {
        this.engines = [
            nativeAgentExecutorEngine,
            nativeStreamingAgentExecutorEngine,
            opencodeAgentExecutorEngine,
            opencodeStreamingAgentExecutorEngine,
        ];
    }
    resolve(mode, channel) {
        const engine = this.engines.find((item) => item.mode === mode && item.channel === channel);
        if (!engine) {
            throw new Error(`Agent executor engine not found for mode=${mode} channel=${channel}`);
        }
        return engine;
    }
};
exports.AgentExecutorEngineRouter = AgentExecutorEngineRouter;
exports.AgentExecutorEngineRouter = AgentExecutorEngineRouter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [native_agent_executor_engine_1.NativeAgentExecutorEngine,
        native_streaming_agent_executor_engine_1.NativeStreamingAgentExecutorEngine,
        opencode_agent_executor_engine_1.OpencodeAgentExecutorEngine,
        opencode_streaming_agent_executor_engine_1.OpencodeStreamingAgentExecutorEngine])
], AgentExecutorEngineRouter);
//# sourceMappingURL=agent-executor-engine.router.js.map