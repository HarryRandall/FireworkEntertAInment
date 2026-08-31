import type { LaunchPosition } from '@/lib/fireworks/design';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';

export type FireworkCardPreviewKind = 'effect' | 'firework' | 'multishot' | 'catalogue';

export const FIREWORK_CARD_PREVIEW_CUE_TIME_SECONDS = 0.05;

export type FireworkCardPreviewPersistence = {
  kind: Exclude<FireworkCardPreviewKind, 'catalogue'>;
  sourceId: string;
  sourceRevision: number;
  sourceSignature: string;
  expectedStoragePath: string | null;
};

/** A replay cue with its heavyweight firework specification normalised out. */
export type FireworkCardPreviewCue = {
  id: string;
  position: number;
  timeSeconds: number;
  description: string;
  productId: string;
  seedOverride?: number | null;
  launchPositionIndex: number;
  emphasis?: 'normal' | 'accent' | 'peak';
  shotPanDegrees?: number | null;
  shotTiltDegrees?: number | null;
  shotPositionOverride?: LaunchPosition | null;
  fireworkId: string;
};

/**
 * Network shape for a card preview. Specifications are sent once and referenced
 * by cues so a multishot does not repeat the same render design for every shot.
 */
export type FireworkCardPreviewPayload = {
  specifications: FireworkSpecification[];
  cues: FireworkCardPreviewCue[];
  durationSeconds: number;
  persistence?: FireworkCardPreviewPersistence;
};

export type AdminFireworkCardPreviewPayload = FireworkCardPreviewPayload & {
  persistence: FireworkCardPreviewPersistence;
};

/** Reattach normalised specifications before handing preview cues to the renderer. */
export function hydrateFireworkCardPreviewPayload(
  payload: FireworkCardPreviewPayload,
): ReplayCue[] {
  const specificationsById = new Map(
    payload.specifications.map((specification) => [specification.id, specification]),
  );

  return payload.cues.map((previewCue) => {
    const { fireworkId, ...cue } = previewCue;
    const firework = specificationsById.get(fireworkId);
    if (!firework) {
      throw new Error(`Preview cue ${previewCue.id} references missing firework ${fireworkId}.`);
    }
    return { ...cue, firework };
  });
}
