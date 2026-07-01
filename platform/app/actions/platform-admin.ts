/**
 * Platform admin server actions.
 *
 * This file groups every server action used by the admin imports flow plus
 * the (single) profile action. Each exported function is a Next.js Server
 * Action — invoked from a `<form action={...}>` or `useActionState` hook on
 * the client — so they:
 *
 * - Use `revalidatePath` to refresh server-rendered pages after a write
 * - Call `requirePermission` to gate by RBAC (silently no-op when denied,
 *   so a broken UI can't trick a non-admin into thinking a write succeeded)
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

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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
import { slugifyTitle } from '@/lib/show-domain';
import {
  DEFAULT_OPENROUTER_MODEL,
  IMPORT_VIDEO_BUCKET,
  ImportedFireworkSpecSchema,
  latestImportedSpecFromOutputs,
  MAX_IMPORT_VIDEO_SECONDS,
  OPENROUTER_MODEL_OPTIONS,
  type ImportedFireworkSpec,
} from '@/lib/import-jobs';
import { compileFireworkDesign } from '@/lib/fireworks/design';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows.server';
import type { Json } from '@/lib/database.types';

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

const VideoImportSchema = z.object({
  sourceName: z.string().trim().min(1).max(180),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  reportedDurationSeconds: z.coerce
    .number()
    .min(0)
    .max(MAX_IMPORT_VIDEO_SECONDS)
    .optional()
    .or(z.literal('')),
});

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
    .max(500 * 1024 * 1024),
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
});

const RefinementSchema = z.object({
  id: z.string().uuid(),
  selectedModel: ModelSchema.default(DEFAULT_OPENROUTER_MODEL),
  prompt: z.string().trim().min(3).max(2000),
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

type ProductKind =
  | 'single_shot'
  | 'multi_shot'
  | 'assortment'
  | 'cake'
  | 'rack'
  | 'shell_kit'
  | 'fountain'
  | 'other';

function hexColour(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function collectSpecColours(spec: ImportedFireworkSpec['spec']): string[] {
  const seen = new Set<string>();
  const colours: string[] = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const colour = hexColour(value);
    if (!colour || seen.has(colour)) return;
    seen.add(colour);
    colours.push(colour);
  };

  add(spec.outerColor);
  add(spec.color);
  add(spec.colorPalette);
  add(spec.innerColor);
  add(spec.secondColor);
  add(spec.pistilColor);
  add(spec.tailColor);
  add(spec.glitterColor);
  add(spec.launch?.tailColor);
  add(spec.launch?.tracerColor);
  return colours;
}

function baseEffectSlugForImport(spec: ImportedFireworkSpec['spec']): string {
  if (spec.crackle || spec.shellType === 'crackle') return 'crackle';
  if (spec.strobe || spec.shellType === 'strobe') return 'strobe';
  if (spec.crossette || spec.shellType === 'crossette') return 'crossette';
  if (spec.horsetail || spec.shellType === 'horsetail') return 'horsetail';
  if (spec.ring || spec.shellType === 'ring') return 'ring';
  if (spec.shellType === 'palm') return 'palm';
  if (spec.shellType === 'willow' || spec.fallingLeaves || spec.shellType === 'fallingLeaves') {
    return 'willow';
  }
  if (spec.shellType === 'comet') return 'comet';
  if (spec.glitter && spec.glitter !== 'none') return 'chrysanthemum';
  return 'peony';
}

function productKindForImport(
  spec: ImportedFireworkSpec['spec'],
  category: string | undefined,
  fireworkType: string | undefined,
): ProductKind {
  const text = `${category ?? ''} ${fireworkType ?? ''}`.toLowerCase();
  if (text.includes('assortment')) return 'assortment';
  if (text.includes('shell kit') || text.includes('reloadable')) return 'shell_kit';
  if (text.includes('fountain')) return 'fountain';
  if (text.includes('rack')) return 'rack';
  if (text.includes('cake')) return 'cake';
  if ((spec.shots?.length ?? 0) > 1) return 'multi_shot';
  return 'single_shot';
}

/** Make a filename safe to embed in a Supabase Storage path. */
function sanitizeStorageName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'firework-video'
  );
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

/**
 * Returns the most recent normalised firework spec for an import job, walking
 * its `import_outputs` rows in chronological order. Returns `null` when no
 * usable spec has been produced yet.
 */
async function latestSpecForImport(importJobId: string): Promise<ImportedFireworkSpec | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('import_outputs')
    .select('output_type, payload, created_at')
    .eq('import_job_id', importJobId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[latestSpecForImport] failed:', error);
    return null;
  }
  return latestImportedSpecFromOutputs(
    (data ?? []).map((row) => ({
      outputType: row.output_type,
      payload: row.payload,
    })),
  );
}

