/**
 * Platform admin server actions.
 *
 * This file groups every server action used by the admin imports flow plus
 * the (single) profile action. Each exported function is a Next.js Server
 * Action — invoked from a `<form action={...}>` or `useActionState` hook on
 * the client — so they:
 *
 * - Use `revalidatePath` to refresh server-rendered pages after a write
 * - Call `requirePermission` to gate by RBAC; interactive callers receive
 *   explicit failure results where they need to display write outcomes
 * - Redirect via `next/navigation`'s `redirect()` only at the end of a flow
 *
 * The file is intentionally kept as a single module: existing tests grep
 * specific snippets out of this file's source (see `tests/*.test.mjs`), and
 * the schemas + helpers below are only used by these actions, so co-location
 * keeps the surface area obvious for code review.
 *
 * Sections:
 *   1. Zod schemas (input shapes for each action)
 *   2. Helpers (error formatting, storage-path safety checks, output reads)
 *   3. Profile actions
 *   4. Generic import-job CRUD actions
 *   5. Video-upload + finalize actions (browser-direct upload flow)
 *   6. Import lifecycle actions (queue / refine / draft / approve)
 */
'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { getCurrentUserId } from '@/lib/current-user.server';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminImportsCache,
  requirePermission,
} from '@/lib/admin.server';
import { invalidateUserProfileCache } from '@/lib/admin/current-user.server';
import {
  DEFAULT_OPENROUTER_MODEL,
  IMPORT_VIDEO_BUCKET,
  ImportedFireworkSpecSchema,
  MAX_IMPORT_VIDEO_SECONDS,
  OPENROUTER_MODEL_OPTIONS,
  type ImportedFireworkSpec,
} from '@/lib/import-jobs';
import {
  IMPORT_RECONSTRUCTION_VALIDATOR_VERSION,
  parseImportReconstruction,
} from '@/lib/import-reconstruction';
import { parseImportEnginePublicationEvidence } from '@/lib/import-review';
import {
  dispatchFireworkImportRun,
  getFireworkImportDispatchConfiguration,
} from '@/lib/firework-import-trigger.server';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';
import type { Json } from '@/lib/database.types';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

// ===========================================================================
// 1. Zod schemas
// ===========================================================================

/** Editable fields on the user's own profile. All keys are optional patches. */
const ProfileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  themePreference: z.enum(['dark', 'light', 'system']).optional(),
});

/** Generic import-job form payload (used by both create + update). */
const ImportJobSchema = z.object({
  kind: z.enum(['vdl_glossary', 'firework_video', 'supplier_stock']),
  sourceName: z.string().trim().min(1).max(180),
  sourceUrl: z.string().trim().url().optional().or(z.literal('')),
  status: z.enum(['draft', 'queued', 'processing', 'needs_review', 'complete', 'failed']),
  rowCount: z.coerce.number().int().min(0).optional().or(z.literal('')),
});

/** Used by every "lookup by id" action. */
const IdSchema = z.object({
  id: z.string().uuid(),
});

/** Action result shape consumed by `useActionState` on the upload forms. */
export type ImportUploadActionState = {
  ok: boolean;
  error: string | null;
};

export type ImportMutationActionResult = { ok: true } | { ok: false; error: string };
export type ImportJobMutationResult = ImportMutationActionResult;

/** Validates that a model selection is one we know how to dispatch to. */
const ModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (model) => OPENROUTER_MODEL_OPTIONS.some((option) => option.value === model),
    'Choose a supported OpenRouter model.',
  );

/**
 * Direct-to-storage uploads happen in the browser (Vercel caps Server Action
 * request bodies at 4.5 MB regardless of `next.config` `bodySizeLimit`), so the
 * finalize action only receives metadata about the already-uploaded object.
 */
const FinalizeVideoImportSchema = z.object({
  sourceName: z.string().trim().min(1).max(180),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  storagePath: z.string().trim().min(1).max(512),
  originalName: z.string().trim().min(1).max(255),
  sizeBytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(250 * 1024 * 1024),
  contentType: z.string().trim().min(1).max(120),
  reportedDurationSeconds: z.coerce
    .number()
    .min(0)
    .max(MAX_IMPORT_VIDEO_SECONDS)
    .optional()
    .or(z.literal('')),
});

