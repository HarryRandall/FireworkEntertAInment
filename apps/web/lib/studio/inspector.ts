/** Validated inspector edits preserve the stored document and resolve inherited adjustments once. */
import { designSchema, resolveDesign, type Design } from '@showcrafter/fireworks';
import type { Layer, Modifier, Core } from '@showcrafter/fireworks/schema';
import type { LayerSelection } from './layers';

const MAX_BREAKS = 64; // v1 schema's maximum number of authored breaks.
const BREAK_GAP_S = 0.5; // Seconds between added breaks, visual tuning from the editor prototype.
const MAX_BREAK_TIME_S = 120; // v1 break clock bound in seconds after the apex.
const DEFAULT_TRAIL_SPARKS = 30; // Sparks, the schema's starting trail density when enabling a bare star.
const DEFAULT_MODIFIER_AT = 0.7; // Normalised life, schema default trigger.
const DEFAULT_MODIFIER_RATE_HZ = 12; // Hz, schema default pulse sampling rate.
const DEFAULT_MODIFIER_COUNT = 8; // Pieces, schema default child count.
const DEFAULT_GHOST_CHANGE_AT = 0.55; // Normalised life, prototype's starting colour-change position.
const DEFAULT_REIGNITION_DURATION = 0.1; // Normalised life, schema default colour-transition window.
const DEFAULT_GHOST_GAP = 0.12; // Normalised life, schema default ghost dark interval.
/** A rejected edit keeps the previous valid draft and reports its cause. */
export type InspectorResult =
  | { kind: 'edited'; document: Design }
  | { kind: 'invalid'; message: string };
/** Clones and resolves a validated v1 document, applies one edit and validates all stored units. */
export function editDesign(document: Design, change: (draft: Design) => void): InspectorResult {
  const draft = resolveDesign(document);
  change(draft);
  const result = designSchema.safeParse(draft);
  return result.success
    ? { kind: 'edited', document: result.data }
    : { kind: 'invalid', message: 'This value is outside the firework design limits.' };
}
/** Finds a mutable layer in an already cloned document by break index and stable ID. */
export function inspectorLayer(document: Design, selection: LayerSelection): Layer | undefined {
  return document.breaks[selection.breakIndex]?.layers.find(
    (layer) => layer.id === selection.layerId,
  );
}
/** Mutates a cloned launch height in metres and climb time in seconds, preserving the square-root relation. */
export function changeLaunchHeight(document: Design, heightM: number): void {
  const launch = document.launch;
  if (!launch) return;
  // Equal relative climb speed requires time to scale with the square root of the height ratio.
  if (launch.height_m > 0) launch.time_s *= Math.sqrt(heightM / launch.height_m);
  launch.height_m = heightM;
}
/** Adds a cloned burst at an apex-relative offset in seconds with unique layer IDs; mutates draft only. */
export function addBreak(document: Design): void {
  const source = document.breaks.at(-1);
  if (!source || document.breaks.length >= MAX_BREAKS) return;
  const burst = structuredClone(source);
  burst.at_s = Math.min(MAX_BREAK_TIME_S, source.at_s + BREAK_GAP_S);
  const used = new Set(document.breaks.flatMap((item) => item.layers.map((layer) => layer.id)));
  burst.layers.forEach((layer, index) => {
    let suffix = used.size + index;
    let id = `stars-${String(suffix)}`;
    while (used.has(id)) id = `stars-${String(++suffix)}`;
    layer.id = id;
    used.add(id);
  });
  document.breaks.push(burst);
}
/** Mutates a cloned draft by removing a zero-based burst index, retaining at least one complete burst. */
export function removeBreak(document: Design, index: number): void {
  if (document.breaks.length > 1) document.breaks.splice(index, 1);
}
/** Enables a trail at schema-default density or disables emission without losing its look. */
export function setTrailEnabled(layer: Layer, enabled: boolean): void {
  layer.trail.sparks = enabled
    ? Math.max(1, layer.trail.sparks > 0 ? layer.trail.sparks : DEFAULT_TRAIL_SPARKS)
    : 0;
}
/** Creates complete modifier fields in stored units; only consumed settings are exposed by the inspector. */
function newModifier(kind: Modifier['kind']): Modifier {
  return {
    kind,
    at: DEFAULT_MODIFIER_AT,
    rate_hz: DEFAULT_MODIFIER_RATE_HZ,
    count: DEFAULT_MODIFIER_COUNT,
    amount: 1,
    spread: 'burst',
    gap: DEFAULT_GHOST_GAP,
    angular_speed_rad_s: 1,
    rate_rad_s: DEFAULT_MODIFIER_RATE_HZ,
  };
}
/** Toggles an independent modifier without replacing or reordering other authored modifiers. */
export function toggleModifier(layer: Layer, kind: Modifier['kind']): void {
  if (layer.modifiers.some((item) => item.kind === kind)) {
    layer.modifiers = layer.modifiers.filter((item) => item.kind !== kind);
  } else {
    layer.modifiers.push(newModifier(kind));
    if (kind === 'ghost' && !layer.colour.reignition) {
      layer.colour.reignition = {
        at: DEFAULT_GHOST_CHANGE_AT,
        duration: DEFAULT_REIGNITION_DURATION,
        amount: 1,
      };
    }
  }
}

/** Returns a validated copy with a dimensionless level (-3 to +3) on an existing adjustment key; never mutates input. */
export function setAdjustment(document: Design, key: string, level: number): InspectorResult {
  const layerId = key.match(/^layer\.([A-Za-z0-9_-]+)\./)?.[1];
  if (
    layerId !== undefined &&
    !document.breaks.some((burst) => burst.layers.some((layer) => layer.id === layerId))
  ) {
    return { kind: 'invalid', message: 'This star group no longer exists.' };
  }
  const next = structuredClone(document);
  next.adjustments = { ...next.adjustments, [key]: level };
  const parsed = designSchema.safeParse(next);
  if (!parsed.success)
    return {
      kind: 'invalid',
      message: 'This relative adjustment is outside the firework design limits.',
    };
  return { kind: 'edited', document: parsed.data };
}

/** Toggles flash or ring independently, preserving the other part's currently visible state. */
export function setCorePart(core: Core, part: 'flash_on' | 'ring', enabled: boolean): void {
  if (!core.enabled) {
    core.flash_on = false;
    core.ring = false;
  }
  core[part] = enabled;
  core.enabled = core.flash_on || core.ring;
}
