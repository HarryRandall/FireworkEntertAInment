import { resolveDesign, type Design } from '../schema/index';
import { brightnessAt, colourAt, mix, rgb, type Vec3 } from './colour';
import { fillCore } from './core';
import { directions } from './directions';
import { starAppearance } from './fade';
import { launchPos, type ShotPlacement } from './launch';
import { LAUNCH_STYLES } from './launch-styles';
import { fillGround } from './kinds/ground';
import { fillModifierEvents, parentEnd } from './modifiers';
import { starPos } from './motion';
import { ParticleWriter, type Particles } from './particles';

export interface SimulationOptions extends ShotPlacement {
  seed?: number;
}

/** Stateless heads and discrete events. Sprays and smoke are added in PR 2.4. */
export function simulate(
  design: Design,
  time_s: number,
  options: SimulationOptions = {},
): Particles {
  design = resolveDesign(design);
  if (!Number.isFinite(time_s)) throw new RangeError('Simulation time must be finite');
  const writer = new ParticleWriter();
  if (time_s < 0) return writer.finish();
  // Preserve the prototype's seed-zero fallback, including for a playback override.
  const seed = (options.seed ?? design.seed) || 1;
  if (design.launch === null) {
    fillGround(writer, design, seed, time_s, options);
    return writer.finish();
  }
  const launch = design.launch,
    T = design.kind === 'mine' ? 0 : launch.time_s;
  const mine = design.kind === 'mine';
  if (mine && time_s < 0.2) {
    const [x, z] = options.position ?? [0, 0];
    writer.glow(
      [x, options.muzzle_m ?? 1.8, z],
      rgb('#ffd9a8'),
      6 * (1 - time_s / 0.2) + 2,
      0.45 * (1 - time_s / 0.2),
    );
  }
  if (time_s < T) {
    const st = LAUNCH_STYLES[launch.tail];
    const first = design.breaks[0]?.layers[0];
    const star = first ? colourAt(first.colour, 0, 0, 0) : rgb('#ffe2a8');
    const tail = st.colour
      ? rgb(st.colour)
      : st.star
        ? mix(rgb('#ffc070'), star, 0.3)
        : rgb('#ffe2a8');
    let alpha = st.headAlpha;
    if (st.strobe) {
      const x = time_s * st.strobe + seed * 0.37;
      alpha *= 0.04 + 1.6 * Math.pow(1 - (x - Math.floor(x)), 6);
    }
    const position = launchPos(launch, seed, time_s, options);
    writer.head(position, st.star ? tail : rgb('#ffe2a8'), 1.9 * st.head, alpha);
    writer.glow(position, rgb('#ffb866'), 2.2 * st.head, 0.12 * alpha);
    return writer.finish();
  }
  const [px, pz] = options.position ?? [0, 0];
  const bx = px + (mine ? 0 : Math.tan((launch.tilt_deg * Math.PI) / 180) * launch.height_m);
  // Random indices are global across breaks, matching the prototype's flattened layer list.
  let li = 0;
  for (const b of design.breaks)
    for (const layer of b.layers) {
      const index = li++;
      const age = time_s - T - b.at_s - layer.delay_s;
      if (layer.hidden || age < 0) continue;
      const centre: Vec3 = [
        bx + layer.offset_m[0],
        (mine ? (options.muzzle_m ?? 1.8) : launch.height_m) + layer.offset_m[1],
        pz + layer.offset_m[2],
      ];
      if (!mine) fillCore(writer, b.core, layer, seed, index, age, centre);
      const dirs = directions(
        layer.count,
        mine ? 'cone' : layer.pattern,
        seed * 13 + index,
        layer.tilt,
      );
      dirs.forEach((q, i) => {
        const life = layer.life_s * (1 - layer.life_var / 2 + layer.life_var * q.h2);
        const a = starAppearance(layer, b.fade, q, i, age, life, seed);
        // Events may outlive the parent and do not depend on head visibility.
        if (age >= parentEnd(layer, life) || !layer.head.visible) {
          fillModifierEvents(writer, layer, q, i, seed, age, life, centre, a);
          return;
        }
        const progress = age / life,
          vary = 0.8 + 0.4 * q.h,
          burn = 1 - 0.65 * progress * progress;
        const position = starPos(layer, q, age, centre);
        if (a.strobing) {
          const alpha = a.alpha * brightnessAt(layer.brightness, progress) * vary;
          writer.spark(position, a.colour, 0.9 * layer.head.size * a.flare, alpha);
          writer.glow(position, a.colour, 1.4 * layer.head.size * a.flare, 0.12 * alpha);
        } else
          writer.head(
            position,
            a.colour,
            1.7 * layer.head.size * vary * burn * a.grow * a.flare,
            a.alpha * brightnessAt(layer.brightness, age / life) * vary,
            layer.head.halo ?? (layer.modifiers.some((m) => m.kind === 'strobe') ? 0 : 1),
          );
        if (layer.head.size > 2.4) writer.glow(position, a.colour, 2.5, 0.08 * a.alpha);
        fillModifierEvents(writer, layer, q, i, seed, age, life, centre, a);
      });
    }
  return writer.finish();
}
