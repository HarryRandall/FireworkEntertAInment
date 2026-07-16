/**
 * Import-job reads (list + detail).
 *
 * The detail page also needs a short-lived signed URL for the uploaded video,
 * which {@link createSignedImportVideoUrl} produces. We try the service-role
 * client first (works regardless of bucket policy) and fall back to the
 * user-scoped client.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { ImportJobDetail, ImportJobSummary } from '@/lib/admin.types';
import { IMPORT_VIDEO_BUCKET } from '@/lib/import-jobs';
import { getPreferredImportVideoSource } from '@/lib/import-video-preview.js';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { ADMIN_CACHE_TTL_SECONDS, getAdminImportsCacheKey } from './cache-keys';
import { requirePermission } from './current-user.server';
import {
  mapImportJob,
  mapImportOutput,
  mapMediaAsset,
  type ImportJobRow,
  type ImportOutputRow,
  type MediaAssetRow,
} from './mappers';
import { getServerClient } from './supabase';

function throwImportReadError(operation: string, error: unknown): never {
  console.error(`[admin.imports] ${operation} failed:`, error);
  throw new Error('Import data could not be loaded.', { cause: error });
}

/**
 * Mints a 1-hour signed URL for an import video, preferring the service-role
 * client and falling back to the caller's session.
 */
async function createSignedImportVideoUrl(
  storagePaths: string[],
  sessionSupabase: Awaited<ReturnType<typeof getServerClient>>,
): Promise<string> {
  const service = createServiceRoleSupabase();
  let lastError: unknown = new Error('Supabase Storage did not return a signed URL.');

  for (const storagePath of storagePaths) {
    if (service) {
      const svcResult = await service.storage
        .from(IMPORT_VIDEO_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);
      if (!svcResult.error && svcResult.data?.signedUrl) {
        return svcResult.data.signedUrl;
      }
      lastError = svcResult.error ?? lastError;
      console.error(
        '[admin.imports] createSignedImportVideoUrl service-role attempt failed:',
        svcResult.error ?? 'missing URL',
      );
    }

    const { data: signed, error: signedError } = await sessionSupabase.storage
      .from(IMPORT_VIDEO_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (!signedError && signed?.signedUrl) {
      return signed.signedUrl;
    }
    lastError = signedError ?? lastError;
    console.error(
      '[admin.imports] createSignedImportVideoUrl session attempt failed:',
      signedError ?? 'missing URL',
    );
  }

  throwImportReadError('createSignedImportVideoUrl', lastError);
}

/** Returns the import-job list, or `[]` when unauthorised. Cached. */
export async function listImportJobs(
  view: 'active' | 'archived' = 'active',
): Promise<ImportJobSummary[]> {
  if (!(await requirePermission('admin.manage_imports'))) return [];
  const cacheKey = getAdminImportsCacheKey(view);
  const cached = await getCachedJson<ImportJobSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  let query = supabase
    .from('import_jobs')
    .select(
      'id, created_by, kind, status, source_name, source_url, media_asset_id, selected_model, processing_progress, processor_version, approved_catalogue_item_id, row_count, error_message, archived_at, archived_by, started_at, completed_at, created_at, updated_at',
    )
    .order('updated_at', { ascending: false });
  query =
    view === 'archived' ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  const { data, error } = await query;
  if (error) {
    throwImportReadError('listImportJobs', error);
  }
  const mapped = ((data ?? []) as ImportJobRow[]).map(mapImportJob);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

/**
 * Returns one import job with its media asset, outputs, and a freshly-signed
 * video URL (when the asset has one). Returns `null` if the caller lacks
 * `admin.manage_imports` or the job doesn't exist.
 */
export async function getImportJobDetail(jobId: string): Promise<ImportJobDetail | null> {
  if (!(await requirePermission('admin.manage_imports'))) return null;
  const supabase = await getServerClient();
  const { data: job, error: jobError } = await supabase
    .from('import_jobs')
    .select(
      'id, created_by, kind, status, source_name, source_url, media_asset_id, selected_model, processing_progress, processor_version, approved_catalogue_item_id, row_count, error_message, archived_at, archived_by, started_at, completed_at, created_at, updated_at',
    )
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) {
    throwImportReadError('getImportJobDetail', jobError);
  }
  if (!job) return null;

  const [mediaResult, outputsResult] = await Promise.all([
    job.media_asset_id
      ? supabase
          .from('media_assets')
          .select(
            'id, owner_id, source_type, url, storage_path, mime_type, duration_seconds, width, height, metadata, created_at',
          )
          .eq('id', job.media_asset_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('import_outputs')
      .select('id, import_job_id, output_type, payload, created_at')
      .eq('import_job_id', job.id)
      .order('created_at', { ascending: true }),
  ]);

  if (mediaResult.error) {
    throwImportReadError('getImportJobDetail media lookup', mediaResult.error);
  }
  if (outputsResult.error) {
    throwImportReadError('getImportJobDetail outputs lookup', outputsResult.error);
  }

  const media = mediaResult.data ? mapMediaAsset(mediaResult.data as MediaAssetRow) : null;
  const preferredVideo = media
    ? getPreferredImportVideoSource(media)
    : { storagePath: null, mimeType: null };
  let videoUrl = media?.url ?? job.source_url ?? null;
  if (preferredVideo.storagePath) {
    const storagePaths = [preferredVideo.storagePath];
    if (media?.storagePath && media.storagePath !== preferredVideo.storagePath) {
      storagePaths.push(media.storagePath);
    }
    const signedUrl = await createSignedImportVideoUrl(storagePaths, supabase);
    videoUrl = signedUrl;
  }

  return {
    ...mapImportJob(job as ImportJobRow),
    mediaAsset: media,
    outputs: ((outputsResult.data ?? []) as ImportOutputRow[]).map(mapImportOutput),
    videoUrl,
    videoMimeType: preferredVideo.mimeType ?? media?.mimeType ?? null,
  };
}
