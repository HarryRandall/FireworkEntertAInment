import type { Design } from '../schema/index';
export function shotDuration(design: Design): number {
  if (design.kind === 'comet' || design.kind === 'candle') {
    const c = design.ground.comets;
    return (
      c.time_s +
      1.8 +
      (c.split ? c.split.life_s || 0.7 : 0) +
      (c.pattern === 'sequence' ? (c.count - 1) * (c.gap_s || 0.5) : 0)
    );
  }
  if (design.kind === 'wheel') return design.ground.wheel.duration_s + 1.4;
  if (design.kind === 'spinner')
    return design.ground.spinner.duration_s + design.ground.spinner.count * 0.4 + 0.8;
  if (design.kind === 'fountain')
    return design.ground.fountain.duration_s + design.ground.fountain.life_s + 0.4;
  if (design.kind === 'tourbillon') return design.ground.tourbillon.time_s + 1.4;
  let life = 0;
  for (const b of design.breaks)
    for (const l of b.layers) {
      // Several modifiers are stored in v1. Their longest tail determines the duration.
      const extra = Math.max(
        0,
        ...l.modifiers.map((m) =>
          m.kind === 'crackle'
            ? 0.5
            : m.kind === 'crossette' || m.kind === 'split'
              ? 0.8
              : m.kind === 'pop'
                ? 0.7
                : 0,
        ),
      );
      life = Math.max(
        life,
        b.at_s + l.delay_s + l.life_s * (1 + l.life_var) + l.trail.length_s * 1.3 + extra,
      );
    }
  return (design.kind === 'mine' ? 0 : design.launch.time_s) + Math.max(life, 1) + 0.4;
}
