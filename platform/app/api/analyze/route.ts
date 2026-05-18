import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import type {
  AnalyzerResult,
  ShowAnalysisSnapshot,
} from "@/lib/show-analysis.types";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYSER_SCHEMA_VERSION = "1.2.0";
const ANALYSER_RUNNER_VERSION = "local-librosa-1";

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
type ShowAnalysisInsert = Database["public"]["Tables"]["show_analyses"]["Insert"];
type ShowAnalysisInsertPayload = ShowAnalysisInsert & {
  personality_preset?: string;
  source_audio_path?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function supabaseErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : null;
}

function shouldRetryWithLegacyAnalysisColumns(error: unknown): boolean {
  const message = supabaseErrorMessage(error)?.toLowerCase() ?? "";
  return (
    message.includes("source_audio_path") ||
    message.includes("personality_preset")
  );
}

function truncate(value: string, length = 1800): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}

function isJsonObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripFireworkRecommendationsFromAnalysis(
  analysis: AnalyzerResult,
): AnalyzerResult {
  const songAnalysis: AnalyzerResult = { ...analysis };
  delete songAnalysis.firework_cues;
  return songAnalysis;
}

function stripCueCountsFromSections(sections: Json | undefined): Json | undefined {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!isJsonObject(section)) return section;
    const songSection = { ...section };
    delete songSection.cue_counts;
    return songSection as Json;
  }) as Json;
}

function stripFireworkRecommendationsFromPayload(payload: Json): Json {
  if (!isJsonObject(payload)) return payload;
  const songPayload = { ...payload };
  delete songPayload.firework_cue_summary;
  delete songPayload.firework_cue_samples;
  delete songPayload.cue_reference;
  delete songPayload.inventory;
  delete songPayload.user_constraints;
  return {
    ...songPayload,
    sections: stripCueCountsFromSections(songPayload.sections),
  } as Json;
}

function stripFireworkRecommendationsFromMarkdown(markdown: string): string {
  return markdown
    .replace(/\n- \*\*Total firework cues:\*\*.*(?=\n)/g, "")
    .replace(/\n- Firework cues:.*(?=\n)/g, "")
    .replace(
      "\nThese are energy ramps leading into peaks — ideal for gradually ramping up firework intensity.\n",
      "\nThese are energy ramps leading into musical peaks.\n",
    )
    .replace(/\n## Firework Cues\n[\s\S]*?(?=\n## Beat Times\n)/, "\n");
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
  runnerVersion: string | null;
  runtimeMs: number | null;
  analysis: AnalyzerResult | null;
  llmPayload: Json | null;
  markdown: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}): ShowAnalysisSnapshot {
  return {
    id: params.id,
    showId: params.showId,
    status: params.errorMessage ? "failed" : "completed",
    schemaVersion: params.analysis?.schema_version ?? ANALYSER_SCHEMA_VERSION,
    personality: params.personality,
    audioPath: params.audioPath,
    runnerVersion: params.runnerVersion,
    runtimeMs: params.runtimeMs,
    errorMessage: params.errorMessage ?? null,
    createdAt: params.createdAt ?? new Date().toISOString(),
    completedAt: params.completedAt ?? new Date().toISOString(),
    analysis: params.analysis,
    llmPayload: params.llmPayload,
    markdown: params.markdown,
  };
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
  const analysisInsert: ShowAnalysisInsertPayload = {
    id: analysisId,
    show_id: show.id,
    user_id: user.id,
    audio_path: show.audio_path,
    personality: parsed.data.personality,
    runner_version: ANALYSER_RUNNER_VERSION,
    schema_version: ANALYSER_SCHEMA_VERSION,
    status: "running",
  };
  const { error: insertError } = await supabase
    .from("show_analyses")
    .insert(analysisInsert);
  if (insertError) {
    if (shouldRetryWithLegacyAnalysisColumns(insertError)) {
      const legacyInsert: ShowAnalysisInsertPayload = {
        ...analysisInsert,
        personality_preset: parsed.data.personality,
        source_audio_path: show.audio_path,
      };
      const { error: legacyInsertError } = await supabase
        .from("show_analyses")
        .insert(legacyInsert);
      if (legacyInsertError) {
        console.error("[api/analyze] legacy analysis row insert failed:", {
          original: insertError,
          retry: legacyInsertError,
        });
        const message =
          process.env.NODE_ENV === "development"
            ? `Could not create analysis record: ${
                supabaseErrorMessage(legacyInsertError) ?? "unknown Supabase error"
              }`
            : "Could not create analysis record.";
        return jsonError(message, 500);
      }
    } else {
      console.error("[api/analyze] analysis row insert failed:", insertError);
      const message =
        process.env.NODE_ENV === "development"
          ? `Could not create analysis record: ${
              supabaseErrorMessage(insertError) ?? "unknown Supabase error"
            }`
          : "Could not create analysis record.";
      return jsonError(message, 500);
    }
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

    const [analysisText, rawMarkdown, llmText] = await Promise.all([
      readFile(analysisPath, "utf8"),
      readFile(markdownPath, "utf8"),
      readFile(llmPath, "utf8"),
    ]);
    const analysis = stripFireworkRecommendationsFromAnalysis(
      JSON.parse(analysisText) as AnalyzerResult,
    );
    const llmPayload = stripFireworkRecommendationsFromPayload(
      JSON.parse(llmText) as Json,
    );
    const markdown = stripFireworkRecommendationsFromMarkdown(rawMarkdown);
    const runtimeMs = Date.now() - startedAt;
    const completedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("show_analyses")
      .update({
        status: "completed",
        schema_version: analysis.schema_version,
        completed_at: completedAt,
        runtime_ms: runtimeMs,
        analysis_json: analysis as unknown as Json,
        llm_payload: llmPayload,
        markdown,
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
        runnerVersion: ANALYSER_RUNNER_VERSION,
        runtimeMs,
        analysis,
        llmPayload,
        markdown,
        completedAt,
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
