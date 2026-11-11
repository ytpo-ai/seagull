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
exports.encodeUserContext = encodeUserContext;
exports.decodeUserContext = decodeUserContext;
exports.signEncodedContext = signEncodedContext;
exports.verifyEncodedContext = verifyEncodedContext;
const crypto = __importStar(require("crypto"));
function encodeUserContext(context) {
    return Buffer.from(JSON.stringify(context)).toString('base64url');
}
function decodeUserContext(encoded) {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString());
}
function signEncodedContext(encoded, secret) {
    return crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}
function verifyEncodedContext(encoded, signature, secret) {
    const expected = signEncodedContext(encoded, secret);
    return expected === signature;
}
//# sourceMappingURL=context-signature.util.js.map