"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextContent = extractTextContent;
function extractTextContent(content) {
    if (typeof content === 'string')
        return content;
    return content
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
}
//# sourceMappingURL=message.utils.js.map