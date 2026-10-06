/** Exact cake inventory syntax encodes firing order rather than physical rack coordinates. */
import { cakeDocumentSchema, orderTubes, type CakeDocument } from './document.ts';
import type { CakeEffect } from './document.ts';
import { writeCsv } from './csv.ts';
import { exportShowScript } from './script.ts';
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
/** Catalogue metadata for a cake inventory row; absent confirmed calibre stays blank. */
export interface FinaleCakeMetadata {
  partNumber: string;
  calibreMm: number | null;
}
function cakeExport(document: CakeDocument, effects: readonly CakeEffect[]) {
  const ordered = orderTubes(cakeDocumentSchema.parse(document));
  const tubes = ordered.composition.tubes;
  if (tubes.length === 0) throw new Error('Add at least one tube before exporting.');
  if (tubes[0].t_ms !== 0)
    throw new Error('Exact cake syntax requires the first tube to fire at zero.');
  const names = Object.entries(ordered.bindings).map(([letter, id]) => {
    const effect = effects.find((entry) => entry.id === id);
    if (!effect) throw new Error(`No catalogue effect for ${letter}.`);
    if (effect.document.kind !== 'shell' || effect.document.breaks.length !== 1)
      throw new Error('Finale cakes require single-break shell effects.');
    if (/[+()\r\n]/.test(effect.name) || /\bCake\b/i.test(effect.name))
      throw new Error(
        `The effect name "${effect.name}" cannot be represented in exact cake syntax.`,
      );
    return `(${letter}) ${effect.name}`;
  });
  const duration = (tubes.at(-1)?.t_ms ?? 0) / MILLISECONDS_PER_SECOND;
  const sections = tubes.map((tube, index) => {
    const next = tubes.at(index + 1);
    const gap = next ? String((next.t_ms ?? 0) - (tube.t_ms ?? 0)) : '';
    return `${String(Math.round(tube.angle_deg))}${tube.letter}${gap}`;
  });
  const description = `${String(tubes.length)} Shot ${duration.toFixed(1)}s ${names.join(' + ')} Cake, 1 Row (${sections.join('/')}/CAK)`;
  return { ordered, duration, description };
}
/** Exports one inventory row, with identical exact description/vdl and millisecond gaps. No mutation. */
function cakeInventory(
  document: CakeDocument,
  effects: readonly CakeEffect[],
  metadata: FinaleCakeMetadata,
): string {
  const cake = cakeExport(document, effects);
  return writeCsv([
    ['partNumber', 'description', 'partType', 'size', 'duration', 'numTubes', 'vdl'],
    [
      metadata.partNumber,
      cake.description,
      'cake',
      metadata.calibreMm === null ? '' : `${String(metadata.calibreMm)}mm`,
      cake.duration.toFixed(2),
      cake.ordered.composition.tubes.length,
      cake.description,
    ],
  ]);
}
/** Exports per-tube checking events from first firing, in milliseconds; physical rack positions are omitted. */
function cakeScript(
  document: CakeDocument,
  effects: readonly CakeEffect[],
  partNumber: string,
): string {
  const cake = cakeExport(document, effects);
  return exportShowScript(
    cake.ordered.composition.tubes.map((tube, index) => ({
      timeMs: tube.t_ms ?? 0,
      partNumber: `${partNumber}-${tube.letter}`,
      description:
        effects.find((effect) => effect.id === document.bindings[tube.letter])?.name ?? '',
      position: `Tube-${String(index + 1).padStart(2, '0')}`,
      angleDeg: tube.angle_deg,
    })),
  );
}

/** Expected syntax limitations are returned without exceptions at the export boundary. */
export type FinaleCakeExportResult =
  | { kind: 'export'; csv: string }
  | { kind: 'error'; message: string };

/** Exports exact inventory syntax, refusing unsupported effects or timings without mutation. */
export function exportCakeInventory(
  document: CakeDocument,
  effects: readonly CakeEffect[],
  metadata: FinaleCakeMetadata,
): FinaleCakeExportResult {
  return exportResult(() => cakeInventory(document, effects, metadata));
}

/** Exports per-tube checking events as a typed result. */
export function exportCakeScript(
  document: CakeDocument,
  effects: readonly CakeEffect[],
  partNumber: string,
): FinaleCakeExportResult {
  return exportResult(() => cakeScript(document, effects, partNumber));
}

function exportResult(build: () => string): FinaleCakeExportResult {
  try {
    return { kind: 'export', csv: build() };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Could not export this cake.',
    };
  }
}
