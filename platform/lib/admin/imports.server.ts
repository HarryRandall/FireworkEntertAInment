/**
 * Import-job reads (list + detail).
 *
 * The detail page also needs a short-lived signed URL for the uploaded video,
 * which {@link createSignedImportVideoUrl} produces. We try the service-role
 * client first (works regardless of bucket policy) and fall back to the
 * user-scoped client.
 *
 * The list query has a "fallback" branch: older deploys may be on a schema
 * missing the newer columns, so if the wide select fails we retry with a
 * narrow select and synthesise the new fields.
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

/**
 * Mints a 1-hour signed URL for an import video, preferring the service-role
 * client. Logs but never throws on failure — callers degrade to the raw URL.
 */
async function createSignedImportVideoUrl(
  storagePath: string,
  sessionSupabase: Awaited<ReturnType<typeof getServerClient>>,
): Promise<string | null> {
  const service = createServiceRoleSupabase();
  if (service) {
    const svcResult = await service.storage
      .from(IMPORT_VIDEO_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (!svcResult.error && svcResult.data?.signedUrl) {
      return svcResult.data.signedUrl;
    }
    console.error(
      '[admin.server] service-role import video signing failed:',
      svcResult.error?.message ?? 'unknown',
    );
  }

  const { data: signed, error: signedError } = await sessionSupabase.storage
    .from(IMPORT_VIDEO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedError || !signed?.signedUrl) {
    console.error(
      '[admin.server] session import video signing failed:',
      signedError?.message ?? 'missing URL',
    );
    return null;
  }
  return signed.signedUrl;
}

/** Returns the import-job list, or `[]` when unauthorised. Cached. */
export async function listImportJobs(): Promise<ImportJobSummary[]> {
  if (!(await requirePermission('admin.manage_imports'))) return [];
  const cacheKey = getAdminImportsCacheKey();
  const cached = await getCachedJson<ImportJobSummary[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('import_jobs')
    .select(
      'id, created_by, kind, status, source_name, source_url, media_asset_id, selected_model, processing_progress, processor_version, approved_catalogue_item_id, row_count, error_message, started_at, completed_at, created_at, updated_at',
    )
    .order('updated_at', { ascending: false });
  if (error) {
    // Older deployments are missing the wide column set — retry with a narrow
    // select and synthesise the missing fields rather than blowing up.
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('import_jobs')
      .select(
        'id, kind, status, source_name, source_url, row_count, error_message, created_at, updated_at',
      )
      .order('updated_at', { ascending: false });
    if (fallbackError) {
      console.error('[admin.server] listImportJobs failed:', fallbackError);
      return [];
    }
    const fallbackMapped = (
      (fallbackData ?? []) as Pick<
        ImportJobRow,
        | 'id'
        | 'kind'
        | 'status'
        | 'source_name'
        | 'source_url'
        | 'row_count'
        | 'error_message'
        | 'created_at'
        | 'updated_at'
      >[]
    ).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      mediaAssetId: null,
      selectedModel: null,
      processingProgress: row.status === 'complete' ? 100 : 0,
      approvedCatalogueItemId: null,
      rowCount: row.row_count,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    await setCachedJson(cacheKey, fallbackMapped, ADMIN_CACHE_TTL_SECONDS);
    return fallbackMapped;
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
      'id, created_by, kind, status, source_name, source_url, media_asset_id, selected_model, processing_progress, processor_version, approved_catalogue_item_id, row_count, error_message, started_at, completed_at, created_at, updated_at',
    )
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) {
    console.error('[admin.server] getImportJobDetail failed:', jobError);
    return null;
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
    console.error('[admin.server] import media lookup failed:', mediaResult.error);
  }
  if (outputsResult.error) {
    console.error('[admin.server] import outputs lookup failed:', outputsResult.error);
  }

  const media = mediaResult.data ? mapMediaAsset(mediaResult.data as MediaAssetRow) : null;
  const preferredVideo = media
    ? getPreferredImportVideoSource(media)
    : { storagePath: null, mimeType: null };
  let videoUrl = media?.url ?? job.source_url ?? null;
  if (preferredVideo.storagePath) {
    const signedUrl = await createSignedImportVideoUrl(preferredVideo.storagePath, supabase);
    if (signedUrl) {
      videoUrl = signedUrl;
    } else if (media?.storagePath && media.storagePath !== preferredVideo.storagePath) {
      // Preferred source (usually a normalised re-encode) didn't sign — try
      // the original upload path before giving up.
      const fallbackSignedUrl = await createSignedImportVideoUrl(media.storagePath, supabase);
      if (fallbackSignedUrl) {
        videoUrl = fallbackSignedUrl;
      }
    }
  }

  return {
    ...mapImportJob(job as ImportJobRow),
    mediaAsset: media,
    outputs: ((outputsResult.data ?? []) as ImportOutputRow[]).map(mapImportOutput),
    videoUrl,
    videoMimeType: preferredVideo.mimeType ?? media?.mimeType ?? null,
  };
}
