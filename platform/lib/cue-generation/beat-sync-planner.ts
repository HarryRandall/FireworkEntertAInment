/**
 * Deterministic beat-sync planner (the "Beat-synced (test)" show style).
 *
 * Places exactly one single-shot cue on every analysed beat, rotating launch
 * tubes, so sync against the music is provably perfect. No LLM involved -
 * this is the ground-truth path for testing the preview's beat alignment.
 */
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { PlannedCue } from './fast-planner';

export type BeatSyncPlanResult = {
  cues: PlannedCue[];
  skippedSlots: number;
};

/** Hard safety cap so a very long track can't create an unbounded cue list. */
const MAX_BEAT_CUES = 500;
/** Minimum spacing a tube needs between consecutive firings. */
const MIN_TUBE_GAP_SECONDS = 0.5;

export function planCuesOnBeats(params: {
  analysis: AnalyserResult | null;
  products: FireworkSpecification[];
  songDuration: number;
  /** Launch positions available at the site (1-3). */
  maxTubes?: 1 | 2 | 3;
}): BeatSyncPlanResult {
  const { analysis, products, songDuration, maxTubes = 3 } = params;
  const beats = resolveBeats(analysis, songDuration);
  const singles = pickSingleShotPool(products);
  if (!beats.length || !singles.length) return { cues: [], skippedSlots: beats.length };

  const tubeBusyUntil: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const cues: PlannedCue[] = [];
  let skippedSlots = 0;

  for (let i = 0; i < beats.length && cues.length < MAX_BEAT_CUES; i += 1) {
    const time = Number(beats[i].toFixed(2));
    const tube = (i % maxTubes) as 0 | 1 | 2;
    if (time < tubeBusyUntil[tube]) {
      // The rotation should make this rare; skip rather than drift off-beat.
      skippedSlots += 1;
      continue;
    }
    const product = singles[i % singles.length];
    tubeBusyUntil[tube] = time + Math.max(product.durationSeconds ?? 1, MIN_TUBE_GAP_SECONDS);
    cues.push({
      timeSeconds: time,
      tube,
      productId: product.id,
      description: `Beat ${i + 1}: ${product.name} pops exactly on the beat.`.slice(0, 180),
      slotIndex: i,
      intensity: 0.5,
    });
  }

  return { cues, skippedSlots };
}

/** Analysed beats when available, otherwise a synthetic tempo grid. */
function resolveBeats(analysis: AnalyserResult | null, songDuration: number): number[] {
  const analysed = (analysis?.beat_times ?? [])
    .filter((t) => Number.isFinite(t) && t >= 0 && t < songDuration)
    .sort((a, b) => a - b);
  if (analysed.length >= 8) return analysed;

  const tempo = clampTempo(analysis?.tempo_bpm ?? 120);
  const interval = 60 / tempo;
  const synthetic: number[] = [];
  for (let t = interval; t < songDuration - 0.25; t += interval) {
    synthetic.push(Number(t.toFixed(2)));
  }
  return synthetic;
}

/**
 * Single-shot products sorted by id for determinism. Falls back to the
 * shortest products available when the catalogue has no true single-shots.
 */
function pickSingleShotPool(products: FireworkSpecification[]): FireworkSpecification[] {
  const singles = products.filter((p) => (p.shotCount ?? 1) <= 1 && (p.durationSeconds ?? 1) <= 4);
  if (singles.length) return [...singles].sort((a, b) => a.id.localeCompare(b.id));
  return [...products]
    .sort(
      (a, b) =>
        (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 8);
}

function clampTempo(value: number): number {
  if (!Number.isFinite(value)) return 120;
  return Math.min(220, Math.max(50, value));
}
