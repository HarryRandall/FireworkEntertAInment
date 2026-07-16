/** Admin-only live status for one versioned firework reconstruction. */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/admin.server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };
type QueryError = { message?: string } | null;
type QueryResult<T> = { data: T[] | null; error: QueryError; count?: number | null };
type SingleResult<T> = { data: T | null; error: QueryError };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  maybeSingle(): Promise<SingleResult<T>>;
};
type UntypedSupabase = { from<T>(table: string): QueryBuilder<T> };

type JobStatusRow = {
  id: string;
  status: string;
  processing_progress: number | null;
  error_message: string | null;
  active_run_id: string | null;
  selected_candidate_id: string | null;
  updated_at: string | null;
};

type RunStatusRow = {
  id: string;
  status: string;
  stage: string;
  progress: number;
  error_message: string | null;
  updated_at: string | null;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await requirePermission('admin.manage_imports'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = createClient(await cookies()) as unknown as UntypedSupabase;
  const { data: job, error: jobError } = await supabase
    .from<JobStatusRow>('import_jobs')
    .select(
      'id, status, processing_progress, error_message, active_run_id, selected_candidate_id, updated_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (jobError) {
    return NextResponse.json({ error: jobError.message || 'lookup failed' }, { status: 500 });
  }
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const runPromise = job.active_run_id
    ? supabase
        .from<RunStatusRow>('import_runs')
        .select('id, status, stage, progress, error_message, updated_at')
        .eq('id', job.active_run_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const runOutputPromise = job.active_run_id
    ? supabase
        .from<never>('import_run_outputs')
        .select('id', { count: 'exact', head: true })
        .eq('import_run_id', job.active_run_id)
    : Promise.resolve({ data: null, error: null, count: 0 });
  const candidatePromise = job.active_run_id
    ? supabase
        .from<never>('import_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('import_run_id', job.active_run_id)
    : Promise.resolve({ data: null, error: null, count: 0 });

  const [runResult, legacyOutputResult, runOutputResult, candidateResult] = await Promise.all([
    runPromise,
    supabase
      .from<never>('import_outputs')
      .select('id', { count: 'exact', head: true })
      .eq('import_job_id', id),
    runOutputPromise,
    candidatePromise,
  ]);
  const readError =
    runResult.error ?? legacyOutputResult.error ?? runOutputResult.error ?? candidateResult.error;
  if (readError) {
    console.error('[imports/status] reconstruction status read failed:', readError);
    return NextResponse.json(
      { error: readError.message || 'status evidence lookup failed' },
      { status: 500 },
    );
  }

  const run = runResult.data;
  return NextResponse.json({
    id: job.id,
    status: job.status,
    stage: run?.stage ?? null,
    runStatus: run?.status ?? null,
    processingProgress: run?.progress ?? job.processing_progress ?? 0,
    errorMessage: run?.error_message ?? job.error_message ?? null,
    updatedAt: run?.updated_at ?? job.updated_at,
    outputCount: (legacyOutputResult.count ?? 0) + (runOutputResult.count ?? 0),
    candidateCount: candidateResult.count ?? 0,
    selectedCandidateId: job.selected_candidate_id,
  });
}
