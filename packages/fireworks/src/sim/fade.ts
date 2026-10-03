/** Per-star burn, colour transition and brightness modifier evaluation. */
import type { Fade, Layer } from '../schema/index';
import type { StarDirection } from './directions';
import { hash } from './random';
import { colourAt, mix, PRIME, rgb, smoothstep, WHITE } from './colour';
/** Hash stream selecting a twinkle's independent on/off sample. */
const TWINKLE_STATE_STREAM_OFFSET = 3;
/** Computes the burn alpha for an age and lifetime in seconds. */
export function fadeAlpha(fade: Fade, age: number, life: number): number {
  const p = age / life;
  let a = Math.min(1, age / 0.07);
  if (p > fade.fade_at) a *= Math.max(0, 1 - (p - fade.fade_at) / (1 - fade.fade_at));
  if (p > 0.92) a *= Math.max(0, (1 - p) / 0.08);
  return a;
}
/** Computes a star's current colour, scale, alpha and strobe state. */
export function starAppearance(
  layer: Layer,
  fade: Fade,
  direction: StarDirection,
  index: number,
  age: number,
  life: number,
  seed = 1,
) {
  const progress = age / life;
  let colourProgress = progress,
    dip = 1;
  for (const m of layer.modifiers)
    if (m.kind === 'ghost') {
      const change =
        layer.colour.reignition?.at ??
        layer.colour.stops.find((s, i, stops) => i > 0 && s[0] === stops[i - 1]?.[0])?.[0];
      if (change === undefined) continue;
      const c = change + (direction.x + 1) * 0.5 * m.amount + m.gap / 2;
      colourProgress -= c - change;
      dip *= smoothstep(m.gap / 2, m.gap / 2 + 0.05, Math.abs(progress - c));
    }
  const base = colourAt(layer.colour, colourProgress, index, direction.h);
  const wh = fade.white_hot * (0.5 + direction.h2);
  let colour =
    progress < wh
      ? mix(WHITE, base, progress / wh)
      : progress > fade.ember_at
        ? mix(
            base,
            rgb('#ff7a33'),
            0.45 * Math.min(1, (progress - fade.ember_at) / (1 - fade.ember_at)),
          )
        : base;
  let grow = 1;
  if (age < fade.prime_s) {
    colour = mix(PRIME, colour, smoothstep(fade.prime_s * 0.4, fade.prime_s, age));
    grow = Math.pow(Math.min(1, 0.25 + age / 0.35), 1.2);
  }
  const r = layer.colour.reignition;
  let flare =
    r && !layer.modifiers.some((m) => m.kind === 'ghost') && progress > r.at
      ? 1 + r.amount * Math.max(0, 1 - (progress - r.at) / r.duration)
      : 1;
  let alpha = fadeAlpha(fade, age, life) * dip,
    strobing = false;
  for (const m of layer.modifiers) {
    if (m.kind === 'strobe' && progress > m.at) {
      const hz = m.rate_hz * (0.67 + 0.83 * direction.h2),
        k = 10 + 30 / hz;
      let b = 0;
      for (let s = 0; s < 4; s++) {
        const x = (age - s * 0.004) * hz + direction.ph;
        b += Math.pow(1 - (x - Math.floor(x)), k);
      }
      b /= 4;
      const inn = smoothstep(m.at, m.at + 0.06, progress);
      strobing ||= inn > 0.5;
      alpha *= 1 - inn + inn * Math.min(2, 2.6 * b);
      colour = mix(colour, WHITE, 0.7 * b * inn);
      flare *= 1 + 0.6 * b * inn;
    } else if (m.kind === 'twinkle' && progress > m.at) {
      const on = hash(index, Math.floor(age * m.rate_hz), seed + TWINKLE_STATE_STREAM_OFFSET);
      alpha *= 0.25 + 1.1 * on * on;
    } else if (m.kind === 'flutter') {
      alpha *= 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(age * 5 + direction.ph)), 3);
    }
  }
  return { base, colour, grow, flare, alpha, strobing };
}
