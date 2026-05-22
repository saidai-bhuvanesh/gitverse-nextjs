import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./auth";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export async function requireAuth(
  request: NextRequest
): Promise<{ userId: number }> {
  const authHeader = request.headers.get("authorization");
  const match = authHeader ? authHeader.match(/^bearer\s+(.+)$/i) : null;
  if (!authHeader || !match) {
    throw new HttpError("Authentication required", 401);
  }

  const token = match[1].trim();
  const payload = verifyToken(token);
  if (!payload) {
    throw new HttpError("Invalid or expired token", 401);
  }

  return { userId: payload.userId };
}

export async function getAuthUser(
  request: NextRequest
): Promise<{ userId: number } | null> {
  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}

export function badRequestResponse(message = "Bad request") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function unauthorizedResponse(message = "Authentication required") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function forbiddenResponse(message = "You do not have access to this resource") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function notFoundResponse(message = "Resource not found") {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}