import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/api-auth";
import { getGeminiService } from "@/lib/services/geminiService";
import { repositoryService } from "@/lib/services/repositoryService";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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

    const { repositoryId, type } = body;

    if (repositoryId === undefined || repositoryId === null || type === undefined || type === null) {
      return NextResponse.json(
        { error: "Repository ID and analysis type are required" },
        { status: 400 }
      );
    }

    const parsedRepositoryId = Number(repositoryId);
    if (!Number.isInteger(parsedRepositoryId) || parsedRepositoryId <= 0) {
      return NextResponse.json(
        { error: "Repository ID must be a positive integer" },
        { status: 400 }
      );
    }

    if (typeof type !== "string" || !type.trim()) {
      return NextResponse.json(
        { error: "Analysis type must be a non-empty string" },
        { status: 400 }
      );
    }

    const validAnalysisTypes = ["overview", "code-quality", "security", "architecture", "suggestions"];
    if (!validAnalysisTypes.includes(type)) {
      return NextResponse.json(
        { error: "Analysis type must be one of: overview, code-quality, security, architecture, suggestions" },
        { status: 400 }
      );
    }

    const user = await requireAuth(request);

    console.log("[RunAnalysis] Started", {
      user: "authenticated",
      repositoryId: parsedRepositoryId,
      type,
    });

    const repository = await repositoryService.getRepository(
      parsedRepositoryId,
      user.userId
    );

    if (!repository) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Build lightweight context (efficiency improvement)
    const context = {
      languages: repository.languages?.map((l: any) => ({
        name: l.name,
        percentage: l.percentage,
      })) || [],

      contributors: repository.contributors?.map((c: any) => ({
        name: c.name,
        commits: c.commits,
      })) || [],

      commits: repository.commits?.slice(0, 10).map((c: any) => ({
        message: c.message,
        author: c.authorName,
        date: c.committedAt?.toISOString(),
      })) || [],
    };

    console.log("[RunAnalysis] Context prepared", {
      languages: context.languages.length,
      contributors: context.contributors.length,
      commits: context.commits.length,
    });

    // Timeout safety for Vercel (important improvement)
    const analysisPromise = getGeminiService().analyzeRepository({
      repositoryId: parsedRepositoryId,
      type: type as "overview" | "code-quality" | "security" | "architecture" | "suggestions",
      context,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Analysis timeout exceeded")), 25000)
    );

    const analysis = await Promise.race([
      analysisPromise,
      timeoutPromise,
    ]);

    const duration = Date.now() - startTime;

    console.log("[RunAnalysis] Completed", {
      repositoryId: parsedRepositoryId,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      analysis,
      type,
      meta: {
        duration,
        success: true,
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error("[RunAnalysis] Failed", {
      error: error?.message,
      duration: `${duration}ms`,
    });

    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to analyze repository",
        meta: {
          duration,
          success: false,
        },
      },
      { status: 500 }
    );
  }
}