"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('database', () => ({
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-team',
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
}));
//# sourceMappingURL=database.config.js.map