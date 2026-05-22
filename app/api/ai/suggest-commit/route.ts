import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/middleware";
import { getGeminiService } from "@/lib/services/geminiService";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request payload: body must be a JSON object" },
        { status: 400 }
      );
    }

    const { added, modified, deleted, diff } = body;

    const isStringArray = (val: any) =>
      Array.isArray(val) && val.every((item) => typeof item === "string");

    if (added !== undefined && added !== null && !isStringArray(added)) {
      return NextResponse.json(
        { error: "added must be an array of strings" },
        { status: 400 }
      );
    }

    if (modified !== undefined && modified !== null && !isStringArray(modified)) {
      return NextResponse.json(
        { error: "modified must be an array of strings" },
        { status: 400 }
      );
    }

    if (deleted !== undefined && deleted !== null && !isStringArray(deleted)) {
      return NextResponse.json(
        { error: "deleted must be an array of strings" },
        { status: 400 }
      );
    }

    if (diff !== undefined && diff !== null && typeof diff !== "string") {
      return NextResponse.json(
        { error: "diff must be a string" },
        { status: 400 }
      );
    }

    const hasAdded = Array.isArray(added) && added.length > 0;
    const hasModified = Array.isArray(modified) && modified.length > 0;
    const hasDeleted = Array.isArray(deleted) && deleted.length > 0;
    const hasDiff = typeof diff === "string" && diff.trim().length > 0;

    if (!hasAdded && !hasModified && !hasDeleted && !hasDiff) {
      return NextResponse.json(
        { error: "At least one of added, modified, deleted, or diff is required" },
        { status: 400 }
      );
    }

    await requireAuth(request);

    const suggestions = await getGeminiService().suggestCommitMessage({
      added: added || [],
      modified: modified || [],
      deleted: deleted || [],
      diff,
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("Commit suggestion error:", error);

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
