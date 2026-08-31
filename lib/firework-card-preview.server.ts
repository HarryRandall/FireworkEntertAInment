import 'server-only';

import { createHash } from 'node:crypto';
import type { AdminStyleDefaultLinkMap } from '@/lib/admin.types';
import { getAdminEffectById } from '@/lib/admin/effects.server';
import { getAdminFireworkById } from '@/lib/admin/fireworks.server';
import { getMultishotById } from '@/lib/admin/multishots.server';
import { getAdminStyleDefaultPreviewSourceById } from '@/lib/admin/style-defaults.server';
import {
  FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS,
  fireworkCardPreviewShotTimeSeconds,
  type AdminFireworkCardPreviewPayload,
  type FireworkCardPreviewCue,
  type FireworkCardPreviewKind,
  type FireworkCardPreviewPayload,
} from '@/lib/firework-card-preview';
import { FIREWORK_PREVIEW_RENDERER_VERSION } from '@/lib/firework-preview-image';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
} from '@/lib/fireworks/design';
import {
  compileStyleDefaultPreviewDesign,
  makeTrailPreviewStarDefaults,
  orderedStyleDefaultValues,
} from '@/lib/fireworks/style-defaults';
import { DEFAULT_FIREWORK_SPEC } from '@/lib/fireworks/spec';
import { SHOW_CARD_PREVIEW_WINDOW_SECONDS } from '@/lib/show-preview';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import {
  parseReconstructionShotVariant,
  type ReconstructionShotMetadata,
} from '@/lib/reconstruction-shot';
import {
  fetchShotsByCatalogueItem,
  listFireworkSpecifications,
  ShowsNetworkError,
} from '@/lib/shows/queries.server';
import { getCatalogueReadClient } from '@/lib/shows/supabase';
import { getServerClient } from '@/utils/supabase/server-client';

export type AdminFireworkCardPreviewKind = Exclude<FireworkCardPreviewKind, 'catalogue'>;
export type AdminFireworkCardPreviewSourceKind = AdminFireworkCardPreviewKind | 'style-default';

export const FIREWORK_CARD_PREVIEW_MAX_CUES = 80;

const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_LEAD_SECONDS = 0.3;
const MIN_PREVIEW_DURATION_SECONDS = 4;
const MANIFEST_SOURCE_COLUMN = {
  effect: 'firework_effect_id',
  firework: 'firework_id',
  multishot: 'multishot_id',
} as const satisfies Record<AdminFireworkCardPreviewKind, string>;

export class FireworkCardPreviewReadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'FireworkCardPreviewReadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasConcreteRendererColour(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const renderDefaults = isRecord(value.renderDefaults) ? value.renderDefaults : {};
  const colour = renderDefaults.color ?? value.color;
  return colour !== undefined && colour !== 'random';
}

function linkedStyleDefaults(links: AdminStyleDefaultLinkMap): unknown[] {
  return orderedStyleDefaultValues(links).map((item) => item?.defaultsJson);
}

function previewDurationForCues(cues: ReplayCue[]): number {
  const contentEnd = cues.reduce((latest, cue) => {
    const designDuration = cue.firework.renderDesign
      ? estimateDesignDurationSeconds(cue.firework.renderDesign)
      : (cue.firework.durationSeconds ?? 0);
    return Math.max(latest, cue.timeSeconds + designDuration);
  }, 0);
  const rounded = Math.ceil(contentEnd * 2) / 2;
  return Math.min(
    SHOW_CARD_PREVIEW_WINDOW_SECONDS,
    Math.max(MIN_PREVIEW_DURATION_SECONDS, rounded),
  );
}

function boundSequenceCues(cues: ReplayCue[]): ReplayCue[] {
  if (cues.length === 0) return [];
  const ordered = [...cues].sort((a, b) => {
    if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
    return a.position - b.position;
  });
  const previewStart = Math.max(0, ordered[0]!.timeSeconds - PREVIEW_LEAD_SECONDS);
  const previewEnd = previewStart + SHOW_CARD_PREVIEW_WINDOW_SECONDS;

  return ordered
    .filter((cue) => cue.timeSeconds >= previewStart && cue.timeSeconds <= previewEnd)
    .slice(0, FIREWORK_CARD_PREVIEW_MAX_CUES)
    .map((cue) => ({
      ...cue,
      timeSeconds: Math.max(0, cue.timeSeconds - previewStart),
    }));
}

