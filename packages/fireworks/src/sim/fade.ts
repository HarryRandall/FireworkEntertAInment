import type { Fade, Layer } from '../schema/index';
import type { StarDirection } from './directions';
import { colourAt, mix, PRIME, rgb, smoothstep, WHITE } from './colour';
export function fadeAlpha(fade: Fade, age: number, life: number): number {
  const p = age / life;
  let a = Math.min(1, age / 0.07);
  if (p > fade.fade_at) a *= Math.max(0, 1 - (p - fade.fade_at) / (1 - fade.fade_at));
  if (p > 0.92) a *= Math.max(0, (1 - p) / 0.08);
  return a;
}
export function starAppearance(
  layer: Layer,
  fade: Fade,
  direction: StarDirection,
  index: number,
  age: number,
  life: number,
) {
  const progress = age / life,
    base = colourAt(layer.colour, progress, index, direction.h);
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
  const flare =
    r && progress > r.at ? 1 + r.amount * Math.max(0, 1 - (progress - r.at) / r.duration) : 1;
  return { colour, grow, flare, alpha: fadeAlpha(fade, age, life) };
}
