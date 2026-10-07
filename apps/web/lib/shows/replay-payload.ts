/** Deduplicated transport for current-renderer show replay, retaining the consumer cue shape. */
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';

type ReplayFirework = Omit<FireworkSpecification, 'spec' | 'rawSpec' | 'renderDesign'>;
type ReplayCueRef = Omit<ReplayCue, 'firework'> & { fireworkId: string };

/** Wire representation with each distinct shot specification stored once. */
export type ReplayCuePayload = {
  cues: ReplayCueRef[];
  fireworks: Record<string, ReplayFirework>;
};

/** Removes legacy renderer blobs and preserves distinct calibre and metadata variants. */
export function normaliseReplayCues(cues: readonly ReplayCue[]): ReplayCuePayload {
  const fireworks: Record<string, ReplayFirework> = {};
  const keysBySignature = new Map<string, string>();
  const refs = cues.map(({ firework, ...cue }) => {
    const current = { ...firework };
    // Legacy fields are required by the general editor contract, but absent on the wire.
    const lean: Partial<Pick<FireworkSpecification, 'spec' | 'rawSpec' | 'renderDesign'>> &
      ReplayFirework = current;
    delete lean.spec;
    delete lean.rawSpec;
    delete lean.renderDesign;
    // The same firework can appear at different calibres in different cakes.
    // Compare the complete retained specification rather than assuming id alone is unique.
    const signature = JSON.stringify(lean);
    let fireworkId = keysBySignature.get(signature);
    if (fireworkId === undefined) {
      fireworkId = `${firework.id}:${keysBySignature.size}`;
      keysBySignature.set(signature, fireworkId);
      fireworks[fireworkId] = lean;
    }
    return { ...cue, fireworkId };
  });
  return { cues: refs, fireworks };
}

/** Restores shared specifications for consumers using the current renderer only. */
export function rehydrateReplayCues(payload: ReplayCuePayload): ReplayCue[] {
  const fireworks = new Map<string, FireworkSpecification>();
  for (const [key, firework] of Object.entries(payload.fireworks)) {
    fireworks.set(key, { ...firework, spec: null, rawSpec: null, renderDesign: null });
  }
  return payload.cues.map(({ fireworkId, ...cue }) => {
    const firework = fireworks.get(fireworkId);
    if (!firework) throw new Error(`Missing replay firework: ${fireworkId}`);
    return { ...cue, firework };
  });
}
