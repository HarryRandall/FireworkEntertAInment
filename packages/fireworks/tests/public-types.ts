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
