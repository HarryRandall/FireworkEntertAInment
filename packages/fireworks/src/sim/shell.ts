import type { Design } from '../schema/index';
import { brightnessAt, colourAt, mix, rgb, type Vec3 } from './colour';
import { fillCore } from './core';
import { directions } from './directions';
import { starAppearance } from './fade';
import { launchPos, type ShotPlacement } from './launch';
import { LAUNCH_STYLES } from './launch-styles';
import { starPos } from './motion';
import { ParticleWriter, type Particles } from './particles';

export interface SimulationOptions extends ShotPlacement {
  seed?: number;
}

/** Core shell frame only. Layer modifiers, sprays and smoke are added in PRs 2.3/2.4. */
export function simulate(
  design: Design,
  time_s: number,
  options: SimulationOptions = {},
): Particles {
  if (design.kind !== 'shell')
    throw new RangeError(`Kind ${design.kind} is not implemented in the core simulation`);
  if (!Number.isFinite(time_s)) throw new RangeError('Simulation time must be finite');
  const writer = new ParticleWriter();
  if (time_s < 0) return writer.finish();
  // Preserve the prototype's seed-zero fallback, including for a playback override.
  const seed = (options.seed ?? design.seed) || 1;
  const launch = design.launch,
    T = launch.time_s;
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
  const bx = px + Math.tan((launch.tilt_deg * Math.PI) / 180) * launch.height_m;
  // Random indices are global across breaks, matching the prototype's flattened layer list.
  let li = 0;
  for (const b of design.breaks)
    for (const layer of b.layers) {
      const index = li++;
      const age = time_s - T - b.at_s - layer.delay_s;
      if (layer.hidden || age < 0) continue;
      const centre: Vec3 = [
        bx + layer.offset_m[0],
        launch.height_m + layer.offset_m[1],
        pz + layer.offset_m[2],
      ];
      fillCore(writer, b.core, layer, seed, index, age, centre);
      const dirs = directions(layer.count, layer.pattern, seed * 13 + index);
      dirs.forEach((q, i) => {
        const life = layer.life_s * (1 - layer.life_var / 2 + layer.life_var * q.h2);
        if (age >= life || !layer.head.visible) return;
        const a = starAppearance(layer, b.fade, q, i, age, life);
        const progress = age / life,
          vary = 0.8 + 0.4 * q.h,
          burn = 1 - 0.65 * progress * progress;
        const position = starPos(layer, q, age, centre);
        writer.head(
          position,
          a.colour,
          1.7 * layer.head.size * vary * burn * a.grow * a.flare,
          a.alpha * brightnessAt(layer.brightness, age / life) * vary,
          layer.head.halo ?? 1,
        );
        if (layer.head.size > 2.4) writer.glow(position, a.colour, 2.5, 0.08 * a.alpha);
      });
    }
  return writer.finish();
}
