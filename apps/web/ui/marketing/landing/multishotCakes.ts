/** Example multishot cakes: each tube fires one shot at its own time and angle from one box. */
import type { ReplayCue } from '@/lib/show-domain';
import { templateSpec } from './demoShow';

/** Seconds after the last shot that the preview keeps playing before it loops. */
const TAIL_SECONDS = 3.5;
/** Seconds before the first shot, so the box is visible before it fires. */
const LEAD_SECONDS = 0.6;

type Tube = { t: number; pan: number };

export type Cake = {
  id: string;
  name: string;
  pattern: string;
  description: string;
  effect: string;
  cues: ReplayCue[];
  duration: number;
};

/** Sweeps from one side to the other and back. */
function fan(count: number, gap: number, spread: number): Tube[] {
  return Array.from({ length: count }, (_, index) => {
    const phase = index / (count - 1);
    const sweep = phase <= 0.5 ? phase * 2 : 2 - phase * 2;
    return { t: index * gap, pan: Math.round(-spread + sweep * spread * 2) };
  });
}

/** Alternates left and right, closing in towards the middle. */
function zipper(count: number, gap: number, spread: number): Tube[] {
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const closing = 1 - index / count;
    return { t: index * gap, pan: Math.round(side * spread * (0.35 + 0.65 * closing)) };
  });
}

/** A fast near-vertical volley with a slight spread. */
function volley(count: number, gap: number, spread: number): Tube[] {
  return Array.from({ length: count }, (_, index) => ({
    t: index * gap,
    pan: Math.round(((index % 5) - 2) * (spread / 2)),
  }));
}

function cake(
  id: string,
  name: string,
  pattern: string,
  description: string,
  templateKey: string,
  caliber: string,
  tubes: Tube[],
): Cake {
  const firework = templateSpec(templateKey, caliber);
  const cues = tubes.map(
    (tube, index): ReplayCue => ({
      id: `${id}-shot-${index}`,
      position: index + 1,
      timeSeconds: LEAD_SECONDS + tube.t,
      description: `Shot ${index + 1}`,
      productId: `${id}-tube`,
      launchPositionIndex: 1,
      cakeId: id,
      shotPanDegrees: tube.pan,
      firework,
    }),
  );
  const last = cues[cues.length - 1]?.timeSeconds ?? 0;
  return {
    id,
    name,
    pattern,
    description,
    effect: firework.name,
    cues,
    duration: last + TAIL_SECONDS,
  };
}

export const CAKES: readonly Cake[] = [
  cake(
    'fan',
    'Golden fan',
    'Fan',
    'Sixteen shots sweep left to right and back.',
    'chrysanthemum',
    '50mm',
    fan(16, 0.4, 30),
  ),
  cake(
    'zipper',
    'Crossette zipper',
    'Zipper',
    'Twenty shots criss-cross and close into the middle.',
    'crossette',
    '50mm',
    zipper(20, 0.3, 28),
  ),
  cake(
    'volley',
    'Brocade finale',
    'Volley',
    'Twenty-five shots in a fast, near-vertical wall.',
    'brocadeCrown',
    '50mm',
    volley(25, 0.16, 10),
  ),
];