const QueueImportSchema = z.object({
  id: z.string().uuid(),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  idempotencyKey: z.string().uuid().optional(),
});

const RefinementSchema = z.object({
  id: z.string().uuid(),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  prompt: z.string().trim().min(3).max(2000),
  idempotencyKey: z.string().uuid().optional(),
});

const SelectImportCandidateSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
});

const ManualDraftSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional(),
  durationSeconds: z.coerce.number().min(0.1).max(MAX_IMPORT_VIDEO_SECONDS),
  spec: z.string().trim().min(2).max(20_000),
});

const ApproveImportSchema = z.object({
  id: z.string().uuid(),
  partNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  manufacturer: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  fireworkType: z.string().trim().max(80).optional(),
});

// ===========================================================================
// 2. Helpers
// ===========================================================================

/** Pull the first user-facing message off a ZodError, with a generic fallback. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the form details.';
}

type UntypedRpcError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type UntypedRpcResult<T> = {
  data: T | null;
  error: UntypedRpcError | null;
};

type UntypedRpcClient = {
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<UntypedRpcResult<T>>;
};

function callUntypedRpc<T>(
  supabase: unknown,
  name: string,
  args: Record<string, unknown>,
): Promise<UntypedRpcResult<T>> {
  return (supabase as unknown as UntypedRpcClient).rpc<T>(name, args);
}

function firstRpcRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

type FireworkImportDispatchReadiness =
  | { ok: true; mode: 'direct' | 'local-worker' }
  | { ok: false; error: string };

const DISPATCH_CONFIGURATION_ERROR =
  'Firework reconstruction is temporarily unavailable because dispatch is not configured. No credits were reserved.';

function pause(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function retryTrustedDispatchRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<UntypedRpcResult<T>> {
  let lastResult: UntypedRpcResult<T> = {
    data: null,
    error: { message: 'The trusted dispatch client is unavailable.' },
  };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const service = createServiceRoleSupabase();
    if (!service) return lastResult;
    try {
      lastResult = await callUntypedRpc<T>(service, name, args);
    } catch {
      lastResult = {
        data: null,
        error: { message: 'The trusted dispatch request failed.' },
      };
    }
    if (!lastResult.error) return lastResult;
    if (attempt < 3) await pause(100 * attempt);
  }
  return lastResult;
}

/** Refuse production queue writes unless their failure/refund path is usable. */
async function prepareFireworkImportDispatch(): Promise<FireworkImportDispatchReadiness> {
  const configuration = getFireworkImportDispatchConfiguration();
  if (configuration.mode === 'local-worker') return { ok: true, mode: 'local-worker' };
  if (configuration.mode === 'invalid') {
    console.error(`[firework-import] ${configuration.error}`);
    if (process.env.NODE_ENV !== 'production') return { ok: true, mode: 'local-worker' };
    return { ok: false, error: DISPATCH_CONFIGURATION_ERROR };
  }

  const readiness = await retryTrustedDispatchRpc<boolean>(
    'check_firework_import_dispatch_ready',
    {},
  );
  if (readiness.error || readiness.data !== true) {
    console.error('[firework-import] trusted dispatch preflight failed:', readiness.error);
    if (process.env.NODE_ENV !== 'production') return { ok: true, mode: 'local-worker' };
    return { ok: false, error: DISPATCH_CONFIGURATION_ERROR };
  }
  return { ok: true, mode: 'direct' };
}

async function recordFireworkImportDispatch(
  runId: string,
  result: Awaited<ReturnType<typeof dispatchFireworkImportRun>>,
): Promise<void> {
  if (!result.dispatched && result.reason === 'local-worker') return;
  const persisted = await retryTrustedDispatchRpc<string>(
    'record_firework_import_dispatch_result',
    result.dispatched
      ? {
          p_run_id: runId,
          p_outcome: 'accepted',
          p_attempt_count: result.attempts,
          p_call_id: result.callId,
          p_error: null,
        }
      : {
          p_run_id: runId,
          p_outcome: 'exhausted',
          p_attempt_count: result.attempts,
          p_call_id: null,
          p_error: result.error,
        },
  );
  if (persisted.error) {
    console.error('[firework-import] dispatch result could not be persisted:', persisted.error);
  }
}

