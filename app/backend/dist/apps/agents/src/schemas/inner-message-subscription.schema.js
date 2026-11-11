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
exports.InnerMessageSubscriptionSchema = exports.InnerMessageSubscription = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
let InnerMessageSubscription = class InnerMessageSubscription {
};
exports.InnerMessageSubscription = InnerMessageSubscription;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], InnerMessageSubscription.prototype, "subscriptionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], InnerMessageSubscription.prototype, "subscriberAgentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], InnerMessageSubscription.prototype, "eventType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], InnerMessageSubscription.prototype, "filters", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], InnerMessageSubscription.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], InnerMessageSubscription.prototype, "source", void 0);
exports.InnerMessageSubscription = InnerMessageSubscription = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'inner_message_subscriptions' })
], InnerMessageSubscription);
exports.InnerMessageSubscriptionSchema = mongoose_1.SchemaFactory.createForClass(InnerMessageSubscription);
exports.InnerMessageSubscriptionSchema.index({ subscriberAgentId: 1, isActive: 1, createdAt: -1 });
exports.InnerMessageSubscriptionSchema.index({ eventType: 1, isActive: 1, createdAt: -1 });
exports.InnerMessageSubscriptionSchema.index({ subscriberAgentId: 1, eventType: 1 }, { unique: true });
//# sourceMappingURL=inner-message-subscription.schema.js.map