function normalisePreviewPayload(cues: ReplayCue[]): FireworkCardPreviewPayload | null {
  const boundedCues = boundSequenceCues(cues);
  if (boundedCues.length === 0) return null;

  const specificationsById = new Map<string, FireworkSpecification>();
  const previewCues: FireworkCardPreviewCue[] = boundedCues.map((cue) => {
    const renderSpecification = {
      ...cue.firework,
    } as FireworkSpecification & {
      previewImagePath?: unknown;
      previewImageRevision?: unknown;
    };
    delete renderSpecification.previewImagePath;
    delete renderSpecification.previewImageRevision;
    specificationsById.set(cue.firework.id, renderSpecification);
    const { firework, ...serialisableCue } = cue;
    return { ...serialisableCue, fireworkId: firework.id };
  });

  return {
    specifications: [...specificationsById.values()],
    cues: previewCues,
    durationSeconds: previewDurationForCues(boundedCues),
  };
}

function singlePreviewCue(
  firework: FireworkSpecification,
  reconstructionShot: ReconstructionShotMetadata | null = null,
): ReplayCue {
  return {
    id: `${firework.id}-card-preview`,
    position: 1,
    timeSeconds: FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS,
    description: firework.name,
    productId: firework.id,
    launchPositionIndex: reconstructionShot?.launchPositionIndex ?? 0,
    seedOverride: reconstructionShot?.seedOverride ?? null,
    shotPanDegrees: reconstructionShot?.panDegrees ?? null,
    shotTiltDegrees: reconstructionShot?.tiltDegrees ?? null,
    shotPositionOverride: reconstructionShot?.positionOverride ?? null,
    firework,
  };
}

async function loadFireworkReconstructionShot(
  fireworkId: string,
): Promise<ReconstructionShotMetadata | null> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('fireworks')
    .select('variant_json')
    .eq('id', fireworkId)
    .maybeSingle();
  if (error) {
    throw new FireworkCardPreviewReadError('Could not load firework launch metadata.', error);
  }
  if (!data) {
    throw new FireworkCardPreviewReadError('Firework preview source changed while it was loading.');
  }
  return parseReconstructionShotVariant(data.variant_json);
}

async function adminEntityExists(kind: AdminFireworkCardPreviewKind, id: string): Promise<boolean> {
  const supabase = await getServerClient();
  const result =
    kind === 'effect'
      ? await supabase.from('firework_effects').select('id').eq('id', id).maybeSingle()
      : kind === 'firework'
        ? await supabase.from('fireworks').select('id').eq('id', id).maybeSingle()
        : await supabase.from('multishots').select('id').eq('id', id).maybeSingle();

  if (result.error) {
    throw new FireworkCardPreviewReadError(
      `Could not verify ${kind} preview source.`,
      result.error,
    );
  }
  return Boolean(result.data);
}

async function loadEffectPreview(id: string): Promise<FireworkCardPreviewPayload | null> {
  const effect = await getAdminEffectById(id);
  if (!effect) {
    if (await adminEntityExists('effect', id)) {
      throw new FireworkCardPreviewReadError('Could not load effect preview source.');
    }
    return null;
  }

  const baseModel = canonicaliseEffectModelJson(effect.modelJson);
  const effectStyleDefaults = linkedStyleDefaults(effect.styleDefaultLinks);
  const hasConcreteColour = [baseModel, ...effectStyleDefaults].some(hasConcreteRendererColour);
  const design = compileFireworkDesign({
    baseModel,
    effectStyleDefaults,
    primaryColor: hasConcreteColour ? null : PREVIEW_COLOR,
  });
  const durationSeconds = Math.max(
    MIN_PREVIEW_DURATION_SECONDS,
    Math.ceil(
      (FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(design)) * 2,
    ) / 2,
  );
  const firework: FireworkSpecification = {
    id: effect.id,
    slug: effect.slug,
    name: effect.name,
    description: effect.description,
    sortOrder: effect.sortOrder,
    durationSeconds,
    heightMeters: null,
    caliber: null,
    shotCount: 1,
    spec: DEFAULT_FIREWORK_SPEC,
    rawSpec: baseModel,
    renderDesign: design,
    baseEffect: {
      id: effect.id,
      slug: effect.slug,
      name: effect.name,
      patternKey: effect.patternKey,
    },
    variant: null,
  };
  return normalisePreviewPayload([singlePreviewCue(firework)]);
}

