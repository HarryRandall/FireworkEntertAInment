import { type Design, type Layer, upgradeDesign } from '../src/index';

function narrowDesign(doc: Design): number {
  if (doc.kind === 'comet' || doc.kind === 'candle') return doc.ground.comets.height_m;
  if (doc.kind === 'fountain') return doc.ground.fountain.rate_per_s;
  if (doc.kind === 'wheel') return doc.ground.wheel.spin_hz;
  if (doc.kind === 'spinner') return doc.ground.spinner.wander_m;
  if (doc.kind === 'tourbillon') return doc.ground.tourbillon.time_s;
  return doc.launch.height_m;
}

const parse: (doc: unknown, version: number) => Design = upgradeDesign;
const layerName = (layer: Layer): string => layer.name;
void [narrowDesign, parse, layerName];

import {
  simulate,
  shotDuration,
  ParticleKind,
  type Particles,
  type SimulationOptions,
} from '../src/sim/index';

const evaluate: (design: Design, time_s: number, options?: SimulationOptions) => Particles =
  simulate;
const duration: (design: Design) => number = shotDuration;
const options: SimulationOptions = { seed: 0, position: [1, 2], muzzle_m: 3 };
const particleCount = (frame: Particles): number => frame.kinds.length;
const kind: ParticleKind = ParticleKind.Head;
void [evaluate, duration, options, particleCount, kind];