function scheduleFireworkImportDispatch(runId: string, mode: 'direct' | 'local-worker'): void {
  if (mode === 'local-worker') return;
  after(async () => {
    const begin = await retryTrustedDispatchRpc<boolean>('begin_firework_import_dispatch', {
      p_run_id: runId,
    });
    if (begin.error) {
      console.error('[firework-import] dispatch could not be started:', begin.error);
      return;
    }
    if (begin.data !== true) return;

    const result = await dispatchFireworkImportRun(runId);
    await recordFireworkImportDispatch(runId, result);
  });
}

async function selectUntypedMaybeSingle<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  matchColumn: string,
  matchValue: string,
): Promise<UntypedRpcResult<T>> {
  const client = supabase as unknown as {
    from: (tableName: string) => {
      select: (selection: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<UntypedRpcResult<T>>;
        };
      };
    };
  };
  return client.from(table).select(columns).eq(matchColumn, matchValue).maybeSingle();
}

/**
 * Defence-in-depth: ensure the just-uploaded storage object actually lives
 * under the caller's admin folder before we link it to an import job. RLS
 * already protects the bucket, but a buggy client could still report a
 * sibling admin's path; reject those here with a clear error.
 */
async function verifyCallerOwnedUploadObject(
  supabase: ReturnType<typeof createClient>,
  adminId: string,
  storagePath: string,
): Promise<string | null> {
  if (!storagePath.startsWith(`${adminId}/`)) {
    return 'Uploaded object is not in your admin folder; refresh and retry.';
  }

  const objectName = storagePath.slice(adminId.length + 1);
  if (!objectName || objectName.includes('/')) {
    return 'Uploaded object path is invalid; upload the video again.';
  }

  const { data, error } = await supabase.storage
    .from(IMPORT_VIDEO_BUCKET)
    .list(adminId, { limit: 100, search: objectName });
  if (error) {
    console.error('[verifyCallerOwnedUploadObject] storage lookup failed:', error);
    return `Could not verify the uploaded video: ${error.message}`;
  }
  const exists = (data ?? []).some((item) => item.name === objectName);
  return exists ? null : 'Uploaded video was not found in storage. Upload it again.';
}

// ===========================================================================
// 3. Profile actions
// ===========================================================================

type ProfilePatch = {
  fullName?: string;
  phone?: string;
  themePreference?: 'dark' | 'light' | 'system';
};

type SavedProfilePatch = {
  fullName: string | null;
  phone: string | null;
  themePreference: 'dark' | 'light' | 'system';
};

/**
 * Patch the current user's profile (display name, phone, theme).
 *
 * Empty strings clear the field on the server. Returns a structured result
 * so the client can show a toast — never throws on validation errors.
 */
export async function updateProfileAction(
  input: ProfilePatch,
): Promise<{ ok: true; saved: SavedProfilePatch } | { ok: false; error: string }> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: 'Not signed in' };

  const patch: Record<string, string | null> = {};
  if ('fullName' in parsed.data) {
    patch.full_name = parsed.data.fullName ? parsed.data.fullName : null;
  }
  if ('phone' in parsed.data) {
    patch.phone = parsed.data.phone ? parsed.data.phone : null;
  }
  if (parsed.data.themePreference) {
    patch.theme_preference = parsed.data.themePreference;
  }
  const supabase = createClient(await cookies());
  const result =
    Object.keys(patch).length > 0
      ? await supabase
          .from('users')
          .update(patch)
          .eq('id', userId)
          .select('full_name, phone, theme_preference')
          .maybeSingle()
      : await supabase
          .from('users')
          .select('full_name, phone, theme_preference')
          .eq('id', userId)
          .maybeSingle();
  if (result.error || !result.data) {
    const error = result.error;
    console.error('[updateProfileAction] failed:', error);
    return { ok: false, error: 'Could not save changes' };
  }
  if (Object.keys(patch).length > 0) {
    await invalidateUserProfileCache(userId);
    revalidatePath('/settings/profile');
    revalidatePath('/home');
  }
  return {
    ok: true,
    saved: {
      fullName: result.data.full_name,
      phone: result.data.phone,
      themePreference: result.data.theme_preference as SavedProfilePatch['themePreference'],
    },
  };
}