async function loadStyleDefaultPreview(id: string): Promise<FireworkCardPreviewPayload | null> {
  const styleDefault = await getAdminStyleDefaultPreviewSourceById(id);
  if (!styleDefault) return null;

  const design = compileStyleDefaultPreviewDesign(
    styleDefault.kind,
    styleDefault.defaultsJson,
    styleDefault.kind === 'trail' ? makeTrailPreviewStarDefaults() : undefined,
  );
  const durationSeconds = Math.max(
    MIN_PREVIEW_DURATION_SECONDS,
    Math.ceil(
      (FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(design)) * 2,
    ) / 2,
  );
  const firework: FireworkSpecification = {
    id: styleDefault.id,
    slug: styleDefault.slug,
    name: styleDefault.name,
    description: styleDefault.description,
    sortOrder: styleDefault.sortOrder,
    durationSeconds,
    heightMeters: null,
    caliber: null,
    shotCount: 1,
    spec: DEFAULT_FIREWORK_SPEC,
    rawSpec: styleDefault.defaultsJson,
    renderDesign: design,
    baseEffect: null,
    variant: null,
  };
  return normalisePreviewPayload([singlePreviewCue(firework)]);
}

async function loadFireworkPreview(id: string): Promise<FireworkCardPreviewPayload | null> {
  const firework = await getAdminFireworkById(id);
  if (!firework) {
    if (await adminEntityExists('firework', id)) {
      throw new FireworkCardPreviewReadError('Could not load firework preview source.');
    }
    return null;
  }

  const design = compileFireworkDesign({
    baseModel: firework.effectModelJson,
    fireworkStyleDefaults: linkedStyleDefaults(firework.fireworkStyleDefaultLinks),
    variantOverrides: firework.renderOverridesJson,
    primaryColor: firework.primaryColor ?? firework.colorPalette[0] ?? null,
    colorPalette: firework.colorPalette,
  });
  const specification: FireworkSpecification = {
    id: firework.id,
    slug: firework.slug,
    name: firework.name,
    description: firework.description,
    sortOrder: 0,
    durationSeconds: firework.durationSeconds,
    heightMeters: firework.heightMeters,
    caliber: firework.caliber,
    shotCount: 1,
    spec: DEFAULT_FIREWORK_SPEC,
    rawSpec: firework.renderOverridesJson,
    renderDesign: design,
    baseEffect:
      firework.effectId && firework.effectSlug && firework.effectName && firework.patternKey
        ? {
            id: firework.effectId,
            slug: firework.effectSlug,
            name: firework.effectName,
            patternKey: firework.patternKey,
          }
        : null,
    variant: {
      id: firework.id,
      slug: firework.slug,
      primaryColor: firework.primaryColor,
      secondaryColor: firework.secondaryColor,
      colorPalette: firework.colorPalette,
    },
  };
  const reconstructionShot = await loadFireworkReconstructionShot(id);
  return normalisePreviewPayload([singlePreviewCue(specification, reconstructionShot)]);
}

async function verifyMissingFireworkSpecifications(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false;
  const supabase = await getServerClient();
  const { data, error } = await supabase.from('fireworks').select('id').in('id', ids);
  if (error) {
    throw new FireworkCardPreviewReadError('Could not verify multishot fireworks.', error);
  }
  return (data?.length ?? 0) > 0;
}

async function loadMultishotPreview(id: string): Promise<FireworkCardPreviewPayload | null> {
  const multishot = await getMultishotById(id);
  if (!multishot) {
    if (await adminEntityExists('multishot', id)) {
      throw new FireworkCardPreviewReadError('Could not load multishot preview source.');
    }
    return null;
  }

  let specifications: FireworkSpecification[];
  try {
    specifications = await listFireworkSpecifications();
  } catch (error) {
    throw new FireworkCardPreviewReadError('Could not load multishot firework designs.', error);
  }
  const specificationsById = new Map(
    specifications.map((specification) => [specification.id, specification]),
  );
  const referencedIds = [
    ...new Set(
      multishot.shots
        .map((shot) => shot.fireworkId)
        .filter((fireworkId): fireworkId is string => Boolean(fireworkId)),
    ),
  ];
  const missingIds = referencedIds.filter((fireworkId) => !specificationsById.has(fireworkId));
  if (await verifyMissingFireworkSpecifications(missingIds)) {
    throw new FireworkCardPreviewReadError('Multishot firework designs were not fully loaded.');
  }
  if (missingIds.length > 0) return null;

  const cues: ReplayCue[] = [];
  for (const shot of multishot.shots) {
    if (!shot.fireworkId) continue;
    const specification = specificationsById.get(shot.fireworkId);
    if (!specification) continue;
    cues.push({
      id: shot.id,
      position: shot.sequenceIndex,
      timeSeconds: Math.max(0.01, shot.timeOffsetSeconds),
      description: shot.fireworkName ?? specification.name,
      productId: shot.fireworkId,
      launchPositionIndex: shot.launchPositionIndex,
      firework: specification,
      shotPanDegrees: shot.panDegrees,
      shotTiltDegrees: shot.tiltDegrees,
      shotPositionOverride: null,
    });
  }
  return normalisePreviewPayload(cues);
}

