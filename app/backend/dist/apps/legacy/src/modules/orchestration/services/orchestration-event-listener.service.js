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
var OrchestrationEventListenerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationEventListenerService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const orchestration_events_1 = require("../orchestration-events");
const orchestration_step_dispatcher_service_1 = require("./orchestration-step-dispatcher.service");
let OrchestrationEventListenerService = OrchestrationEventListenerService_1 = class OrchestrationEventListenerService {
    constructor(dispatcher) {
        this.dispatcher = dispatcher;
        this.logger = new common_1.Logger(OrchestrationEventListenerService_1.name);
    }
    async handleAdvanceRequested(event) {
        const planId = String(event?.planId || '').trim();
        if (!planId) {
            return;
        }
        try {
            await this.dispatcher.advanceOnce(planId, {
                source: event.source,
                targetPhase: event.targetPhase,
            });
        }
        catch (error) {
            this.logger.warn(`handleAdvanceRequested failed for plan ${planId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
};
exports.OrchestrationEventListenerService = OrchestrationEventListenerService;
__decorate([
    (0, event_emitter_1.OnEvent)(orchestration_events_1.ORCH_EVENTS.ADVANCE_REQUESTED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrchestrationEventListenerService.prototype, "handleAdvanceRequested", null);
exports.OrchestrationEventListenerService = OrchestrationEventListenerService = OrchestrationEventListenerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [orchestration_step_dispatcher_service_1.OrchestrationStepDispatcherService])
], OrchestrationEventListenerService);
//# sourceMappingURL=orchestration-event-listener.service.js.map