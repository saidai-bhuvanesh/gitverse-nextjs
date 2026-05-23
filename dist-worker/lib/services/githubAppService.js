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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubAppService = void 0;
const axios_1 = __importStar(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const rateLimit_1 = require("@/lib/utils/rateLimit");
const githubService_1 = require("@/lib/services/githubService");
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value?.trim()) {
        throw new Error(`${name} is required`);
    }
    return value;
}
function normalizePrivateKey(value) {
    return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}
function sanitizeAppError(error) {
    if ((0, axios_1.isAxiosError)(error) && error.config) {
        const safeConfig = {
            ...error.config,
            headers: error.config.headers
                ? {
                    ...error.config.headers,
                    Authorization: "[REDACTED]",
                }
                : error.config.headers,
        };
        error.config = safeConfig;
    }
    return error;
}
class GitHubAppService {
    appId;
    privateKey;
    constructor(opts) {
        this.appId = opts?.appId || getRequiredEnv("GITHUB_APP_ID");
        this.privateKey = normalizePrivateKey(opts?.privateKey || getRequiredEnv("GITHUB_APP_PRIVATE_KEY"));
    }
    createAppJwt() {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iat: now - 60,
            exp: now + 9 * 60,
            iss: this.appId,
        };
        return jsonwebtoken_1.default.sign(payload, this.privateKey, { algorithm: "RS256" });
    }
    async getInstallationAccessToken(installationId) {
        if (!Number.isFinite(installationId)) {
            throw new Error("installationId must be a number");
        }
        const appJwt = this.createAppJwt();
        try {
            return await (0, rateLimit_1.withRetry)(async () => {
                const response = await axios_1.default.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
                    headers: {
                        Authorization: `Bearer ${appJwt}`,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                });
                const token = response.data?.token;
                if (!token) {
                    throw new Error("Failed to obtain installation access token");
                }
                return token;
            }, {
                maxRetries: 3,
                onRetry: (attempt, _err, delayMs) => {
                    console.warn(`[GitHubAppService] Retrying access token fetch for installation ${installationId} (attempt ${attempt}) in ${delayMs}ms`);
                }
            });
        }
        catch (err) {
            if ((0, axios_1.isAxiosError)(err) && err.response?.status === 429) {
                throw new githubService_1.GitHubRateLimitError((0, rateLimit_1.extractRetryAfter)(err) ?? 60);
            }
            throw sanitizeAppError(err);
        }
    }
    async uninstallInstallation(installationId) {
        if (!Number.isFinite(installationId)) {
            throw new Error("installationId must be a number");
        }
        const appJwt = this.createAppJwt();
        try {
            await (0, rateLimit_1.withRetry)(async () => {
                await axios_1.default.delete(`https://api.github.com/app/installations/${installationId}`, {
                    headers: {
                        Authorization: `Bearer ${appJwt}`,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                });
            }, {
                maxRetries: 3,
                onRetry: (attempt, _err, delayMs) => {
                    console.warn(`[GitHubAppService] Retrying uninstall for installation ${installationId} (attempt ${attempt}) in ${delayMs}ms`);
                }
            });
        }
        catch (err) {
            if ((0, axios_1.isAxiosError)(err) && err.response?.status === 429) {
                throw new githubService_1.GitHubRateLimitError((0, rateLimit_1.extractRetryAfter)(err) ?? 60);
            }
            throw sanitizeAppError(err);
        }
    }
}
exports.GitHubAppService = GitHubAppService;
