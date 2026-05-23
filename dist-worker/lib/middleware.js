"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.isHttpError = isHttpError;
exports.requireAuth = requireAuth;
exports.getAuthUser = getAuthUser;
exports.badRequestResponse = badRequestResponse;
exports.unauthorizedResponse = unauthorizedResponse;
exports.forbiddenResponse = forbiddenResponse;
exports.notFoundResponse = notFoundResponse;
const server_1 = require("next/server");
const auth_1 = require("./auth");
class HttpError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}
exports.HttpError = HttpError;
function isHttpError(error) {
    return error instanceof HttpError;
}
async function requireAuth(request) {
    const authHeader = request.headers.get("authorization");
    const match = authHeader ? authHeader.match(/^bearer\s+(.+)$/i) : null;
    if (!authHeader || !match) {
        throw new HttpError("Authentication required", 401);
    }
    const token = match[1].trim();
    const payload = (0, auth_1.verifyToken)(token);
    if (!payload) {
        throw new HttpError("Invalid or expired token", 401);
    }
    return { userId: payload.userId };
}
async function getAuthUser(request) {
    try {
        return await requireAuth(request);
    }
    catch {
        return null;
    }
}
function badRequestResponse(message = "Bad request") {
    return new server_1.NextResponse(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
    });
}
function unauthorizedResponse(message = "Authentication required") {
    return new server_1.NextResponse(JSON.stringify({ error: message }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
    });
}
function forbiddenResponse(message = "You do not have access to this resource") {
    return new server_1.NextResponse(JSON.stringify({ error: message }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
    });
}
function notFoundResponse(message = "Resource not found") {
    return new server_1.NextResponse(JSON.stringify({ error: message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
    });
}
