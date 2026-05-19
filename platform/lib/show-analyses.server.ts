import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUserId } from "@/lib/current-user.server";
import type { Database } from "@/lib/database.types";
import type { AnalysisStatus, ShowAnalysisSnapshot } from "@/lib/show-analysis.types";

type ShowAnalysisRow = Database["public"]["Tables"]["show_analyses"]["Row"];

const SHOW_ANALYSIS_SELECT =
  "id, show_id, status, schema_version, personality, audio_path, runner_version, runtime_ms, error_message, created_at, completed_at, markdown";

const getServerClient = cache(async () => {
  return createClient(await cookies());
});

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
    contextMarkdown: row.markdown,
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
