import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requirePermission } from "@/lib/platform.server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await requirePermission("admin.manage_imports"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(await cookies());
  const [{ data: job, error: jobError }, { count: outputCount, error: outputError }] =
    await Promise.all([
      supabase
        .from("import_jobs")
        .select(
          "id, status, processing_progress, error_message, started_at, completed_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("import_outputs")
        .select("*", { count: "exact", head: true })
        .eq("import_job_id", id),
    ]);

  if (jobError) {
    return NextResponse.json(
      { error: jobError.message || "lookup failed" },
      { status: 500 },
    );
  }
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (outputError) {
    console.error("[imports/status] output count failed:", outputError);
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    processingProgress: job.processing_progress ?? 0,
    errorMessage: job.error_message ?? null,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    updatedAt: job.updated_at,
    outputCount: outputCount ?? 0,
  });
}
