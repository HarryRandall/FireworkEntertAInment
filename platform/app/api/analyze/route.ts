import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import type {
  AnalyzerDerivedFeatures,
  AnalyzerResult,
  ShowAnalysisSnapshot,
} from "@/lib/show-analysis.types";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const INLINE_ARTIFACT_LIMIT_BYTES = 1_000_000;
const ANALYSER_SCHEMA_VERSION = "1.2.0";

const AnalyzeRequestSchema = z.object({
  showId: z.string().uuid(),
  personality: z
    .enum(["balanced", "bold", "cinematic", "elegant", "intimate", "playful"])
    .default("balanced"),
});

class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function truncate(value: string, length = 1800): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePythonExecutable(repoRoot: string): Promise<string> {
  const venvPython = path.join(
    repoRoot,
    "prototypes",
    "audio-analyser",
    ".venv",
    "bin",
    "python",
  );
  return (await pathExists(venvPython)) ? venvPython : "python3";
}

function audioExtension(audioPath: string): string {
  const ext = path.extname(audioPath).replace(/[^a-zA-Z0-9.]/g, "");
  return ext || ".mp3";
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function analysisSnapshot(params: {
  id: string;
  showId: string;
  personality: string;
  audioPath: string;
  runtimeMs: number | null;
  analysis: AnalyzerResult | null;
  derived: AnalyzerDerivedFeatures | null;
  markdown: string | null;
  errorMessage?: string | null;
  createdAt?: string;
}): ShowAnalysisSnapshot {
  return {
    id: params.id,
    showId: params.showId,
    status: params.errorMessage ? "failed" : "completed",
    schemaVersion: params.analysis?.schema_version ?? ANALYSER_SCHEMA_VERSION,
    personalityPreset: params.personality,
    sourceAudioPath: params.audioPath,
    runtimeMs: params.runtimeMs,
    errorMessage: params.errorMessage ?? null,
    createdAt: params.createdAt ?? new Date().toISOString(),
    analysis: params.analysis,
    derived: params.derived,
    markdown: params.markdown,
  };
}

async function persistLargeText(params: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  analysisId: string;
  filename: string;
  contentType: string;
  body: string;
}): Promise<{ inline: string | null; storagePath: string | null }> {
  if (Buffer.byteLength(params.body, "utf8") <= INLINE_ARTIFACT_LIMIT_BYTES) {
    return { inline: params.body, storagePath: null };
  }

  const storagePath = `${params.userId}/analyses/${params.analysisId}/${params.filename}`;
  const { error } = await params.supabase.storage
    .from("audio")
    .upload(storagePath, Buffer.from(params.body, "utf8"), {
      contentType: params.contentType,
      upsert: false,
    });
  if (error) {
    throw new AnalyzeError(
      `Could not persist analyser artifact: ${error.message}`,
      500,
    );
  }
  return { inline: null, storagePath };
}

async function markAnalysisFailed(params: {
  supabase: ReturnType<typeof createClient>;
  analysisId: string;
  runtimeMs: number;
  errorMessage: string;
}) {
  const { error } = await params.supabase
    .from("show_analyses")
    .update({
      status: "failed",
      runtime_ms: params.runtimeMs,
      error_message: truncate(params.errorMessage, 2000),
    })
    .eq("id", params.analysisId);
  if (error) {
    console.error("[api/analyze] failed to persist failure state:", error);
  }
}

