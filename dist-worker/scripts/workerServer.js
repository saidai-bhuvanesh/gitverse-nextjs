"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const analysisWorker_1 = require("./analysisWorker");
const port = Number(process.env.PORT || "8080");
function startHealthServer() {
    const server = http_1.default.createServer((req, res) => {
        // health endpoints
        if (req.url === "/" || req.url === "/healthz" || req.url === "/readyz") {
            res.statusCode = 200;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("ok");
            return;
        }
        // Control endpoint: start a worker run with validated input
        if (req.method === "POST" && req.url === "/run") {
            (async () => {
                try {
                    const ct = String(req.headers["content-type"] || "").toLowerCase();
                    if (!ct.startsWith("application/json")) {
                        res.statusCode = 400;
                        res.setHeader("content-type", "application/json; charset=utf-8");
                        res.end(JSON.stringify({ error: "Content-Type must be application/json" }));
                        return;
                    }
                    let body = "";
                    for await (const chunk of req) {
                        body += chunk;
                        if (body.length > 1_000_000)
                            break; // guard
                    }
                    let parsed;
                    try {
                        parsed = body ? JSON.parse(body) : {};
                    }
                    catch (e) {
                        res.statusCode = 400;
                        res.setHeader("content-type", "application/json; charset=utf-8");
                        res.end(JSON.stringify({ error: "Invalid JSON body" }));
                        return;
                    }
                    const { ok, errors, opts } = validateRunOptions(parsed);
                    if (!ok) {
                        res.statusCode = 400;
                        res.setHeader("content-type", "application/json; charset=utf-8");
                        res.end(JSON.stringify({ error: errors.join("; ") }));
                        return;
                    }
                    // Start the worker loop in background. Do not expose internal errors to clients.
                    void (0, analysisWorker_1.startAnalysisWorkerLoop)(opts).catch((e) => console.error("/run: failed to start worker loop", e));
                    res.statusCode = 202;
                    res.setHeader("content-type", "application/json; charset=utf-8");
                    res.end(JSON.stringify({ status: "started" }));
                    return;
                }
                catch (e) {
                    // Unexpected server error: return generic message without stack
                    console.error("/run: unexpected error", e);
                    res.statusCode = 500;
                    res.setHeader("content-type", "application/json; charset=utf-8");
                    res.end(JSON.stringify({ error: "internal server error" }));
                    return;
                }
            })();
            return;
        }
        res.statusCode = 404;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("not found");
    });
    server.listen(port, () => {
        console.log(`worker health server listening on :${port}`);
    });
}
function validateRunOptions(input) {
    const errors = [];
    const opts = {};
    if (input == null || typeof input !== "object") {
        errors.push("body must be a JSON object");
        return { ok: false, errors };
    }
    if ("workerId" in input) {
        if (typeof input.workerId !== "string" || input.workerId.trim() === "") {
            errors.push("workerId must be a non-empty string");
        }
        else {
            opts.workerId = input.workerId.trim();
        }
    }
    if ("once" in input) {
        if (typeof input.once !== "boolean")
            errors.push("once must be a boolean");
        else
            opts.once = input.once;
    }
    const intFields = [
        "pollIntervalMs",
        "heartbeatIntervalMs",
        "lockMs",
    ];
    for (const f of intFields) {
        if (f in input) {
            const n = Number(input[f]);
            if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
                errors.push(`${f} must be a positive integer`);
            }
            else {
                opts[f] = n;
            }
        }
    }
    return { ok: errors.length === 0, errors, opts };
}
async function main() {
    startHealthServer();
    // Run worker loop indefinitely.
    await (0, analysisWorker_1.startAnalysisWorkerLoop)();
}
main().catch((e) => {
    console.error("worker-server fatal:", e);
    process.exit(1);
});
