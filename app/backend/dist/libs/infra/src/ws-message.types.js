"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_SYSTEM_CHANNEL = exports.WS_PROTOCOL_VERSION = void 0;
exports.buildWsSystemChannel = buildWsSystemChannel;
exports.buildWsUserChannel = buildWsUserChannel;
exports.buildWsFeatureChannel = buildWsFeatureChannel;
exports.isWsStandardChannel = isWsStandardChannel;
exports.WS_PROTOCOL_VERSION = 'harbin.ws.v1';
exports.WS_SYSTEM_CHANNEL = 'ws:system';
function buildWsSystemChannel() {
    return exports.WS_SYSTEM_CHANNEL;
}
function buildWsUserChannel(userId) {
    return `ws:user:${String(userId || '').trim()}`;
}
function buildWsFeatureChannel(feature, entityId) {
    return `ws:feature:${String(feature || '').trim()}:${String(entityId || '').trim()}`;
}
function isWsStandardChannel(channel) {
    return String(channel || '').startsWith('ws:');
}
//# sourceMappingURL=ws-message.types.js.map