// ===========================================================================
// 3. Profile actions
// ===========================================================================

type ProfilePatch = {
  fullName?: string;
  phone?: string;
  themePreference?: 'dark' | 'light' | 'system';
};

/**
 * Patch the current user's profile (display name, phone, theme).
 *
 * Empty strings clear the field on the server. Returns a structured result
 * so the client can show a toast — never throws on validation errors.
 */
export async function updateProfileAction(
  input: ProfilePatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) {
    console.error('[updateProfileAction] failed:', error);
    return { ok: false, error: 'Could not save changes' };
  }
  await invalidateUserProfileCache(userId);
  revalidatePath('/settings/profile');
  revalidatePath('/home');
  return { ok: true };
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
 * Legacy "all-in-one" video upload action: receives the file bytes via
 * FormData, uploads to storage, creates the media + import-job rows, then
 * redirects to the new job's detail page.
 *
 * Modern callers use {@link finalizeVideoImportJobAction} instead because
 * Vercel caps Server Action bodies at 4.5 MB regardless of `bodySizeLimit`.
 */
export async function createVideoImportJobAction(
  _state: ImportUploadActionState,
  formData: FormData,
): Promise<ImportUploadActionState> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) {
    return { ok: false, error: 'You do not have permission to manage imports.' };
  }

  const parsed = VideoImportSchema.safeParse({
    sourceName: formData.get('sourceName'),
    selectedModel: formData.get('selectedModel') ?? DEFAULT_OPENROUTER_MODEL,
    reportedDurationSeconds: formData.get('reportedDurationSeconds') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const file = formData.get('videoFile');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a video file before uploading.' };
  }
  // Some browsers report an empty file.type for less common containers
  // (e.g. MPEG-4 SP). Accept those too if the file extension is a video
  // container — the bucket's allowed_mime_types will still reject anything
  // truly unsupported, and the worker re-probes with ffprobe.
  const looksLikeVideoByName = /\.(mp4|m4v|mov|webm|mkv)$/i.test(file.name);
  if (!file.type.startsWith('video/') && !looksLikeVideoByName) {
    return { ok: false, error: 'Choose a supported video file.' };
  }
  // When the browser hasn't filled in a mime, infer one from the extension so
  // the upload doesn't get blocked by the bucket's allowed_mime_types check.
  const inferredContentType =
    file.type && file.type.startsWith('video/')
      ? file.type
      : /\.mov$/i.test(file.name)
        ? 'video/quicktime'
        : /\.webm$/i.test(file.name)
          ? 'video/webm'
          : /\.mkv$/i.test(file.name)
            ? 'video/x-matroska'
            : 'video/mp4';

  const supabase = createClient(await cookies());
  const storagePath = `${admin.id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(IMPORT_VIDEO_BUCKET)
    .upload(storagePath, file, {
      contentType: inferredContentType,
      upsert: false,
    });
  if (uploadError) {
    console.error('[createVideoImportJobAction] upload failed:', uploadError);
    const detail = uploadError.message ?? '';
    // Surface the underlying storage failure so the operator can act on it
    // instead of always blaming a missing migration.
    return {
      ok: false,
      error: detail
        ? `Video upload failed: ${detail}`
        : 'Video upload failed. Apply migration 0008 first so the import-videos storage bucket exists.',
    };
  }

  const duration =
    typeof parsed.data.reportedDurationSeconds === 'number'
      ? parsed.data.reportedDurationSeconds
      : null;
  const { data: media, error: mediaError } = await supabase
    .from('media_assets')
    .insert({
      owner_id: admin.id,
      source_type: 'upload',
      storage_path: storagePath,
      mime_type: file.type || null,
      duration_seconds: duration,
      metadata: {
        originalName: file.name,
        sizeBytes: file.size,
      } as Json,
    })
    .select('id')
    .single();
  if (mediaError || !media) {
    console.error('[createVideoImportJobAction] media insert failed:', mediaError);
    return {
      ok: false,
      error: 'Could not create the media record. Apply migration 0008 and try again.',
    };
  }

  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      kind: 'firework_video',
      status: 'queued',
      source_name: parsed.data.sourceName,
      media_asset_id: media.id,
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      created_by: admin.id,
      row_count: 0,
    })
    .select('id')
    .single();
  if (jobError || !job) {
    console.error('[createVideoImportJobAction] import job insert failed:', jobError);
    return {
      ok: false,
      error: 'Could not create the import job. Apply migration 0008 and try again.',
    };
  }

  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  redirect(`/admin/imports/${job.id}`);
}

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
  const { data: media, error: mediaError } = await supabase
    .from('media_assets')
    .insert({
      owner_id: admin.id,
      source_type: 'upload',
      storage_path: parsed.data.storagePath,
      mime_type: parsed.data.contentType,
      duration_seconds: duration,
      metadata: {
        originalName: parsed.data.originalName,
        sizeBytes: parsed.data.sizeBytes,
      } as Json,
    })
    .select('id')
    .single();
  if (mediaError || !media) {
    console.error('[finalizeVideoImportJobAction] media insert failed:', mediaError);
    return {
      ok: false,
      error:
        mediaError?.message ??
        'Could not create the media record. Apply migration 0008 and try again.',
    };
  }

  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .insert({
      kind: 'firework_video',
      status: 'queued',
      source_name: parsed.data.sourceName,
      media_asset_id: media.id,
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      created_by: admin.id,
      row_count: 0,
    })
    .select('id')
    .single();
  if (jobError || !job) {
    console.error('[finalizeVideoImportJobAction] import job insert failed:', jobError);
    return {
      ok: false,
      error:
        jobError?.message ?? 'Could not create the import job. Apply migration 0008 and try again.',
    };
  }

  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  redirect(`/admin/imports/${job.id}`);
}

// ===========================================================================
// 6. Import lifecycle (queue / refine / draft / approve / update / delete)
// ===========================================================================

/** Re-queue an import job for processing (also resets progress + errors). */
export async function queueImportJobAction(formData: FormData): Promise<void> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return;
  const parsed = QueueImportSchema.safeParse({
    id: formData.get('id'),
    selectedModel: formData.get('selectedModel') ?? DEFAULT_OPENROUTER_MODEL,
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('import_jobs')
    .update({
      status: 'queued',
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_by: admin.id,
    })
    .eq('id', parsed.data.id);
  if (error) {
    console.error('[queueImportJobAction] failed:', error);
    return;
  }
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
  revalidatePath(`/admin/imports/${parsed.data.id}`);
}

/**
 * Request an LLM-driven refinement of the current spec with a free-text
 * prompt. Records the prompt + current spec snapshot in `import_outputs`
 * then re-queues the job for processing.
 */
export async function requestImportRefinementAction(formData: FormData): Promise<void> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return;
  const parsed = RefinementSchema.safeParse({
    id: formData.get('id'),
    selectedModel: formData.get('selectedModel') ?? DEFAULT_OPENROUTER_MODEL,
    prompt: formData.get('prompt'),
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const currentSpec = await latestSpecForImport(parsed.data.id);
  const supabase = createClient(await cookies());
  const { error: outputError } = await supabase.from('import_outputs').insert({
    import_job_id: parsed.data.id,
    output_type: 'refinement',
    payload: {
      prompt: parsed.data.prompt,
      requestedModel: parsed.data.selectedModel,
      requestedBy: admin.id,
      spec: currentSpec,
    } as Json,
  });
  if (outputError) {
    console.error('[requestImportRefinementAction] output failed:', outputError);
    return;
  }

  const { error: jobError } = await supabase
    .from('import_jobs')
    .update({
      status: 'queued',
      selected_model: parsed.data.selectedModel,
      processing_progress: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', parsed.data.id);
  if (jobError) console.error('[requestImportRefinementAction] job failed:', jobError);
  await invalidateAdminImportsCache();
  revalidatePath(`/admin/imports/${parsed.data.id}`);
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

  const supabase = createClient(await cookies());
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
export async function approveImportJobAction(formData: FormData): Promise<void> {
  const importAdmin = await requirePermission('admin.manage_imports');
  const catalogueAdmin = await requirePermission('admin.manage_catalogue');
  if (!importAdmin || !catalogueAdmin) return;
  const parsed = ApproveImportSchema.safeParse({
    id: formData.get('id'),
    partNumber: formData.get('partNumber'),
    name: formData.get('name'),
    manufacturer: formData.get('manufacturer') ?? '',
    category: formData.get('category') ?? '',
    fireworkType: formData.get('fireworkType') ?? '',
  });
  if (!parsed.success) return console.error(firstError(parsed.error));

  const spec = await latestSpecForImport(parsed.data.id);
  if (!spec) {
    console.error('[approveImportJobAction] no valid generated spec');
    return;
  }

  const supabase = createClient(await cookies());
  const baseEffectSlug = baseEffectSlugForImport(spec.spec);
  const fireworkSlug = `${slugifyTitle(parsed.data.name)}-${parsed.data.id.slice(0, 8)}`;
  const variantSlug = `${baseEffectSlug}-${fireworkSlug}`;
  const fireworkSpec = spec.spec;
  const colours = collectSpecColours(fireworkSpec);
  const { data: baseEffect, error: baseEffectError } = await supabase
    .from('firework_effects')
    .select('id')
    .eq('slug', baseEffectSlug)
    .maybeSingle();
  if (baseEffectError || !baseEffect) {
    console.error('[approveImportJobAction] base effect lookup failed:', baseEffectError);
    return;
  }

  const { data: variant, error: variantError } = await supabase
    .from('fireworks')
    .insert({
      firework_effect_id: baseEffect.id,
      slug: variantSlug,
      name: parsed.data.name,
      description: spec.description || null,
      primary_color: colours[0] ?? null,
      secondary_color: colours[1] ?? null,
      color_palette: colours,
      caliber: spec.caliber ?? null,
      duration_seconds: spec.durationSeconds,
      height_meters: spec.heightMeters ?? null,
      variant_json: fireworkSpec as unknown as Json,
      render_overrides_json: compileFireworkDesign({ legacySpec: fireworkSpec }) as unknown as Json,
      source: 'video_inferred',
      confidence: spec.confidence,
    })
    .select('id')
    .single();
  if (variantError || !variant) {
    console.error('[approveImportJobAction] firework variant insert failed:', variantError);
    return;
  }

  const { data: catalogueItem, error: catalogueItemError } = await supabase
    .from('catalogue_items')
    .insert({
      part_number: parsed.data.partNumber,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer || null,
      firework_type: parsed.data.fireworkType || 'Video reconstructed',
      duration_seconds: spec.durationSeconds,
      description: spec.description || null,
      catalogue_item_kind: 'firework',
      firework_id: variant.id,
      metadata: {
        category: parsed.data.category || null,
        importJobId: parsed.data.id,
        source: 'video_import',
        baseEffectSlug,
        fireworkId: variant.id,
        legacyProductKind: productKindForImport(
          spec.spec,
          parsed.data.category,
          parsed.data.fireworkType,
        ),
      } as Json,
    })
    .select('id')
    .single();
  if (catalogueItemError || !catalogueItem) {
    console.error('[approveImportJobAction] catalogue item insert failed:', catalogueItemError);
    return;
  }

  const { error: jobError } = await supabase
    .from('import_jobs')
    .update({
      status: 'complete',
      processing_progress: 100,
      approved_catalogue_item_id: catalogueItem.id,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', parsed.data.id);
  if (jobError) console.error('[approveImportJobAction] job update failed:', jobError);
  await invalidateAdminImportsCache();
  await invalidateAdminCatalogueCache();
  await invalidateAdminEffectsCache(baseEffect.id);
  await invalidateAdminFireworksCache(variant.id);
  await invalidateFireworkCatalogueCaches();
  revalidatePath('/admin/imports');
  revalidatePath('/admin/catalogue');
  revalidatePath('/admin/effects');
  revalidatePath(`/admin/effects/${baseEffect.id}`);
  revalidatePath('/admin/fireworks');
  revalidatePath(`/admin/fireworks/${variant.id}`);
  revalidatePath(`/admin/imports/${parsed.data.id}`);
}

/** Edit the metadata on an existing import job (kind, source, row count, status). */
export async function updateImportJobAction(formData: FormData): Promise<void> {
  const admin = await requirePermission('admin.manage_imports');
  if (!admin) return;
  const parsed = ImportJobSchema.extend({ id: z.string().uuid() }).safeParse({
    id: formData.get('id'),
    kind: formData.get('kind'),
    sourceName: formData.get('sourceName'),
    sourceUrl: formData.get('sourceUrl') ?? '',
    status: formData.get('status') ?? 'draft',
    rowCount: formData.get('rowCount') ?? '',
  });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const rowCount = typeof parsed.data.rowCount === 'number' ? parsed.data.rowCount : null;
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from('import_jobs')
    .update({
      kind: parsed.data.kind,
      source_name: parsed.data.sourceName,
      source_url: parsed.data.sourceUrl || null,
      status: parsed.data.status,
      row_count: rowCount,
      created_by: admin.id,
    })
    .eq('id', parsed.data.id);
  if (error) console.error('[updateImportJobAction] failed:', error);
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
}

/** Hard-delete an import job and its dependent rows (cascade in the DB). */
export async function deleteImportJobAction(formData: FormData): Promise<void> {
  if (!(await requirePermission('admin.manage_imports'))) return;
  const parsed = IdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return console.error(firstError(parsed.error));
  const supabase = createClient(await cookies());
  const { error } = await supabase.from('import_jobs').delete().eq('id', parsed.data.id);
  if (error) console.error('[deleteImportJobAction] failed:', error);
  await invalidateAdminImportsCache();
  revalidatePath('/admin/imports');
}
