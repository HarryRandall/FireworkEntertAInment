/**
 * demoShow — a self-contained choreographed firework show used by the
 * landing-page live preview. It produces real `ReplayCue[]` driven by the
 * production fireworks engine (`compileFireworkDesign`), so the marketing
 * preview renders with the exact same renderer the app uses for shows. No
 * database or network access is required: designs are compiled in-memory.
 */
import { compileFireworkDesign, type FireworkDesign } from '@/lib/fireworks/design';
import { DEFAULT_FIREWORK_SPEC } from '@/lib/fireworks/spec';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';

export const DEMO_SHOW_DURATION_SECONDS = 30;

/** The five show accents used across the landing palette dots. */
const PALETTE: { color: string; secondary: string }[] = [
  { color: '#efb93f', secondary: '#fb7185' }, // gold
  { color: '#2ec487', secondary: '#38bdf8' }, // green
  { color: '#8f7be8', secondary: '#38bdf8' }, // violet
  { color: '#38bdf8', secondary: '#ffffff' }, // sky
  { color: '#fb7185', secondary: '#efb93f' }, // rose
];

const designCache = new Map<number, FireworkDesign>();
function designFor(paletteIndex: number): FireworkDesign {
  const cached = designCache.get(paletteIndex);
  if (cached) return cached;
  const { color, secondary } = PALETTE[paletteIndex];
  const design = compileFireworkDesign({ primaryColor: color, colorPalette: [color, secondary] });
  designCache.set(paletteIndex, design);
  return design;
}

const specCache = new Map<string, FireworkSpecification>();
function specFor(paletteIndex: number, caliber: string): FireworkSpecification {
  const key = `${paletteIndex}:${caliber}`;
  const cached = specCache.get(key);
  if (cached) return cached;
  const spec: FireworkSpecification = {
    id: `demo-${key}`,
    slug: `demo-${key}`,
    name: 'Demo shell',
    description: null,
    sortOrder: paletteIndex,
    durationSeconds: 3,
    heightMeters: 60,
    caliber,
    shotCount: 1,
    spec: DEFAULT_FIREWORK_SPEC,
    rawSpec: null,
    renderDesign: designFor(paletteIndex),
    baseEffect: null,
    variant: null,
  };
  specCache.set(key, spec);
  return spec;
}

// [time, paletteIndex, caliber, launchPositionIndex]
type CueSeed = [number, number, string, number];

const SEEDS: CueSeed[] = [
  // opening — single shells, alternating sides, building height
  [0.6, 0, '50mm', 1],
  [1.7, 3, '50mm', 0],
  [2.8, 2, '60mm', 2],
  [3.9, 0, '75mm', 1],
  [5.1, 4, '60mm', 0],
  // mid — layered pairs, richer colours
  [6.3, 1, '75mm', 2],
  [7.3, 2, '75mm', 1],
  [8.4, 3, '60mm', 0],
  [9.6, 0, '100mm', 2],
  [10.8, 4, '75mm', 1],
  [12.0, 1, '75mm', 0],
  [13.2, 2, '100mm', 2],
  [14.5, 0, '100mm', 1],
  [15.7, 3, '75mm', 0],
  [16.9, 4, '75mm', 2],
  [18.1, 1, '100mm', 1],
  [19.4, 2, '100mm', 0],
  [20.7, 0, '125mm', 2],
  // finale — rapid wall across every position
  [23.0, 0, '125mm', 0],
  [23.4, 4, '100mm', 1],
  [23.8, 2, '125mm', 2],
  [24.4, 3, '100mm', 0],
  [24.9, 1, '125mm', 1],
  [25.5, 0, '125mm', 2],
  [26.2, 4, '100mm', 0],
  [26.8, 2, '125mm', 1],
  [27.6, 0, '150mm', 2],
];

export const DEMO_SHOW_CUES: ReplayCue[] = SEEDS.map(
  ([timeSeconds, paletteIndex, caliber, launchPositionIndex], index) => ({
    id: `demo-cue-${index}`,
    position: index + 1,
    timeSeconds,
    description: 'Live preview cue',
    productId: `demo-${paletteIndex}:${caliber}`,
    launchPositionIndex,
    firework: specFor(paletteIndex, caliber),
  }),
);
