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
exports.initializeNetworkProxy = initializeNetworkProxy;
exports.getProxyDispatcher = getProxyDispatcher;
const common_1 = require("@nestjs/common");
const undici_1 = require("undici");
const net = __importStar(require("net"));
const logger = new common_1.Logger('NetworkProxy');
let proxyInitialized = false;
let proxyDispatcher;
const LOCAL_PROXY_FALLBACK = 'http://127.0.0.1:7890';
function getConfiguredProxyUrl() {
    return (process.env.AI_PROXY_URL ||
        process.env.HTTPS_PROXY ||
        process.env.HTTP_PROXY ||
        process.env.ALL_PROXY);
}
async function isLocalProxyReachable(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        const port = Number(parsed.port || 80);
        return await new Promise((resolve) => {
            const socket = net.createConnection({ host, port });
            const timer = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, 300);
            socket.on('connect', () => {
                clearTimeout(timer);
                socket.end();
                resolve(true);
            });
            socket.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }
    catch {
        return false;
    }
}
async function initializeNetworkProxy() {
    if (proxyInitialized)
        return;
    let proxyUrl = getConfiguredProxyUrl();
    if (!proxyUrl) {
        const reachable = await isLocalProxyReachable(LOCAL_PROXY_FALLBACK);
        if (reachable) {
            proxyUrl = LOCAL_PROXY_FALLBACK;
            logger.log(`Auto-detected local proxy: ${LOCAL_PROXY_FALLBACK}`);
        }
    }
    if (!proxyUrl) {
        logger.log('Proxy not configured, using direct network access');
        return;
    }
    try {
        const proxyAgent = new undici_1.ProxyAgent(proxyUrl);
        (0, undici_1.setGlobalDispatcher)(proxyAgent);
        proxyDispatcher = proxyAgent;
        proxyInitialized = true;
        logger.log(`Proxy enabled for model requests: ${proxyUrl}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown proxy setup error';
        logger.error(`Failed to initialize proxy: ${message}`);
    }
}
function getProxyDispatcher() {
    return proxyDispatcher;
}
//# sourceMappingURL=proxy.util.js.map