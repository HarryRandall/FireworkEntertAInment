/** Stable tree addresses relate renderer breaks and star groups to Studio selection. */
import type { Design } from '@showcrafter/fireworks';
import type { LayerItem } from '@/ui/kit/layer-list';

/** Distinguishes ground emitters from airborne comet, candle and rocket documents. */
export function isGroundEffect(document: Design): boolean {
  return ['fountain', 'tourbillon', 'wheel', 'spinner'].includes(document.kind);
}

/** Identifies a star group inside its containing break without assuming globally unique layer IDs. */
export interface LayerSelection {
  breakIndex: number;
  layerId: string;
}
/** Creates a stable UI address from a zero-based break index and an authored layer identifier. */
export function layerAddress(breakIndex: number, layerId: string): string {
  return `layer:${String(breakIndex)}:${layerId}`;
}
/** Resolves a tree address against the current document, returning null for non-layer rows. */
export function selectedLayer(document: Design, address: string): LayerSelection | null {
  for (const [breakIndex, burst] of document.breaks.entries()) {
    const layer = burst.layers.find((item) => layerAddress(breakIndex, item.id) === address);
    if (layer) return { breakIndex, layerId: layer.id };
  }
  return null;
}
/** Builds the expanded layer list grouped by break; preview visibility does not alter authored data. */
export function studioLayers(
  document: Design,
  collapsed: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
): LayerItem[] {
  const rows: LayerItem[] = document.launch ? [{ id: 'launch', name: 'Launch' }] : [];
  if (document.ground)
    rows.push({ id: 'ground', name: isGroundEffect(document) ? 'Ground effect' : 'Rising stars' });
  for (const [index, burst] of document.breaks.entries()) {
    const id = `break:${String(index)}`;
    const expanded = !collapsed.has(id);
    rows.push({
      id,
      name: `Break ${String(index + 1)}`,
      hasChildren: true,
      expanded,
      badge: String(burst.layers.length),
      hidden: hidden.has(id),
    });
    if (!expanded) continue;
    if (burst.core.enabled)
      rows.push({
        id: `core:${String(index)}`,
        name: 'Core flash',
        depth: 1,
        colour: burst.core.colour,
      });
    rows.push(
      ...burst.layers.map((layer) => ({
        id: layerAddress(index, layer.id),
        name: layer.name,
        depth: 1,
        badge: layer.pattern,
        hidden: hidden.has(layerAddress(index, layer.id)),
      })),
    );
  }
  return rows.map((row) => ({ ...row, hidden: hidden.has(row.id) }));
}
/** Returns a preview copy with hidden sources removed; sound and stored renderer units are retained. */
export function previewDocument(document: Design, hidden: ReadonlySet<string>): Design {
  const preview = structuredClone(document);
  if (preview.launch && hidden.has('launch')) {
    preview.launch.tail = 'dark';
    preview.launch.sparks = 0;
  }
  preview.breaks = preview.breaks.map((burst, index) => ({
    ...burst,
    core:
      hidden.has(`break:${String(index)}`) || hidden.has(`core:${String(index)}`)
        ? { ...burst.core, enabled: false }
        : burst.core,
    layers: hidden.has(`break:${String(index)}`)
      ? []
      : burst.layers.filter((layer) => !hidden.has(layerAddress(index, layer.id))),
  }));
  return preview;
}