export async function POST(request: Request) {
  const parsed = AnalyzeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid analyze request.", 400);
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonError("You must be signed in to analyze a show.", 401);
  }

  const { data: show, error: showError } = await supabase
    .from("shows")
    .select("id, slug, audio_path, user_id")
    .eq("id", parsed.data.showId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (showError) {
    console.error("[api/analyze] show lookup failed:", showError);
    return jsonError("Could not load show for analysis.", 500);
  }
  if (!show) return jsonError("Show not found.", 404);
  if (!show.audio_path) {
    return jsonError("This show has no uploaded audio to analyze.", 400);
  }

  const analysisId = randomUUID();
  const startedAt = Date.now();
  const { error: insertError } = await supabase.from("show_analyses").insert({
    id: analysisId,
    show_id: show.id,
    user_id: user.id,
    personality_preset: parsed.data.personality,
    source_audio_path: show.audio_path,
    status: "running",
  });
  if (insertError) {
    console.error("[api/analyze] analysis row insert failed:", insertError);
    return jsonError("Could not create analysis record.", 500);
  }

  let tempDir: string | null = null;

  try {
    const repoRoot = path.resolve(process.cwd(), "..");
    const analyserDir = path.join(repoRoot, "prototypes", "audio-analyser");
    const analyserScript = path.join(analyserDir, "showcrafter.py");
    if (!(await pathExists(analyserScript))) {
      throw new AnalyzeError(
        "ShowCrafter analyser script was not found on this server.",
        500,
      );
    }

    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from("audio")
      .download(show.audio_path);
    if (downloadError || !audioBlob) {
      throw new AnalyzeError(
        downloadError?.message || "Could not download the show audio.",
        400,
      );
    }

    tempDir = await mkdtemp(path.join(os.tmpdir(), "showcrafter-"));

    const inputPath = path.join(tempDir, `audio${audioExtension(show.audio_path)}`);
    const analysisPath = path.join(tempDir, "analysis.json");
    const markdownPath = path.join(tempDir, "analysis.md");
    const llmPath = path.join(tempDir, "llm.json");

    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
    await writeFile(inputPath, audioBuffer);

    const python = await resolvePythonExecutable(repoRoot);
    const result = await runProcess(
      python,
      [
        analyserScript,
        inputPath,
        "--analysis-out",
        analysisPath,
        "--markdown-out",
        markdownPath,
        "--llm-out",
        llmPath,
        "--personality",
        parsed.data.personality,
      ],
      { cwd: analyserDir },
    );

    if (result.code !== 0) {
      throw new AnalyzeError(
        truncate(result.stderr || result.stdout || "The analyser failed."),
        422,
      );
    }

    const [analysisText, markdown, llmText] = await Promise.all([
      readFile(analysisPath, "utf8"),
      readFile(markdownPath, "utf8"),
      readFile(llmPath, "utf8"),
    ]);
    const analysis = JSON.parse(analysisText) as AnalyzerResult;
    const llmPayload = JSON.parse(llmText) as Record<string, unknown>;
    const runtimeMs = Date.now() - startedAt;

    const [analysisArtifact, markdownArtifact] = await Promise.all([
      persistLargeText({
        supabase,
        userId: user.id,
        analysisId,
        filename: "analysis.json",
        contentType: "application/json",
        body: analysisText,
      }),
      persistLargeText({
        supabase,
        userId: user.id,
        analysisId,
        filename: "analysis.md",
        contentType: "text/markdown; charset=utf-8",
        body: markdown,
      }),
    ]);

    const { error: updateError } = await supabase
      .from("show_analyses")
      .update({
        status: "completed",
        schema_version: analysis.schema_version,
        runtime_ms: runtimeMs,
        analysis_json: analysisArtifact.inline
          ? (analysis as unknown as Json)
          : null,
        compact_payload: llmPayload as unknown as Json,
        markdown: markdownArtifact.inline,
        analysis_storage_path: analysisArtifact.storagePath,
        markdown_storage_path: markdownArtifact.storagePath,
        error_message: null,
      })
      .eq("id", analysisId);
    if (updateError) {
      throw new AnalyzeError(
        `Could not save analysis output: ${updateError.message}`,
        500,
      );
    }

    revalidatePath(`/shows/${show.slug}`);

    return NextResponse.json({
      analysisId,
      analysis,
      markdown,
      llmPayload,
      analysisRow: analysisSnapshot({
        id: analysisId,
        showId: show.id,
        personality: parsed.data.personality,
        audioPath: show.audio_path,
        runtimeMs,
        analysis,
        derived:
          typeof llmPayload.derived === "object" && llmPayload.derived !== null
            ? (llmPayload.derived as AnalyzerDerivedFeatures)
            : null,
        markdown,
      }),
    });
  } catch (error) {
    const runtimeMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    await markAnalysisFailed({
      supabase,
      analysisId,
      runtimeMs,
      errorMessage: message,
    });
    const status = error instanceof AnalyzeError ? error.status : 500;
    return jsonError(message, status);
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
