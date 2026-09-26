export type RendererInputKind = 'slider' | 'number' | 'knob';

/** Explicit input choices shared by all renderer editors. Unlisted ranges use sliders. */
const INPUT_KINDS: Record<string, RendererInputKind> = {
  'Star count': 'number',
  'Streak count': 'number',
  Fragments: 'number',
  'Fragment count': 'number',
  Arms: 'number',
  Points: 'number',
  Shots: 'number',
  'Particle count': 'number',
  'Smoke particles': 'number',
  'Particles per star': 'number',
  'Hang time': 'number',
  'Fragment life': 'number',
  'Burn time': 'number',
  'Glow strength': 'knob',
  Brightness: 'knob',
  'Core brightness': 'knob',
  'Trail brightness': 'knob',
  'Shell brightness': 'knob',
  'Glow softness': 'knob',
  'Core softness': 'knob',
  'Background glow softness': 'knob',
  'Background glow strength': 'knob',
  Volume: 'knob',
  'Sound volume': 'knob',
};

export function rendererInputKind(label: unknown): RendererInputKind {
  return typeof label === 'string' ? (INPUT_KINDS[label] ?? 'slider') : 'slider';
}
