/** Quick adjective rows share the stored -3..+3 adjustment levels and the Finale VDL words. */
import { ADJUSTMENT_REGISTRY, type Design } from '@showcrafter/renderer';

/** One adjective row: the persisted key (with `{id}` for star groups) and the words at each end. */
export interface QuickControl {
  key: string;
  label: string;
  low: string;
  high: string;
}

/** Stored relative levels, from maximum reduction to maximum increase. */
export const QUICK_LEVELS = [-3, -2, -1, 0, 1, 2, 3] as const;

// VDL reads "Slightly Big" as 1, "Big" as 2 and "Very Big" as 3, so the steps use the same words.
const STRENGTH_WORDS: Readonly<Record<number, string>> = { 1: 'Slightly', 2: '', 3: 'Very' };

/** Launch rows apply to the lift charge and its rising tail. */
const LAUNCH_QUICK: readonly QuickControl[] = [
  { key: 'launch.height', label: 'Height', low: 'Low', high: 'High' },
  { key: 'launch.climb', label: 'Climb speed', low: 'Slow', high: 'Fast' },
  { key: 'launch.tail', label: 'Rising tail', low: 'Thin', high: 'Thick' },
];

/** Break rows apply to every break's core. */
const BURST_QUICK: readonly QuickControl[] = [
  { key: 'break.flash', label: 'Flash', low: 'Soft', high: 'Bright' },
  { key: 'break.core_ring', label: 'Centre ring', low: 'Small', high: 'Big' },
];

/** Star group rows. Words match the VDL adjective glossary in `lib/finale/vdl/glossary.ts`. */
const STAR_QUICK: readonly QuickControl[] = [
  { key: 'layer.{id}.size', label: 'Size', low: 'Small', high: 'Big' },
  { key: 'layer.{id}.stars', label: 'Stars', low: 'Sparse', high: 'Dense' },
  { key: 'layer.{id}.burn', label: 'Burn', low: 'Short', high: 'Long' },
  { key: 'layer.{id}.brightness', label: 'Brightness', low: 'Dim', high: 'Bright' },
  { key: 'layer.{id}.star_size', label: 'Tip', low: 'Dim tip', high: 'Bright tip' },
  { key: 'layer.{id}.spread', label: 'Spread', low: 'Uniform', high: 'Ragged' },
  { key: 'layer.{id}.droop', label: 'Droop', low: 'Floaty', high: 'Droopy' },
];

/** Trail rows for the selected star group. */
const TRAIL_QUICK: readonly QuickControl[] = [
  { key: 'layer.{id}.trail.length', label: 'Trail length', low: 'Short trail', high: 'Long trail' },
  { key: 'layer.{id}.trail.density', label: 'Trail density', low: 'Thin', high: 'Thick' },
  { key: 'layer.{id}.trail.spray', label: 'Trail width', low: 'Skinny', high: 'Fat' },
  { key: 'layer.{id}.trail.glitter', label: 'Glitter', low: 'None', high: 'Lots' },
];

/** Modifier rows; VDL's Slow and Fast drive the modifier amount. */
const MODIFIER_QUICK: readonly QuickControl[] = [
  { key: 'layer.{id}.modifier.amount', label: 'Effect speed', low: 'Slow', high: 'Fast' },
  { key: 'layer.{id}.modifier.timing', label: 'Effect timing', low: 'Early', high: 'Late' },
];

/** Ground device rows; each is shown only when the device has the fields it changes. */
const GROUND_QUICK: readonly QuickControl[] = [
  { key: 'ground.height', label: 'Height', low: 'Low', high: 'High' },
  { key: 'ground.count', label: 'Count', low: 'Fewer', high: 'More' },
  { key: 'ground.fan', label: 'Fan', low: 'Narrow', high: 'Wide' },
  { key: 'ground.climb', label: 'Climb speed', low: 'Slow', high: 'Fast' },
  { key: 'ground.star_size', label: 'Star size', low: 'Small', high: 'Big' },
  { key: 'ground.spin', label: 'Spin', low: 'Slow', high: 'Fast' },
  { key: 'ground.duration', label: 'Duration', low: 'Short', high: 'Long' },
  { key: 'ground.density', label: 'Density', low: 'Sparse', high: 'Dense' },
  { key: 'ground.spray', label: 'Spray', low: 'Narrow', high: 'Wide' },
];

/** One titled group of rows, already bound to a concrete star group where needed. */
export interface QuickGroup {
  title: string;
  controls: QuickControl[];
}

/** Returns the stored key for a row, filling in the star group identifier. */
function quickKey(control: QuickControl, layerId?: string): string {
  return layerId === undefined ? control.key : control.key.replace('{id}', layerId);
}

/** Describes one level in VDL words, for example "Very Big", "Slightly Sparse" or "Original". */
export function levelWords(control: QuickControl, level: number): string {
  if (level === 0) return 'Original';
  const word = level < 0 ? control.low : control.high;
  const strength = STRENGTH_WORDS[Math.abs(level)] ?? '';
  return strength === '' ? word : `${strength} ${word}`;
}

function groundApplies(document: Design, control: QuickControl): boolean {
  const ground = document.ground as Record<string, unknown> | null;
  if (!ground) return false;
  const definition = ADJUSTMENT_REGISTRY[control.key as keyof typeof ADJUSTMENT_REGISTRY];
  return definition.targets.some((target) => {
    const part = target.split('.')[1];
    return part !== undefined && ground[part] !== undefined;
  });
}

/** Lists the rows that change something in this design, with star rows bound to one group. */
export function quickGroups(document: Design, layerId?: string): QuickGroup[] {
  const layer = document.breaks
    .flatMap((burst) => burst.layers)
    .find((candidate) => candidate.id === layerId);
  const bind = (controls: readonly QuickControl[]) =>
    controls.map((control) => ({ ...control, key: quickKey(control, layer?.id) }));
  const groups: QuickGroup[] = [];
  if (document.launch) groups.push({ title: 'Launch', controls: [...LAUNCH_QUICK] });
  if (document.breaks.length > 0) groups.push({ title: 'Burst', controls: [...BURST_QUICK] });
  if (layer) {
    groups.push({ title: `Stars: ${layer.name}`, controls: bind(STAR_QUICK) });
    if (layer.trail.sparks > 0) groups.push({ title: 'Trail', controls: bind(TRAIL_QUICK) });
    if (layer.modifiers.length > 0)
      groups.push({ title: 'Effects', controls: bind(MODIFIER_QUICK) });
  }
  const ground = GROUND_QUICK.filter((control) => groundApplies(document, control));
  if (ground.length > 0) groups.push({ title: 'Ground', controls: ground });
  return groups;
}

/** True when a star group identifier appears in more than one break, so a row would change both. */
export function sharedLayerId(document: Design, layerId: string): boolean {
  return (
    document.breaks.flatMap((burst) => burst.layers).filter((layer) => layer.id === layerId)
      .length > 1
  );
}
