import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUserId } from "@/lib/current-user.server";
import type { Database, Json } from "@/lib/database.types";
import type {
  AnalyserResult,
  AnalysisStatus,
  ShowAnalysisSnapshot,
} from "@/lib/show-analysis.types";

type ShowAnalysisRow = Database["public"]["Tables"]["show_analyses"]["Row"];

const SHOW_ANALYSIS_SELECT =
  "id, show_id, status, schema_version, personality, audio_path, runner_version, runtime_ms, error_message, created_at, completed_at, analysis_json, llm_payload, markdown";

const getServerClient = cache(async () => {
  return createClient(await cookies());
});

function isRecord(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asAnalysis(value: Json | null): AnalyserResult | null {
  if (!isRecord(value)) return null;
  if (typeof value.schema_version !== "string") return null;
  if (!Array.isArray(value.energy_timeline)) return null;
  if (!Array.isArray(value.sections)) return null;
  if (!Array.isArray(value.key_moments)) return null;
  return value as unknown as AnalyserResult;
}

async function hydrateAnalysis(row: ShowAnalysisRow): Promise<ShowAnalysisSnapshot> {
  return {
    id: row.id,
    showId: row.show_id,
    status: row.status as AnalysisStatus,
    schemaVersion: row.schema_version,
    personality: row.personality,
    audioPath: row.audio_path,
    runnerVersion: row.runner_version,
    runtimeMs: row.runtime_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    analysis: asAnalysis(row.analysis_json),
    llmPayload: row.llm_payload,
    markdown: row.markdown,
  };
}

export async function getLatestAnalysisForShow(
  showId: string,
): Promise<ShowAnalysisSnapshot | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("show_analyses")
    .select(SHOW_ANALYSIS_SELECT)
    .eq("show_id", showId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[show-analyses.server] getLatestAnalysisForShow failed:", error);
    return null;
  }
  return data ? hydrateAnalysis(data as ShowAnalysisRow) : null;
}
