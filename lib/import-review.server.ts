import 'server-only';

import { requirePermission } from '@/lib/admin/current-user.server';
import { getServerClient } from '@/lib/admin/supabase';
import { IMPORT_VIDEO_BUCKET } from '@/lib/import-jobs';
import type {
  ImportCandidate,
  ImportRun,
  ImportRunHistory,
  ImportRunOutput,
} from '@/lib/import-review';
import { isRunOwnedImportEngineReviewVideoPath } from '@/lib/import-review';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

const RETAINED_EVIDENCE_URL_TTL_SECONDS = 15 * 60;

type QueryError = { message?: string } | null;
type QueryResult<T> = { data: T[] | null; error: QueryError };
type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select(columns: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
};
type UntypedSupabase = {
  from<T>(table: string): QueryBuilder<T>;
};

type JobPointersRow = {
  active_run_id: string | null;
  selected_candidate_id: string | null;
  approved_run_id: string | null;
  approved_candidate_id: string | null;
};

type RunRow = {
  id: string;
  attempt_number: number;
  request_kind: string;
  request_prompt: string | null;
  status: string;
  stage: string;
  progress: number;
  selected_model: string;
  video_model: string | null;
  pipeline_version: string;
  engine_schema_version: string;
  direct_dispatch_status: string;
  direct_dispatch_call_id: string | null;
  direct_dispatch_attempt_count: number;
  direct_dispatch_error: string | null;
  direct_dispatch_updated_at: string | null;
  modal_call_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CandidatePointerRow = { import_run_id: string };

type RunOutputRow = {
  id: string;
  import_run_id: string;
  stage: string;
  sequence: number;
  output_type: string;
  schema_version: string;
  created_at: string;
};

type RunOutputPayloadRow = {
  id: string;
  payload: unknown;
};

type RetainedEvidenceOutputRow = { id: string };

type CandidateRow = {
  id: string;
  import_run_id: string;
  ordinal: number;
  schema_version: string;
  reconstruction: unknown;
  score: number | string;
  metrics: unknown;
  validation: unknown;
  rendered_video_path: string | null;
  selected_at: string | null;
  approved_at: string | null;
  created_at: string;
};

function failRead(operation: string, error: QueryError): never {
  console.error(`[import-review] ${operation} failed:`, error);
  throw new Error('Reconstruction history could not be loaded.', { cause: error });
}

async function createSignedRetainedEvidenceUrl(
  storagePath: string,
  sessionSupabase: Awaited<ReturnType<typeof getServerClient>>,
): Promise<string> {
  const service = createServiceRoleSupabase();
  let lastError: QueryError = { message: 'Supabase Storage did not return a signed URL.' };

  if (service) {
    const serviceResult = await service.storage
      .from(IMPORT_VIDEO_BUCKET)
      .createSignedUrl(storagePath, RETAINED_EVIDENCE_URL_TTL_SECONDS);
    if (!serviceResult.error && serviceResult.data?.signedUrl) {
      return serviceResult.data.signedUrl;
    }
    lastError = serviceResult.error ?? lastError;
  }

  const sessionResult = await sessionSupabase.storage
    .from(IMPORT_VIDEO_BUCKET)
    .createSignedUrl(storagePath, RETAINED_EVIDENCE_URL_TTL_SECONDS);
  if (!sessionResult.error && sessionResult.data?.signedUrl) {
    return sessionResult.data.signedUrl;
  }
  failRead('selected retained engine evidence URL', sessionResult.error ?? lastError);
}

export async function getImportRunHistory(jobId: string): Promise<ImportRunHistory> {
  const empty: ImportRunHistory = {
    activeRunId: null,
    selectedCandidateId: null,
    approvedRunId: null,
    approvedCandidateId: null,
    runs: [],
  };
  if (!(await requirePermission('admin.manage_imports'))) return empty;

  const sessionSupabase = await getServerClient();
  const client = sessionSupabase as unknown as UntypedSupabase;
  const pointerResult = await client
    .from<JobPointersRow>('import_jobs')
    .select('active_run_id, selected_candidate_id, approved_run_id, approved_candidate_id')
    .eq('id', jobId);
  if (pointerResult.error) failRead('job pointers', pointerResult.error);
  const pointers = pointerResult.data?.[0] ?? null;
  const selectedCandidatePointerResult = pointers?.selected_candidate_id
    ? await client
        .from<CandidatePointerRow>('import_candidates')
        .select('import_run_id')
        .eq('id', pointers.selected_candidate_id)
        .limit(1)
    : { data: [], error: null };
  if (selectedCandidatePointerResult.error) {
    failRead('selected candidate pointer', selectedCandidatePointerResult.error);
  }
  const selectedCandidateRunId = selectedCandidatePointerResult.data?.[0]?.import_run_id ?? null;

  const runResult = await client
    .from<RunRow>('import_runs')
    .select(
      'id, attempt_number, request_kind, request_prompt, status, stage, progress, selected_model, video_model, pipeline_version, engine_schema_version, direct_dispatch_status, direct_dispatch_call_id, direct_dispatch_attempt_count, direct_dispatch_error, direct_dispatch_updated_at, modal_call_id, error_message, started_at, completed_at, created_at, updated_at',
    )
    .eq('import_job_id', jobId)
    .order('attempt_number', { ascending: false })
    .limit(20);
  if (runResult.error) failRead('runs', runResult.error);
  let runRows = runResult.data ?? [];
  const retainedPointerRunIds = Array.from(
    new Set(
      [pointers?.active_run_id, pointers?.approved_run_id, selectedCandidateRunId].filter(
        (runId): runId is string => Boolean(runId),
      ),
    ),
  );
  const loadedRunIds = new Set(runRows.map((run) => run.id));
  const missingPointerRunIds = retainedPointerRunIds.filter((runId) => !loadedRunIds.has(runId));
  if (missingPointerRunIds.length) {
    const retainedRunResult = await client
      .from<RunRow>('import_runs')
      .select(
        'id, attempt_number, request_kind, request_prompt, status, stage, progress, selected_model, video_model, pipeline_version, engine_schema_version, direct_dispatch_status, direct_dispatch_call_id, direct_dispatch_attempt_count, direct_dispatch_error, direct_dispatch_updated_at, modal_call_id, error_message, started_at, completed_at, created_at, updated_at',
      )
      .in('id', missingPointerRunIds)
      .limit(3);
    if (retainedRunResult.error) failRead('retained pointer runs', retainedRunResult.error);
    runRows = [...runRows, ...(retainedRunResult.data ?? [])].sort(
      (left, right) => right.attempt_number - left.attempt_number,
    );
  }
  if (runRows.length === 0) {
    return {
      ...empty,
      activeRunId: pointers?.active_run_id ?? null,
      selectedCandidateId: pointers?.selected_candidate_id ?? null,
      approvedRunId: pointers?.approved_run_id ?? null,
      approvedCandidateId: pointers?.approved_candidate_id ?? null,
    };
  }

  const runIds = runRows.map((run) => run.id);
  const evidencePayloadPromise = pointers?.active_run_id
    ? client
        .from<RunOutputPayloadRow>('import_run_outputs')
        .select('id, payload')
        .eq('import_run_id', pointers.active_run_id)
        .in('output_type', ['frame_observations', 'video_observations'])
        .limit(4)
    : Promise.resolve({ data: [], error: null });
  const [outputResult, candidateResult, evidencePayloadResult] = await Promise.all([
    client
      .from<RunOutputRow>('import_run_outputs')
      .select('id, import_run_id, stage, sequence, output_type, schema_version, created_at')
      .in('import_run_id', runIds)
      .order('created_at', { ascending: false })
      .limit(250),
    client
      .from<CandidateRow>('import_candidates')
      .select(
        'id, import_run_id, ordinal, schema_version, reconstruction, score, metrics, validation, rendered_video_path, selected_at, approved_at, created_at',
      )
      .in('import_run_id', runIds)
      .order('ordinal', { ascending: true })
      .limit(276),
    evidencePayloadPromise,
  ]);
  if (outputResult.error) failRead('run outputs', outputResult.error);
  if (candidateResult.error) failRead('candidates', candidateResult.error);
  if (evidencePayloadResult.error) {
    failRead('active run observation payloads', evidencePayloadResult.error);
  }

  const selectedCandidate = (candidateResult.data ?? []).find(
    (candidate) => candidate.id === pointers?.selected_candidate_id,
  );
  let selectedRenderedVideoUrl: string | null = null;
  if (
    selectedCandidate?.rendered_video_path &&
    isRunOwnedImportEngineReviewVideoPath(
      selectedCandidate.rendered_video_path,
      selectedCandidate.import_run_id,
    )
  ) {
    const retainedOutputResult = await client
      .from<RetainedEvidenceOutputRow>('import_run_outputs')
      .select('id')
      .eq('import_run_id', selectedCandidate.import_run_id)
      .eq('output_type', 'render_metrics')
      .eq('storage_path', selectedCandidate.rendered_video_path)
      .limit(1);
    if (retainedOutputResult.error) {
      failRead('selected retained engine evidence output', retainedOutputResult.error);
    }
    if (retainedOutputResult.data?.length) {
      selectedRenderedVideoUrl = await createSignedRetainedEvidenceUrl(
        selectedCandidate.rendered_video_path,
        sessionSupabase,
      );
    }
  }

  const evidencePayloads = new Map(
    (evidencePayloadResult.data ?? []).map((output) => [output.id, output.payload]),
  );

  const outputsByRun = new Map<string, ImportRunOutput[]>();
  for (const output of outputResult.data ?? []) {
    const mapped: ImportRunOutput = {
      id: output.id,
      runId: output.import_run_id,
      stage: output.stage,
      sequence: output.sequence,
      outputType: output.output_type,
      schemaVersion: output.schema_version,
      payload: evidencePayloads.get(output.id) ?? null,
      createdAt: output.created_at,
    };
    outputsByRun.set(output.import_run_id, [
      ...(outputsByRun.get(output.import_run_id) ?? []),
      mapped,
    ]);
  }

  const candidatesByRun = new Map<string, ImportCandidate[]>();
  for (const candidate of candidateResult.data ?? []) {
    const mapped: ImportCandidate = {
      id: candidate.id,
      runId: candidate.import_run_id,
      ordinal: candidate.ordinal,
      schemaVersion: candidate.schema_version,
      reconstruction: candidate.reconstruction,
      score: Number(candidate.score),
      metrics: candidate.metrics,
      validation: candidate.validation,
      renderedVideoPath: candidate.rendered_video_path,
      renderedVideoUrl:
        candidate.id === pointers?.selected_candidate_id ? selectedRenderedVideoUrl : null,
      selectedAt: candidate.selected_at,
      approvedAt: candidate.approved_at,
      createdAt: candidate.created_at,
    };
    candidatesByRun.set(candidate.import_run_id, [
      ...(candidatesByRun.get(candidate.import_run_id) ?? []),
      mapped,
    ]);
  }

  const runs: ImportRun[] = runRows.map((run) => ({
    id: run.id,
    attemptNumber: run.attempt_number,
    requestKind: run.request_kind,
    requestPrompt: run.request_prompt,
    status: run.status,
    stage: run.stage,
    progress: run.progress,
    selectedModel: run.selected_model,
    videoModel: run.video_model,
    pipelineVersion: run.pipeline_version,
    engineSchemaVersion: run.engine_schema_version,
    directDispatchStatus: run.direct_dispatch_status,
    directDispatchCallId: run.direct_dispatch_call_id,
    directDispatchAttemptCount: run.direct_dispatch_attempt_count,
    directDispatchError: run.direct_dispatch_error,
    directDispatchUpdatedAt: run.direct_dispatch_updated_at,
    modalCallId: run.modal_call_id,
    errorMessage: run.error_message,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    outputs: outputsByRun.get(run.id) ?? [],
    candidates: candidatesByRun.get(run.id) ?? [],
  }));

  return {
    activeRunId: pointers?.active_run_id ?? null,
    selectedCandidateId: pointers?.selected_candidate_id ?? null,
    approvedRunId: pointers?.approved_run_id ?? null,
    approvedCandidateId: pointers?.approved_candidate_id ?? null,
    runs,
  };
}