export async function loadAdminFireworkCardPreview(
  kind: AdminFireworkCardPreviewSourceKind,
  id: string,
): Promise<FireworkCardPreviewPayload | null> {
  try {
    if (kind === 'style-default') return await loadStyleDefaultPreview(id);
    if (kind === 'effect') return await loadEffectPreview(id);
    if (kind === 'firework') return await loadFireworkPreview(id);
    return await loadMultishotPreview(id);
  } catch (error) {
    if (error instanceof FireworkCardPreviewReadError) throw error;
    throw new FireworkCardPreviewReadError(`Could not load ${kind} card preview.`, error);
  }
}

type PreviewManifestState = {
  sourceRevision: number;
  storagePath: string | null;
};

async function loadPreviewManifestState(
  kind: AdminFireworkCardPreviewKind,
  id: string,
): Promise<PreviewManifestState | null> {
  const supabase = await getServerClient();
  const { data: manifest, error } = await supabase
    .from('firework_preview_images')
    .select('source_revision, storage_path')
    .eq(MANIFEST_SOURCE_COLUMN[kind], id)
    .maybeSingle();

  if (error) {
    throw new FireworkCardPreviewReadError(`Could not load ${kind} preview manifest.`, error);
  }
  if (!manifest) return null;
  if (!Number.isSafeInteger(manifest.source_revision) || manifest.source_revision < 1) {
    throw new FireworkCardPreviewReadError(`Could not resolve ${kind} preview manifest.`);
  }
  return {
    sourceRevision: manifest.source_revision,
    storagePath: manifest.storage_path,
  };
}

/**
 * Attach the current manifest revision and a signature for the exact render
 * payload. The revision guards database races while the signature rejects a
 * capture produced from different renderer input at the same revision.
 */
export async function loadAdminFireworkCardPreviewForPersistence(
  kind: AdminFireworkCardPreviewKind,
  id: string,
): Promise<AdminFireworkCardPreviewPayload | null> {
  const manifestBeforeRead = await loadPreviewManifestState(kind, id);
  if (manifestBeforeRead === null) {
    if (!(await loadAdminFireworkCardPreview(kind, id))) return null;
    throw new FireworkCardPreviewReadError(`Could not resolve ${kind} preview manifest.`);
  }
  const payload = await loadAdminFireworkCardPreview(kind, id);
  if (!payload) return null;
  const manifestAfterRead = await loadPreviewManifestState(kind, id);
  if (
    manifestAfterRead === null ||
    manifestBeforeRead.sourceRevision !== manifestAfterRead.sourceRevision ||
    manifestBeforeRead.storagePath !== manifestAfterRead.storagePath
  ) {
    throw new FireworkCardPreviewReadError(`${kind} preview source changed while it was loading.`);
  }

  const sourceSignature = createHash('sha256')
    .update(
      JSON.stringify({
        rendererVersion: FIREWORK_PREVIEW_RENDERER_VERSION,
        payload,
      }),
    )
    .digest('hex');

  return {
    ...payload,
    persistence: {
      kind,
      sourceId: id,
      sourceRevision: manifestAfterRead.sourceRevision,
      sourceSignature,
      expectedStoragePath: manifestAfterRead.storagePath,
    },
  };
}

export async function loadCatalogueFireworkCardPreview(
  catalogueItemId: string,
): Promise<FireworkCardPreviewPayload | null> {
  try {
    const supabase = await getCatalogueReadClient();
    const shotsByCatalogueItem = await fetchShotsByCatalogueItem(supabase, [catalogueItemId], {
      failOnError: true,
    });
    const shots = shotsByCatalogueItem.get(catalogueItemId) ?? [];
    const cues: ReplayCue[] = shots.map((shot, index) => ({
      id: shot.sourceCueId,
      position: index + 1,
      timeSeconds: fireworkCardPreviewShotTimeSeconds(shot.kind, shot.timeOffsetSeconds),
      description: shot.firework.name,
      productId: catalogueItemId,
      launchPositionIndex: shot.launchPositionIndex ?? 0,
      seedOverride: shot.seedOverride,
      firework: shot.firework,
      shotPanDegrees: shot.panDegrees,
      shotTiltDegrees: shot.tiltDegrees,
      shotPositionOverride: shot.positionOverride,
    }));
    return normalisePreviewPayload(cues);
  } catch (error) {
    if (error instanceof FireworkCardPreviewReadError) throw error;
    if (error instanceof ShowsNetworkError) {
      throw new FireworkCardPreviewReadError('Could not read catalogue preview data.', error);
    }
    throw new FireworkCardPreviewReadError('Could not load catalogue card preview.', error);
  }
}
