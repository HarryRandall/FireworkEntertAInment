/** Library entries copy renderer documents and apply parts to one selected source. */
import { z } from 'zod';
import { designSchema, effectTemplates, resolveDesign, type Design } from '@showcrafter/fireworks';
import { launchSchema, modifierSchema } from '@showcrafter/fireworks/schema';
import { editDesign, inspectorLayer, toggleModifier, type InspectorResult } from './inspector';
import { selectedLayer } from './layers';
import { trailLooks } from './trail-looks';

const MAX_LAYERS = 32; // v1 schema limit per break.
const MAX_NAME_LENGTH = 120; // Characters, shared with the renderer and database part name.
/** Stored part categories mirror the prototype library sections. */
export const partCategorySchema = z.enum(['stars', 'trails', 'effects', 'tails']);
/** Validated immutable saved part returned under caller RLS. */
export const savedPartSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  category: partCategorySchema,
  design: designSchema,
});
/** A saved part retains the renderer envelope so SQL and TypeScript share validation. */
export type SavedPart = z.infer<typeof savedPartSchema>;
/** A reusable choice is either a complete template, a saved part or a built-in option. */
export interface LibraryEntry {
  id: string;
  name: string;
  category: 'fireworks' | SavedPart['category'];
  design?: Design;
  option?: string;
  saved?: boolean;
}
/** Canonical templates supply whole fireworks and star groups; no duplicate renderer format. */
export function libraryEntries(): LibraryEntry[] {
  return [
    ...effectTemplates.map((item) => ({
      id: item.key,
      name: item.name,
      category: 'fireworks' as const,
      design: item.design,
    })),
    ...effectTemplates.flatMap((item) =>
      item.design.breaks.flatMap((burst, index) =>
        burst.layers.map((layer) => ({
          id: `${item.key}:${String(index)}:${layer.id}`,
          name: layer.name,
          category: 'stars' as const,
          design: partEnvelope(item.design, `layer:${String(index)}:${layer.id}`),
        })),
      ),
    ),
    ...trailLooks.map((item) => ({
      id: item.key,
      name: item.key,
      category: 'trails' as const,
      option: item.key,
    })),
    ...modifierSchema.shape.kind.options.map((kind) => ({
      id: kind,
      name: kind,
      category: 'effects' as const,
      option: kind,
    })),
    ...launchSchema.shape.tail.options.map((tail) => ({
      id: tail,
      name: tail,
      category: 'tails' as const,
      option: tail,
    })),
  ];
}
/** Returns a resolved, independent single-layer envelope, preserving preview context and stored units. */
export function partEnvelope(document: Design, address: string): Design {
  const copy = resolveDesign(document);
  const selection = selectedLayer(copy, address);
  if (selection) {
    const burst = copy.breaks[selection.breakIndex];
    const layer = inspectorLayer(copy, selection);
    if (layer)
      copy.breaks = [{ ...burst, at_s: 0, layers: [{ ...layer, delay_s: 0, hidden: false }] }];
  }
  return copy;
}
/** Copies one part into the current break or selected star group and returns a validated immutable edit. */
export function applyLibrary(
  document: Design,
  address: string,
  entry: LibraryEntry,
): InspectorResult {
  if (entry.category === 'fireworks' && entry.design)
    return { kind: 'edited', document: structuredClone(entry.design) };
  const selection = selectedLayer(document, address);
  if (entry.category === 'stars') return addStars(document, address, entry);
  if (entry.category !== 'tails' && !selection)
    return { kind: 'invalid', message: 'Choose a star group first.' };
  if (entry.category === 'tails' && document.launch === null)
    return { kind: 'invalid', message: 'This firework has no launch tail.' };
  return editDesign(document, (draft) => {
    const layer = selection ? inspectorLayer(draft, selection) : undefined;
    const source = entry.design?.breaks.at(0)?.layers.at(0);
    if (entry.category === 'trails' && layer) applyTrail(layer, source, entry.option);
    if (entry.category === 'effects' && layer) applyModifiers(layer, source, entry.option);
    if (entry.category === 'tails') applyTail(draft, entry);
  });
}
function applyModifiers(
  layer: Design['breaks'][number]['layers'][number],
  source: typeof layer | undefined,
  option: string | undefined,
) {
  if (source) {
    layer.modifiers = structuredClone(source.modifiers);
    if (source.colour.reignition)
      layer.colour.reignition = structuredClone(source.colour.reignition);
  } else {
    const kind = modifierSchema.shape.kind.safeParse(option);
    if (kind.success && !layer.modifiers.some((item) => item.kind === kind.data))
      toggleModifier(layer, kind.data);
  }
}
function addStars(document: Design, address: string, entry: LibraryEntry): InspectorResult {
  const selection = selectedLayer(document, address);
  const index = selection?.breakIndex ?? Number(address.match(/^(?:break|core):(\d+)$/)?.[1] ?? 0);
  const source = entry.design?.breaks.at(0)?.layers.at(0);
  const burst = document.breaks.at(index);
  if (!burst || !source)
    return { kind: 'invalid', message: 'Star groups need an airborne firework with a break.' };
  if (burst.layers.length >= MAX_LAYERS)
    return { kind: 'invalid', message: 'This break is full. Choose another break.' };
  return editDesign(document, (draft) => {
    const target = draft.breaks.at(index);
    if (!target) return;
    const used = new Set(draft.breaks.flatMap((item) => item.layers.map((layer) => layer.id)));
    let suffix = used.size;
    while (used.has(`library-${String(suffix)}`)) suffix++;
    target.layers.push({
      ...structuredClone(source),
      id: `library-${String(suffix)}`,
      delay_s: 0,
      hidden: false,
    });
  });
}

function applyTrail(
  layer: Design['breaks'][number]['layers'][number],
  source: typeof layer | undefined,
  option: string | undefined,
) {
  const trail = source?.trail ?? trailLooks.find((item) => item.key === option)?.trail;
  if (trail) layer.trail = structuredClone(trail);
}
function applyTail(draft: Design, entry: LibraryEntry) {
  if (!draft.launch) return;
  const tail = entry.design?.launch;
  if (tail)
    draft.launch = { ...draft.launch, tail: tail.tail, sparks: tail.sparks, spread: tail.spread };
  else {
    const option = launchSchema.shape.tail.safeParse(entry.option);
    if (option.success) draft.launch.tail = option.data;
  }
}
