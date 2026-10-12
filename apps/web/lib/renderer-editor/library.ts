/** Library entries copy renderer designs and apply one part to the selected star group or launch. */
import { z } from 'zod';
import { effectTemplates, resolveDesign, type Design } from '@showcrafter/renderer';
import { launchSchema, modifierSchema, type Layer } from '@showcrafter/renderer/schema';
import { editDesign, inspectorLayer, toggleModifier, type InspectorResult } from './inspector';
import { selectedLayer } from './layers';
import { trailLooks } from './trail-looks';
import { validateEditorDesign } from './validation';

const MAX_LAYERS = 32; // Star groups per break the editor allows before asking for another break.
const MAX_NAME_LENGTH = 120; // Characters, matches editor_library_parts.name.

/** Stored part categories; a whole firework is a template, not a saved part. */
export const partCategorySchema = z.enum(['stars', 'trails', 'effects', 'tails']);
export type PartCategory = z.infer<typeof partCategorySchema>;

/** Validated saved part as read from `editor_library_parts`. */
export const savedPartSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  category: partCategorySchema,
  // The renderer package carries its own zod copy, so validate through the shared upgrade path.
  design: z.unknown().transform((value, context): Design => {
    const result = validateEditorDesign(value);
    if (result.ok) return result.value;
    context.addIssue({ code: 'custom', message: result.error });
    return z.NEVER;
  }),
});
export type SavedPart = z.infer<typeof savedPartSchema>;

/** A reusable choice: a whole template, a saved part or a built-in option. */
export interface LibraryEntry {
  id: string;
  name: string;
  category: 'fireworks' | PartCategory;
  design?: Design;
  option?: string;
  saved?: boolean;
}

/** Category labels in display order. */
export const LIBRARY_CATEGORIES: ReadonlyArray<{ id: LibraryEntry['category']; label: string }> = [
  { id: 'stars', label: 'Star groups' },
  { id: 'trails', label: 'Trails' },
  { id: 'effects', label: 'Effects' },
  { id: 'tails', label: 'Rising tails' },
  { id: 'fireworks', label: 'Whole fireworks' },
];

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

/** Built-in entries from the renderer templates, then saved parts newest first. */
export function libraryEntries(saved: readonly SavedPart[] = []): LibraryEntry[] {
  return [
    ...saved.map((part) => ({
      id: part.id,
      name: part.name,
      category: part.category,
      design: part.design,
      saved: true,
    })),
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
          name: `${item.name}: ${layer.name}`,
          category: 'stars' as const,
          design: partEnvelope(item.design, `layer:${String(index)}:${layer.id}`),
        })),
      ),
    ),
    ...trailLooks.map((item) => ({
      id: `trail:${item.key}`,
      name: titleCase(item.key),
      category: 'trails' as const,
      option: item.key,
    })),
    ...modifierSchema.shape.kind.options.map((kind) => ({
      id: `effect:${kind}`,
      name: titleCase(kind),
      category: 'effects' as const,
      option: kind,
    })),
    ...launchSchema.shape.tail.options.map((tail) => ({
      id: `tail:${tail}`,
      name: titleCase(tail),
      category: 'tails' as const,
      option: tail,
    })),
  ];
}

/** Returns an independent design holding only the addressed star group, keeping its launch for previews. */
export function partEnvelope(document: Design, address: string): Design {
  const copy = resolveDesign(document);
  const selection = selectedLayer(copy, address);
  if (selection) {
    const burst = copy.breaks[selection.breakIndex];
    const layer = inspectorLayer(copy, selection);
    if (burst && layer)
      copy.breaks = [{ ...burst, at_s: 0, layers: [{ ...layer, delay_s: 0, hidden: false }] }];
  }
  return copy;
}

/** Copies one entry into the design and returns a validated new design, never mutating the input. */
export function applyLibrary(
  document: Design,
  address: string,
  entry: LibraryEntry,
): InspectorResult {
  if (entry.category === 'fireworks') {
    if (!entry.design) return { kind: 'invalid', message: 'This firework has no design.' };
    return { kind: 'edited', document: structuredClone(entry.design) };
  }
  if (entry.category === 'stars') return addStars(document, address, entry);
  const selection = selectedLayer(document, address);
  if (entry.category === 'tails') {
    if (document.launch === null)
      return { kind: 'invalid', message: 'This firework has no rising tail.' };
    return editDesign(document, (draft) => applyTail(draft, entry));
  }
  if (!selection) return { kind: 'invalid', message: 'Choose a star group first.' };
  return editDesign(document, (draft) => {
    const layer = inspectorLayer(draft, selection);
    if (!layer) return;
    const source = entry.design?.breaks.at(0)?.layers.at(0);
    if (entry.category === 'trails') applyTrail(layer, source, entry.option);
    if (entry.category === 'effects') applyModifiers(layer, source, entry.option);
  });
}

function addStars(document: Design, address: string, entry: LibraryEntry): InspectorResult {
  const index = selectedLayer(document, address)?.breakIndex ?? 0;
  const source = entry.design?.breaks.at(0)?.layers.at(0);
  const burst = document.breaks.at(index);
  if (!burst || !source)
    return { kind: 'invalid', message: 'Star groups need an aerial firework with a break.' };
  if (burst.layers.length >= MAX_LAYERS)
    return {
      kind: 'invalid',
      message: 'This break is full. Choose a star group in another break.',
    };
  return editDesign(document, (draft) => {
    const target = draft.breaks.at(index);
    if (!target) return;
    const used = new Set(draft.breaks.flatMap((item) => item.layers.map((layer) => layer.id)));
    let suffix = 1;
    while (used.has(`library-${String(suffix)}`)) suffix++;
    target.layers.push({
      ...structuredClone(source),
      id: `library-${String(suffix)}`,
      delay_s: 0,
      hidden: false,
    });
  });
}

function applyTrail(layer: Layer, source: Layer | undefined, option: string | undefined) {
  const trail = source?.trail ?? trailLooks.find((item) => item.key === option)?.trail;
  if (trail) layer.trail = structuredClone(trail);
}

function applyModifiers(layer: Layer, source: Layer | undefined, option: string | undefined) {
  if (source) {
    layer.modifiers = structuredClone(source.modifiers);
    if (source.colour.reignition)
      layer.colour.reignition = structuredClone(source.colour.reignition);
    return;
  }
  const kind = modifierSchema.shape.kind.safeParse(option);
  if (kind.success && !layer.modifiers.some((item) => item.kind === kind.data))
    toggleModifier(layer, kind.data);
}

function applyTail(draft: Design, entry: LibraryEntry) {
  if (!draft.launch) return;
  const tail = entry.design?.launch;
  if (tail) {
    draft.launch = { ...draft.launch, tail: tail.tail, sparks: tail.sparks, spread: tail.spread };
    return;
  }
  const option = launchSchema.shape.tail.safeParse(entry.option);
  if (option.success) draft.launch.tail = option.data;
}

/** True when the design has something to save for this category at the selected address. */
export function canSavePart(document: Design, address: string, category: PartCategory): boolean {
  if (category === 'tails') return document.launch !== null;
  const selection = selectedLayer(document, address);
  if (!selection) return false;
  const layer = inspectorLayer(document, selection);
  if (!layer) return false;
  if (category === 'effects') return layer.modifiers.length > 0;
  if (category === 'trails') return layer.trail.sparks > 0;
  return true;
}