// ===========================================================================
// 4. Generic import-job CRUD
// ===========================================================================

/**
 * Create a manual import-job row (no media upload). Used by the admin imports
 * page for non-video sources like glossaries and supplier stock CSVs.
 */
export async function createImportJobAction(formData: FormData): Promise<void> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return;
  const parsed = ImportJobSchema.safeParse({
    kind: formData.get('kind'),
    sourceName: formData.get('sourceName'),
    sourceUrl: formData.get('sourceUrl') ?? '',
    status: formData.get('status') ?? 'draft',
    rowCount: formData.get('rowCount') ?? '',
  });
  if (!parsed.success) return console.error(firstError(parsed.error));
  if (parsed.data.kind === 'firework_video') {
    console.error('[createImportJobAction] video imports require the guarded upload workflow.');
    return;
  }

  const rowCount = typeof parsed.data.rowCount === 'number' ? parsed.data.rowCount : null;
  const supabase = createClient(await cookies());
  const { error } = await supabase.from('import_jobs').insert({
    kind: parsed.data.kind,
    source_name: parsed.data.sourceName,
    source_url: parsed.data.sourceUrl || null,
    status: parsed.data.status,
    row_count: rowCount,
    created_by: admin.id,
  });
  if (error) {
    console.error('[createImportJobAction] failed:', error);
    return;
  }
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
}

// ===========================================================================
// 5. Video upload + finalize (browser-direct upload flow)
// ===========================================================================

/**
 * Finalize a browser-direct video upload.
 *
 * The file is already in storage at `storagePath`; this action verifies the
 * upload belongs to the caller and creates the matching `media_assets` +
 * `import_jobs` rows. On success it redirects to the new job's detail page.
 */
