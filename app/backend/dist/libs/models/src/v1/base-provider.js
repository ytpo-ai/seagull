"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAIProvider = void 0;
const contracts_1 = require("../../../contracts/src/index");
class BaseAIProvider {
    constructor(model, apiKey) {
        this.model = model;
        this.apiKey = apiKey;
    }
    async chatWithMeta(messages, options) {
        const response = await this.chat(messages, options);
        return { response };
    }
    formatMessages(messages) {
        return messages.map((msg) => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : (0, contracts_1.extractTextContent)(msg.content),
        }));
    }
    get modelInfo() {
        return this.model;
    }
}
exports.BaseAIProvider = BaseAIProvider;
//# sourceMappingURL=base-provider.js.map