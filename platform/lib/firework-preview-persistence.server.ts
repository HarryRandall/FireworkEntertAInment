import 'server-only';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminMultishotsCache,
} from '@/lib/admin/cache-keys';
import {
  loadAdminFireworkCardPreviewForPersistence,
  type AdminFireworkCardPreviewKind,
} from '@/lib/firework-card-preview.server';
import {
  FIREWORK_PREVIEW_BUCKET,
  FIREWORK_PREVIEW_RENDERER_VERSION,
} from '@/lib/firework-preview-image';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

const MANIFEST_SOURCE_COLUMN = {
  effect: 'firework_effect_id',
  firework: 'firework_id',
  multishot: 'multishot_id',
} as const satisfies Record<AdminFireworkCardPreviewKind, string>;

export type PersistFireworkPreviewImageInput = {
  kind: AdminFireworkCardPreviewKind;
  sourceId: string;
  sourceRevision: number;
  sourceSignature: string;
  expectedStoragePath: string | null;
  width: number;
  height: number;
  image: Buffer;
};

export type PersistFireworkPreviewImageResult =
  | { status: 'saved'; path: string; alreadyExisted: boolean }
  | { status: 'not_found' }
  | { status: 'stale' }
  | { status: 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExistingStorageObject(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const status = String(error.statusCode ?? error.status ?? '');
  const code = String(error.error ?? error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();
  return (
    status === '409' ||
    code.includes('duplicate') ||
    message.includes('already exists') ||
    message.includes('duplicate')
  );
}

async function removeStorageObject(
  service: NonNullable<ReturnType<typeof createServiceRoleSupabase>>,
  path: string,
): Promise<void> {
  const { error } = await service.storage.from(FIREWORK_PREVIEW_BUCKET).remove([path]);
  if (error) {
    console.error(`[firework-card-preview] orphan cleanup failed for ${path}:`, error);
  }
}

async function invalidatePreviewReads(
  kind: AdminFireworkCardPreviewKind,
  sourceId: string,
): Promise<void> {
  const sourceInvalidation =
    kind === 'effect'
      ? invalidateAdminEffectsCache(sourceId)
      : kind === 'firework'
        ? invalidateAdminFireworksCache(sourceId)
        : invalidateAdminMultishotsCache(sourceId);

  await Promise.all([
    sourceInvalidation,
    invalidateAdminCatalogueCache(),
    invalidateFireworkCatalogueCaches(),
  ]);

  const adminBase = `/admin/${kind === 'effect' ? 'effects' : `${kind}s`}`;
  revalidatePath(adminBase);
  revalidatePath(`${adminBase}/${sourceId}`);
  revalidatePath('/admin/catalogue');
  revalidatePath('/catalogue');
}

async function invalidatePreviewSourceCache(
  kind: AdminFireworkCardPreviewKind,
  sourceId: string,
): Promise<void> {
  if (kind === 'effect') {
    await invalidateAdminEffectsCache(sourceId);
  } else if (kind === 'firework') {
    await invalidateAdminFireworksCache(sourceId);
  } else {
    await invalidateAdminMultishotsCache(sourceId);
  }
}

/**
 * Store an immutable renderer still and publish it only if the visual source
 * revision and current manifest path are unchanged. A capture that loses the
 * database race never becomes the manifest's current image.
 */
export async function persistFireworkPreviewImage(
  input: PersistFireworkPreviewImageInput,
): Promise<PersistFireworkPreviewImageResult> {
  await invalidatePreviewSourceCache(input.kind, input.sourceId);
  const current = await loadAdminFireworkCardPreviewForPersistence(input.kind, input.sourceId);
  if (!current) return { status: 'not_found' };
  if (
    current.persistence.sourceRevision !== input.sourceRevision ||
    current.persistence.sourceSignature !== input.sourceSignature ||
    current.persistence.expectedStoragePath !== input.expectedStoragePath
  ) {
    return { status: 'stale' };
  }

  const service = createServiceRoleSupabase();
  if (!service) {
    console.error('[firework-card-preview] service role is not configured for poster upload.');
    return { status: 'unavailable' };
  }

  const { data: manifestBeforeUpload, error: manifestReadError } = await service
    .from('firework_preview_images')
    .select('storage_path')
    .eq(MANIFEST_SOURCE_COLUMN[input.kind], input.sourceId)
    .eq('source_revision', input.sourceRevision)
    .maybeSingle();
  if (manifestReadError) {
    console.error(
      `[firework-card-preview] manifest read failed for ${input.kind}/${input.sourceId}:`,
      manifestReadError,
    );
    return { status: 'unavailable' };
  }
  if (!manifestBeforeUpload) return { status: 'stale' };
  if (manifestBeforeUpload.storage_path !== input.expectedStoragePath) {
    return { status: 'stale' };
  }

  const contentSha = createHash('sha256').update(input.image).digest('hex');
  const path = `${FIREWORK_PREVIEW_RENDERER_VERSION}/${input.kind}/${input.sourceId}/r${input.sourceRevision}-${contentSha}.webp`;
  const { error: uploadError } = await service.storage
    .from(FIREWORK_PREVIEW_BUCKET)
    .upload(path, input.image, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
  const alreadyExisted = Boolean(uploadError && isExistingStorageObject(uploadError));
  if (uploadError && !alreadyExisted) {
    console.error(
      `[firework-card-preview] upload failed for ${input.kind}/${input.sourceId}:`,
      uploadError,
    );
    return { status: 'unavailable' };
  }

  const capturedAt = new Date().toISOString();
  let manifestUpdate = service
    .from('firework_preview_images')
    .update({
      renderer_version: FIREWORK_PREVIEW_RENDERER_VERSION,
      source_signature: input.sourceSignature,
      storage_path: path,
      width: input.width,
      height: input.height,
      captured_at: capturedAt,
      updated_at: capturedAt,
    })
    .eq(MANIFEST_SOURCE_COLUMN[input.kind], input.sourceId)
    .eq('source_revision', input.sourceRevision);
  manifestUpdate =
    input.expectedStoragePath === null
      ? manifestUpdate.is('storage_path', null)
      : manifestUpdate.eq('storage_path', input.expectedStoragePath);
  const { data: updatedManifest, error: updateError } = await manifestUpdate
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error(
      `[firework-card-preview] manifest update failed for ${input.kind}/${input.sourceId}:`,
      updateError,
    );
    if (!alreadyExisted) await removeStorageObject(service, path);
    return { status: 'unavailable' };
  }
  if (!updatedManifest) {
    if (!alreadyExisted) await removeStorageObject(service, path);
    return { status: 'stale' };
  }

  if (input.expectedStoragePath && input.expectedStoragePath !== path) {
    await removeStorageObject(service, input.expectedStoragePath);
  }

  await invalidatePreviewReads(input.kind, input.sourceId);
  return { status: 'saved', path, alreadyExisted };
}
