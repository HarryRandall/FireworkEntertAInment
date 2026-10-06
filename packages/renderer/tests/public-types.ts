/** Compile-time assertions for the renderer package's public TypeScript API. */
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
/** Compile-time assignability evidence for the public API. */
export const schemaTypeChecks = [narrowDesign, parse, layerName];

import {
  simulate,
  shotDuration,
  ParticleKind,
  type Particles,
  type SimulationOptions,
  type SmokeParticles,
} from '../src/sim/index';

const evaluate: (design: Design, time_s: number, options?: SimulationOptions) => Particles =
  simulate;
const duration: (design: Design) => number = shotDuration;
const options: SimulationOptions = {
  seed: 0,
  position: [1, 2],
  muzzle_m: 3,
  smoke: false,
  sprays: true,
  launchEffects: true,
};
const particleCount = (frame: Particles): number => frame.kinds.length;
const smokeOutput = (frame: Particles): SmokeParticles => frame.smoke;
const kind: ParticleKind = ParticleKind.Head;
/** Compile-time assignability evidence for the public API. */
export const simulationTypeChecks = [evaluate, duration, options, particleCount, smokeOutput, kind];

import {
  effectTemplates,
  type EffectTemplate,
  type EffectTemplateKey,
  type EffectTemplateGroup,
} from '../src/index';

const catalogue: readonly EffectTemplate[] = effectTemplates;
const templateKey: EffectTemplateKey = 'saturn';
const templateGroup: EffectTemplateGroup = 'Shells';
const templateDesign = (entry: EffectTemplate): Design => entry.design;
// @ts-expect-error Unknown keys are not members of the built-in catalogue.
const unknownTemplate: EffectTemplateKey = 'unknown-template';
/** Compile-time assignability evidence for the public API. */
export const templateTypeChecks = [
  catalogue,
  templateKey,
  templateGroup,
  templateDesign,
  unknownTemplate,
];
