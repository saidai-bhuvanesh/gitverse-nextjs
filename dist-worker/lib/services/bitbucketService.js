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
exports.bitbucketService = exports.BitbucketService = exports.BitbucketRateLimitError = void 0;
const axios_1 = __importStar(require("axios"));
const rateLimit_1 = require("@/lib/utils/rateLimit");
class BitbucketRateLimitError extends Error {
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super(retryAfterSeconds > 0
            ? `Bitbucket API rate limit reached. Please retry after ${retryAfterSeconds} seconds.`
            : 'Bitbucket API rate limit reached. Please try again later.');
        this.name = 'BitbucketRateLimitError';
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.BitbucketRateLimitError = BitbucketRateLimitError;
function sanitizeBitbucketError(error) {
    if ((0, axios_1.isAxiosError)(error) && error.config) {
        const safeConfig = {
            ...error.config,
            headers: error.config.headers
                ? {
                    ...error.config.headers,
                    Authorization: '[REDACTED]',
                }
                : error.config.headers,
        };
        error.config = safeConfig;
    }
    return error;
}
class BitbucketService {
    client;
    token;
    constructor(token) {
        this.token = token;
        this.client = axios_1.default.create({
            baseURL: 'https://api.bitbucket.org/2.0',
            headers: {
                Accept: 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        });
        this.client.interceptors.response.use((response) => response, async (error) => {
            if (!(0, axios_1.isAxiosError)(error) || !error.config) {
                throw sanitizeBitbucketError(error);
            }
            const status = error.response?.status;
            const config = error.config;
            config.retryCount = config.retryCount || 0;
            if (status === 429) {
                if (config.retryCount >= 3) {
                    const retryAfterHeader = error.response?.headers?.['retry-after'];
                    const retrySeconds = retryAfterHeader
                        ? Math.max(1, parseInt(retryAfterHeader, 10))
                        : 60;
                    throw new BitbucketRateLimitError(retrySeconds);
                }
                config.retryCount += 1;
                const delayMs = (0, rateLimit_1.getRetryDelayMs)(error, config.retryCount) ?? 1000;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                return this.client(config);
            }
            const retryableCodes = [502, 503, 504];
            if ((status && retryableCodes.includes(status)) ||
                error.code === 'ECONNABORTED' ||
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT' ||
                !error.response) {
                if (config.retryCount < 3) {
                    config.retryCount += 1;
                    const backoff = Math.pow(2, config.retryCount) * 1000 + Math.random() * 1000;
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                    return this.client(config);
                }
            }
            throw sanitizeBitbucketError(error);
        });
    }
    /**
     * Get authenticated user
     */
    async getAuthenticatedUser() {
        if (!this.token) {
            throw new Error('Bitbucket token required for authentication');
        }
        const response = await this.client.get('/user');
        return response.data;
    }
    /**
     * Get repository
     */
    async getRepository(workspace, repoSlug) {
        const response = await this.client.get(`/repositories/${workspace}/${repoSlug}`);
        return response.data;
    }
    /**
     * List user repositories
     */
    async listUserRepositories(params) {
        const response = await this.client.get('/repositories', {
            params: {
                pagelen: params?.per_page || 20,
                page: params?.page || 1,
            },
        });
        return response.data;
    }
    /**
     * Parse Bitbucket URL
     */
    static parseBitbucketUrl(url) {
        const patterns = [
            /bitbucket\.org\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /bitbucket\.org\/([^\/]+)\/([^\/]+)/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    workspace: match[1],
                    repoSlug: match[2].replace(/\.git$/, ''),
                };
            }
        }
        return null;
    }
    /**
     * Validate token
     */
    async validateToken() {
        try {
            await this.getAuthenticatedUser();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.BitbucketService = BitbucketService;
exports.bitbucketService = new BitbucketService();
