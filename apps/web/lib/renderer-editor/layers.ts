/** Stable tree addresses relate renderer breaks and star groups to Editor selection. */
import type { Design } from '@showcrafter/renderer';
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
