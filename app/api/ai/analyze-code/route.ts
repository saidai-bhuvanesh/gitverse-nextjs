import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
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

    const { code, language, analysisType, context } = body;

    if (
      typeof code !== "string" ||
      typeof language !== "string" ||
      typeof analysisType !== "string"
    ) {
      return NextResponse.json(
        { error: "Code, language, and analysisType must be strings" },
        { status: 400 }
      );
    }

    if (!code.trim() || !language.trim() || !analysisType.trim()) {
      return NextResponse.json(
        { error: "Code, language, and analysis type are required and cannot be empty" },
        { status: 400 }
      );
    }

    if (code.length > 10000) {
      return NextResponse.json(
        { error: "Code snippet too large (max 10000 characters)" },
        { status: 400 }
      );
    }

    const validAnalysisTypes = ["explain", "improve", "bugs", "document", "refactor"];
    if (!validAnalysisTypes.includes(analysisType)) {
      return NextResponse.json(
        { error: "analysisType must be one of: explain, improve, bugs, document, refactor" },
        { status: 400 }
      );
    }

    await requireAuth(request);

    const analysis = await getGeminiService().analyzeCode({
      code,
      language,
      analysisType: analysisType as "explain" | "improve" | "bugs" | "document" | "refactor",
      context,
    });

    return NextResponse.json({ analysis, analysisType });
  } catch (error: any) {
    console.error("Code analysis error:", error);
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
