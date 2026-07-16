import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { requirePermission } from '@/lib/admin/current-user.server';
import {
  FireworkCardPreviewReadError,
  loadAdminFireworkCardPreviewForPersistence,
  type AdminFireworkCardPreviewKind,
} from '@/lib/firework-card-preview.server';
import { persistFireworkPreviewImage } from '@/lib/firework-preview-persistence.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' } as const;
const MAX_POSTER_BYTES = 1024 * 1024;
const POSTER_WIDTH = 640;
const POSTER_HEIGHT = 400;
const MAX_POSTER_INPUT_PIXELS = POSTER_WIDTH * POSTER_HEIGHT;
const ADMIN_PREVIEW_KINDS = new Set<AdminFireworkCardPreviewKind>([
  'effect',
  'firework',
  'multishot',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ kind: string; id: string }> };
type CaptureMetadata = {
  kind: AdminFireworkCardPreviewKind;
  sourceId: string;
  sourceRevision: number;
  sourceSignature: string;
  expectedStoragePath: string | null;
  width: number;
  height: number;
};

type ImageReadResult =
  | { ok: true; image: Buffer }
  | { ok: false; error: 'invalid_image' | 'too_large' };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readCaptureMetadata(request: Request): CaptureMetadata | null {
  const kind = request.headers.get('X-Firework-Preview-Kind');
  const sourceId = request.headers.get('X-Firework-Preview-Source-Id');
  const sourceRevision = parsePositiveInteger(
    request.headers.get('X-Firework-Preview-Source-Revision'),
  );
  const sourceSignature = request.headers.get('X-Firework-Preview-Source-Signature');
  const expectedStoragePathHeader = request.headers.get('X-Firework-Preview-Expected-Path');
  const expectedStoragePath =
    expectedStoragePathHeader === 'none' ? null : expectedStoragePathHeader;
  const width = parsePositiveInteger(request.headers.get('X-Firework-Preview-Width'));
  const height = parsePositiveInteger(request.headers.get('X-Firework-Preview-Height'));

  if (
    !kind ||
    !ADMIN_PREVIEW_KINDS.has(kind as AdminFireworkCardPreviewKind) ||
    !sourceId ||
    !UUID.test(sourceId) ||
    sourceRevision === null ||
    !sourceSignature ||
    !/^[0-9a-f]{64}$/.test(sourceSignature) ||
    !expectedStoragePathHeader ||
    (expectedStoragePath !== null && !/^[\x21-\x7e]{1,512}$/.test(expectedStoragePath)) ||
    width !== POSTER_WIDTH ||
    height !== POSTER_HEIGHT
  ) {
    return null;
  }

  return {
    kind: kind as AdminFireworkCardPreviewKind,
    sourceId,
    sourceRevision,
    sourceSignature,
    expectedStoragePath,
    width,
    height,
  };
}

function isWebp(image: Buffer): boolean {
  return (
    image.byteLength >= 12 &&
    image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP'
  );
}

async function isValidPosterWebp(image: Buffer): Promise<boolean> {
  const inputOptions = {
    animated: true,
    failOn: 'warning' as const,
    limitInputPixels: MAX_POSTER_INPUT_PIXELS,
  };

  try {
    const metadata = await sharp(image, inputOptions).metadata();
    if (
      metadata.format !== 'webp' ||
      metadata.width !== POSTER_WIDTH ||
      metadata.height !== POSTER_HEIGHT ||
      (metadata.pages ?? 1) !== 1 ||
      (metadata.pageHeight !== undefined && metadata.pageHeight !== POSTER_HEIGHT)
    ) {
      return false;
    }

    const decoded = await sharp(image, inputOptions).raw().toBuffer({ resolveWithObject: true });
    return decoded.info.width === POSTER_WIDTH && decoded.info.height === POSTER_HEIGHT;
  } catch {
    return false;
  }
}

async function readImage(request: Request): Promise<ImageReadResult> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 1) {
      return { ok: false, error: 'invalid_image' };
    }
    if (parsedLength > MAX_POSTER_BYTES) return { ok: false, error: 'too_large' };
  }
  if (!request.body) return { ok: false, error: 'invalid_image' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_POSTER_BYTES) {
      await reader.cancel();
      return { ok: false, error: 'too_large' };
    }
    chunks.push(value);
  }

  if (totalBytes === 0) return { ok: false, error: 'invalid_image' };
  const image = Buffer.concat(chunks, totalBytes);
  if (!isWebp(image) || !(await isValidPosterWebp(image))) {
    return { ok: false, error: 'invalid_image' };
  }
  return { ok: true, image };
}

export async function GET(_request: Request, context: RouteContext) {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return response({ error: 'forbidden' }, 403);
  }

  const { kind, id } = await context.params;
  if (!ADMIN_PREVIEW_KINDS.has(kind as AdminFireworkCardPreviewKind) || !UUID.test(id)) {
    return response({ error: 'not_found' }, 404);
  }

  try {
    const preview = await loadAdminFireworkCardPreviewForPersistence(
      kind as AdminFireworkCardPreviewKind,
      id,
    );
    if (!preview) return response({ error: 'not_found' }, 404);
    return response(preview);
  } catch (error) {
    if (error instanceof FireworkCardPreviewReadError) {
      console.error(`[firework-card-preview] admin ${kind}/${id} read failed:`, error);
      return response({ error: 'temporarily_unavailable' }, 503);
    }
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return response({ error: 'forbidden' }, 403);
  }

  const { kind, id } = await context.params;
  if (!ADMIN_PREVIEW_KINDS.has(kind as AdminFireworkCardPreviewKind) || !UUID.test(id)) {
    return response({ error: 'not_found' }, 404);
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'image/webp') return response({ error: 'invalid_image' }, 415);

  const metadata = readCaptureMetadata(request);
  if (!metadata || metadata.kind !== kind || metadata.sourceId !== id) {
    return response({ error: 'invalid_metadata' }, 400);
  }

  const image = await readImage(request);
  if (!image.ok) {
    return response({ error: image.error }, image.error === 'too_large' ? 413 : 400);
  }

  try {
    const result = await persistFireworkPreviewImage({ ...metadata, image: image.image });
    if (result.status === 'not_found') return response({ error: 'not_found' }, 404);
    if (result.status === 'stale') return response({ error: 'stale_preview' }, 409);
    if (result.status === 'unavailable') {
      return response({ error: 'temporarily_unavailable' }, 503);
    }
    return response({ ok: true, path: result.path }, result.alreadyExisted ? 200 : 201);
  } catch (error) {
    if (error instanceof FireworkCardPreviewReadError) {
      console.error(`[firework-card-preview] admin ${kind}/${id} persistence read failed:`, error);
      return response({ error: 'temporarily_unavailable' }, 503);
    }
    throw error;
  }
}