export async function finalizeVideoImportJobAction(
  _state: ImportUploadActionState,
  formData: FormData,
): Promise<ImportUploadActionState> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) {
    return { ok: false, error: 'You do not have permission to manage imports.' };
  }

  const parsed = FinalizeVideoImportSchema.safeParse({
    sourceName: formData.get('sourceName'),
    selectedModel: formData.get('selectedModel') ?? DEFAULT_OPENROUTER_MODEL,
    storagePath: formData.get('storagePath'),
    originalName: formData.get('originalName'),
    sizeBytes: formData.get('sizeBytes'),
    contentType: formData.get('contentType') ?? 'video/mp4',
    reportedDurationSeconds: formData.get('reportedDurationSeconds') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const dispatch = await prepareFireworkImportDispatch();
  if (!dispatch.ok) return dispatch;

  const supabase = createClient(await cookies());
  const uploadError = await verifyCallerOwnedUploadObject(
    supabase,
    admin.id,
    parsed.data.storagePath,
  );
  if (uploadError) {
    return { ok: false, error: uploadError };
  }

  const duration =
    typeof parsed.data.reportedDurationSeconds === 'number'
      ? parsed.data.reportedDurationSeconds
      : null;
  const { data, error } = await callUntypedRpc<
    { job_id: string; run_id: string } | Array<{ job_id: string; run_id: string }>
  >(supabase, 'finalise_firework_video_import', {
    p_source_name: parsed.data.sourceName,
    p_storage_path: parsed.data.storagePath,
    p_original_name: parsed.data.originalName,
    p_selected_model: parsed.data.selectedModel,
    p_reported_duration_seconds: duration,
  });
  const created = firstRpcRow(data);
  if (error || !created) {
    console.error('[finalizeVideoImportJobAction] transaction failed:', error);
    return {
      ok: false,
      error: error?.message ?? 'Could not create the import job. Try again.',
    };
  }

  scheduleFireworkImportDispatch(created.run_id, dispatch.mode);

  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  redirect(`/admin/imports/${created.job_id}`);
}

// ===========================================================================
// 6. Import lifecycle (queue / refine / draft / approve / update / delete)
// ===========================================================================

/** Re-queue an import job for processing (also resets progress + errors). */
export async function queueImportJobAction(
  formData: FormData,
): Promise<ImportMutationActionResult> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return { ok: false, error: 'You do not have permission to manage imports.' };
  const parsed = QueueImportSchema.safeParse({
    id: formData.get('id'),
    selectedModel: formData.get('selectedModel') ?? DEFAULT_OPENROUTER_MODEL,
    idempotencyKey: formData.get('idempotencyKey') ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const dispatch = await prepareFireworkImportDispatch();
  if (!dispatch.ok) return dispatch;

  const supabase = createClient(await cookies());
  const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();
  const { data, error } = await callUntypedRpc<{ id: string } | Array<{ id: string }>>(
    supabase,
    'start_firework_import_run',
    {
      p_job_id: parsed.data.id,
      p_request_kind: 'retry',
      p_selected_model: parsed.data.selectedModel,
      p_idempotency_key: `retry:${parsed.data.id}:${idempotencyKey}`,
      p_request_prompt: null,
    },
  );
  const run = firstRpcRow(data);
  if (error || !run) {
    console.error('[queueImportJobAction] failed:', error);
    return { ok: false, error: error?.message ?? 'Could not queue another reconstruction.' };
  }
  scheduleFireworkImportDispatch(run.id, dispatch.mode);
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  revalidatePath(`/admin/imports/${parsed.data.id}`);
  return { ok: true };
}

/**
 * Request an LLM-driven refinement of the current spec with a free-text
 * prompt. Records the prompt + current spec snapshot in `import_outputs`
 * then re-queues the job for processing.
 */
export async function requestImportRefinementAction(
  formData: FormData,
): Promise<ImportMutationActionResult> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return { ok: false, error: 'You do not have permission to manage imports.' };
  const parsed = RefinementSchema.safeParse({
    id: formData.get('id'),
    selectedModel: formData.get('selectedModel') ?? DEFAULT_OPENROUTER_MODEL,
    prompt: formData.get('prompt'),
    idempotencyKey: formData.get('idempotencyKey') ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const dispatch = await prepareFireworkImportDispatch();
  if (!dispatch.ok) return dispatch;

  const supabase = createClient(await cookies());
  const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();
  const { data, error } = await callUntypedRpc<{ id: string } | Array<{ id: string }>>(
    supabase,
    'start_firework_import_run',
    {
      p_job_id: parsed.data.id,
      p_request_kind: 'refinement',
      p_selected_model: parsed.data.selectedModel,
      p_idempotency_key: `refine:${parsed.data.id}:${idempotencyKey}`,
      p_request_prompt: parsed.data.prompt,
    },
  );
  const run = firstRpcRow(data);
  if (error || !run) {
    console.error('[requestImportRefinementAction] failed:', error);
    return { ok: false, error: error?.message ?? 'Could not start the refinement.' };
  }
  scheduleFireworkImportDispatch(run.id, dispatch.mode);
  await invalidateAdminImportsCache();
  revalidatePath(`/admin/imports/${parsed.data.id}`);
  return { ok: true };
}

/** Select a reconstruction candidate from the job's current completed run. */
export async function selectImportCandidateAction(
  formData: FormData,
): Promise<ImportMutationActionResult> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return { ok: false, error: 'You do not have permission to manage imports.' };
  const parsed = SelectImportCandidateSchema.safeParse({
    id: formData.get('id'),
    candidateId: formData.get('candidateId'),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data, error } = await callUntypedRpc<string>(
    supabase,
    'select_firework_import_candidate',
    {
      p_job_id: parsed.data.id,
      p_candidate_id: parsed.data.candidateId,
    },
  );
  if (error || !data) {
    console.error('[selectImportCandidateAction] failed:', error);
    return { ok: false, error: error?.message ?? 'Could not select that reconstruction.' };
  }

  await invalidateAdminImportsCache();
  revalidatePath(`/admin/imports/${parsed.data.id}`);
  return { ok: true };
}

/**
 * Persist a manual edit to the draft spec. Validated through
 * {@link ImportedFireworkSpecSchema} so we never store malformed JSON.
 */
export async function updateImportDraftSpecAction(formData: FormData): Promise<void> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return;
  const parsed = ManualDraftSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    durationSeconds: formData.get('durationSeconds'),
    spec: formData.get('spec') ?? '',
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .select('kind')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (jobError || !job) {
    console.error('[updateImportDraftSpecAction] import lookup failed:', jobError);
    return;
  }
  if (job.kind === 'firework_video') {
    console.error(
      '[updateImportDraftSpecAction] renderer-native video candidates cannot be edited as legacy drafts.',
    );
    return;
  }

  let specJson: unknown;
  try {
    specJson = JSON.parse(parsed.data.spec);
  } catch (error) {
    console.error('[updateImportDraftSpecAction] invalid spec JSON:', error);
    return;
  }

  const result = ImportedFireworkSpecSchema.safeParse({
    name: parsed.data.name,
    description: parsed.data.description || null,
    durationSeconds: parsed.data.durationSeconds,
    confidence: 0.85,
    spec: specJson,
  });
  if (!result.success) {
    console.error('[updateImportDraftSpecAction] invalid spec:', result.error);
    return;
  }
  const spec: ImportedFireworkSpec = result.data;

  const { error } = await supabase.from('import_outputs').insert({
    import_job_id: parsed.data.id,
    output_type: 'draft_spec',
    payload: {
      source: 'manual_adjustment',
      adjustedBy: admin.id,
      spec,
    } as Json,
  });
  if (error) {
    console.error('[updateImportDraftSpecAction] failed:', error);
    return;
  }
  await supabase
    .from('import_jobs')
    .update({ status: 'needs_review', processing_progress: 100 })
    .eq('id', parsed.data.id);
  await invalidateAdminImportsCache();
  revalidatePath(`/admin/imports/${parsed.data.id}`);
}

/**
 * Approve the current draft spec to the live catalogue.
 *
 * Requires both `admin.manage_imports` and `admin.manage_catalogue`. Creates a
 * base-effect-backed `fireworks` row and a supplier-facing `catalogue_items`
 * row. Then marks the import job complete and invalidates every related cache
 * so the next read sees the new catalogue item.
 */
export async function approveImportJobAction(
  formData: FormData,
): Promise<ImportMutationActionResult> {
  const importAdmin = await requirePermission('admin.manage_imports');
  const catalogueAdmin = await requirePermission('admin.manage_catalogue');
  if (!importAdmin || !catalogueAdmin) {
    return { ok: false, error: 'You do not have permission to approve catalogue imports.' };
  }
  const parsed = ApproveImportSchema.safeParse({
    id: formData.get('id'),
    partNumber: formData.get('partNumber'),
    name: formData.get('name'),
    manufacturer: formData.get('manufacturer') ?? '',
    category: formData.get('category') ?? '',
    fireworkType: formData.get('fireworkType') ?? '',
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: job, error: jobError } = await selectUntypedMaybeSingle<{
    selected_candidate_id: string | null;
  }>(supabase, 'import_jobs', 'selected_candidate_id', 'id', parsed.data.id);
  if (jobError || !job?.selected_candidate_id) {
    console.error('[approveImportJobAction] selected candidate lookup failed:', jobError);
    return {
      ok: false,
      error: jobError?.message ?? 'Select a completed reconstruction before approving it.',
    };
  }

  const { data: candidate, error: candidateError } = await selectUntypedMaybeSingle<{
    reconstruction: unknown;
    validation: unknown;
    metrics: unknown;
    rendered_video_path: string | null;
    content_hash: string;
  }>(
    supabase,
    'import_candidates',
    'reconstruction, validation, metrics, rendered_video_path, content_hash',
    'id',
    job.selected_candidate_id,
  );
  if (candidateError || !candidate) {
    console.error('[approveImportJobAction] candidate lookup failed:', candidateError);
    return {
      ok: false,
      error: candidateError?.message ?? 'The selected reconstruction could not be loaded.',
    };
  }

  const strictCandidate = parseImportReconstruction(candidate.reconstruction);
  const validation =
    typeof candidate.validation === 'object' && candidate.validation !== null
      ? (candidate.validation as Record<string, unknown>)
      : null;
  if (!strictCandidate.success || validation?.valid !== true) {
    console.error(
      '[approveImportJobAction] candidate failed the strict validation gate:',
      strictCandidate.success ? validation : strictCandidate.issues,
    );
    return {
      ok: false,
      error: strictCandidate.success
        ? 'Resolve the failed reconstruction checks before approval.'
        : (strictCandidate.issues[0]?.message ?? 'The reconstruction is not renderer-safe.'),
    };
  }

  const engineEvidence = parseImportEnginePublicationEvidence(
    candidate.metrics,
    candidate.rendered_video_path,
    strictCandidate.data,
  );
  if (!engineEvidence.success) {
    return { ok: false, error: engineEvidence.error };
  }

  const canonicalReconstruction = strictCandidate.data as unknown as Json;
  const trustedValidator = createServiceRoleSupabase();
  if (!trustedValidator) {
    return {
      ok: false,
      error: 'The trusted renderer validator is not configured on this deployment.',
    };
  }
  const { data: sealedCandidateId, error: sealError } = await callUntypedRpc<string>(
    trustedValidator,
    'seal_firework_import_candidate',
    {
      p_candidate_id: job.selected_candidate_id,
      p_validator_version: IMPORT_RECONSTRUCTION_VALIDATOR_VERSION,
      p_canonical_reconstruction: canonicalReconstruction,
      p_content_hash: candidate.content_hash,
    },
  );
  if (sealError || sealedCandidateId !== job.selected_candidate_id) {
    console.error('[approveImportJobAction] renderer validation seal failed:', sealError);
    return {
      ok: false,
      error: sealError?.message ?? 'Could not seal the renderer-safe reconstruction.',
    };
  }

  const { data: sealedRenderCandidateId, error: renderSealError } = await callUntypedRpc<string>(
    trustedValidator,
    'seal_firework_import_render_validation',
    {
      p_candidate_id: job.selected_candidate_id,
      p_validator_version: engineEvidence.data.validatorVersion,
      p_canonical_evidence: engineEvidence.data.canonicalEvidence as unknown as Json,
      p_artifact_storage_path: engineEvidence.data.renderedVideoPath,
    },
  );
  if (renderSealError || sealedRenderCandidateId !== job.selected_candidate_id) {
    console.error('[approveImportJobAction] engine validation seal failed:', renderSealError);
    return {
      ok: false,
      error: renderSealError?.message ?? 'Could not seal the sampled engine evidence.',
    };
  }

  type ApprovalRow = {
    catalogue_item_id: string;
    firework_ids: string[];
    multishot_id: string | null;
  };
  const { data: approvalData, error: approvalError } = await callUntypedRpc<
    ApprovalRow | ApprovalRow[]
  >(supabase, 'approve_firework_import_candidate', {
    p_job_id: parsed.data.id,
    p_candidate_id: job.selected_candidate_id,
    p_part_number: parsed.data.partNumber,
    p_name: parsed.data.name,
    p_manufacturer: parsed.data.manufacturer || null,
    p_category: parsed.data.category || null,
    p_firework_type: parsed.data.fireworkType || null,
  });
  const approval = firstRpcRow<ApprovalRow>(approvalData);
  if (approvalError || !approval) {
    console.error('[approveImportJobAction] approval transaction failed:', approvalError);
    return { ok: false, error: approvalError?.message ?? 'Could not publish this reconstruction.' };
  }

  const { data: createdFireworks, error: createdFireworksError } =
    approval.firework_ids.length > 0
      ? await supabase
          .from('fireworks')
          .select('id, firework_effect_id')
          .in('id', approval.firework_ids)
      : { data: [], error: null };
  if (createdFireworksError) {
    console.error(
      '[approveImportJobAction] post-approval firework lookup failed:',
      createdFireworksError,
    );
  }

  await invalidateAdminImportsCache();
  await invalidateAdminCatalogueCache();
  await Promise.all(
    approval.firework_ids.map((fireworkId) => invalidateAdminFireworksCache(fireworkId)),
  );
  await Promise.all(
    Array.from(
      new Set((createdFireworks ?? []).map((firework) => firework.firework_effect_id)),
    ).map((effectId) => invalidateAdminEffectsCache(effectId)),
  );
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/imports');
  revalidatePath('/admin/catalogue');
  revalidatePath('/admin/effects');
  for (const effectId of new Set(
    (createdFireworks ?? []).map((firework) => firework.firework_effect_id),
  )) {
    revalidatePath(`/admin/effects/${effectId}`);
  }
  revalidatePath('/admin/fireworks');
  approval.firework_ids.forEach((fireworkId) => {
    revalidatePath(`/admin/fireworks/${fireworkId}`);
  });
  if (approval.multishot_id) revalidatePath('/admin/multishots');
  revalidatePath(`/admin/imports/${parsed.data.id}`);
  return { ok: true };
}

/** Edit the metadata on an existing import job (kind, source, row count, status). */
export async function updateImportJobAction(formData: FormData): Promise<ImportJobMutationResult> {
  if (!(await requirePermission('admin.manage_imports'))) {
    return { ok: false, error: 'You do not have permission to manage imports.' };
  }
  const parsed = ImportJobSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get('id'),
    kind: formData.get('kind'),
    sourceName: formData.get('sourceName'),
    sourceUrl: formData.get('sourceUrl') ?? '',
    status: formData.get('status') ?? 'draft',
    rowCount: formData.get('rowCount') ?? '',
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.kind === 'firework_video') {
    return {
      ok: false,
      error: 'Video imports can only be changed through their reconstruction controls.',
    };
  }
  const rowCount = typeof parsed.data.rowCount === 'number' ? parsed.data.rowCount : null;
  const supabase = createClient(await cookies());
  const { data: updatedJob, error } = await supabase
    .from('import_jobs')
    .update({
      kind: parsed.data.kind,
      source_name: parsed.data.sourceName,
      source_url: parsed.data.sourceUrl || null,
      status: parsed.data.status,
      row_count: rowCount,
    })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[updateImportJobAction] failed:', error);
    return { ok: false, error: 'Import job could not be saved. Try again.' };
  }
  if (!updatedJob) {
    return { ok: false, error: 'That import job was not found. Refresh the page and try again.' };
  }
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  return { ok: true };
}

/** Archive video imports for audit; legacy imports retain their hard-delete path. */
export async function deleteImportJobAction(formData: FormData): Promise<ImportJobMutationResult> {
  if (!(await requirePermission('admin.manage_imports'))) {
    return { ok: false, error: 'You do not have permission to manage imports.' };
  }
  const parsed = IdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const supabase = createClient(await cookies());
  const { data: job, error: lookupError } = await supabase
    .from('import_jobs')
    .select('kind')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (lookupError || !job) {
    console.error('[deleteImportJobAction] import lookup failed:', lookupError);
    return { ok: false, error: 'That import job was not found. Refresh the page and try again.' };
  }

  if (job.kind === 'firework_video') {
    const { data: archivedId, error: archiveError } = await callUntypedRpc<string>(
      supabase,
      'archive_firework_import_job',
      { p_job_id: parsed.data.id },
    );
    if (archiveError || archivedId !== parsed.data.id) {
      console.error('[deleteImportJobAction] video archive failed:', archiveError);
      return { ok: false, error: archiveError?.message ?? 'Import job could not be archived.' };
    }
    await invalidateAdminImportsCache();
    revalidatePath('/admin/imports');
    revalidatePath(`/admin/imports/${parsed.data.id}`);
    return { ok: true };
  }

  const { data: deletedJob, error } = await supabase
    .from('import_jobs')
    .delete()
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[deleteImportJobAction] failed:', error);
    return { ok: false, error: 'Import job could not be deleted. Try again.' };
  }
  if (!deletedJob) {
    return { ok: false, error: 'That import job was not found. Refresh the page and try again.' };
  }
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  return { ok: true };
}
