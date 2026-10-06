/**
 * Finale 3D firing-script CSV exporter.
 *
 * Converts an ordered list of cues into the CSV format that the Finale 3D
 * pyrotechnics design tool expects. The header rows and column order are
 * fixed by Finale; do not reorder. This module is isomorphic (no Node APIs)
 * so it can run on either the server or in download buttons on the client.
 */
import type { Json } from '@/lib/database.types';

type SourcePayload = {
  partNumber?: string;
  manufacturerPartNumber?: string;
  size?: string;
  internalDelay?: string;
  vdl?: string;
  category?: string;
  duration?: string;
};

export type Finale3dCueInput = {
  timeSeconds: number;
  effectName: string;
  finaleProductId?: string | null;
  finaleEffectName?: string | null;
  /** Tube the cue fires from; maps deterministically to a Finale position name. */
  launchPositionIndex: number;
  sourcePayload: Json | null;
};

const POSITIONS = ['P-01', 'P-02', 'P-03'] as const;

const HEADER = [
  'FIRING_HEADER_ROW',
  'Time Cue Number',
  'Ignition Event Time',
  'Number Of Devices',
  'Duration',
  'Coordinates',
  'Chain Identifier',
  'Lockout Identifier',
  'Device Delay',
  'Prefire Delay',
  'Effect Name',
  'Caliber',
  'Category',
  'Angles',
  'Position Name',
  'Animation Description',
  'Module Description',
  'Module Address',
  'Slat Address',
  'Pin Address',
  'Firing Notes',
  'Product ID',
  'Manufacturer Product ID',
  'Animation ID',
  'Location Primary',
  'Location Secondary',
  'Price Per Device',
  'Mortar Caliber',
  'Track Identifier',
];

function csvCell(value: string): string {
  if (value === '') return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeCategory(raw: string | undefined): string {
  if (!raw) return '';
  // Strip leading size prefix e.g. `1"Cakes` → `Cakes`, `30mm Cakes` → `Cakes`
  return raw.replace(/^[\d.]+["""']?\s*/i, '').trim();
}

function parsePayload(payload: Json | null): SourcePayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as SourcePayload;
}

/** Exports every cue; multishots use their parent catalogue mapping, never child mappings. */
export function buildFinale3dCsv(cues: Finale3dCueInput[]): string {
  const lines: string[] = [HEADER.join(',')];

  for (const cue of cues) {
    const p = parsePayload(cue.sourcePayload);
    // Map the cue's actual tube to a fixed position name. A firing script must
    // be deterministic, so never randomise this. Out-of-range indices wrap.
    const positionIndex =
      Number.isInteger(cue.launchPositionIndex) && cue.launchPositionIndex >= 0
        ? cue.launchPositionIndex % POSITIONS.length
        : 0;
    const pos = POSITIONS[positionIndex];
    const row = [
      'FIRING_DATA_ROW',
      '',
      cue.timeSeconds.toFixed(3),
      '1',
      p.duration ?? '',
      '',
      '',
      '',
      '0.0',
      p.internalDelay ?? '0',
      cue.finaleEffectName ?? cue.effectName,
      p.size ?? '',
      normalizeCategory(p.category),
      '',
      pos,
      p.vdl ?? '',
      '',
      '',
      '',
      '',
      cue.finaleProductId ? '' : 'No Finale 3D equivalent',
      cue.finaleProductId ?? '',
      p.manufacturerPartNumber ?? '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];
    lines.push(row.map(csvCell).join(','));
  }

  return lines.join('\n');
}

/** Expected confirmation result for cues whose catalogue product has no Finale mapping. */
export type FinaleExportWarning = {
  kind: 'unmatched';
  cueCount: number;
  effectNames: string[];
};

/** Counts parent catalogue mappings, retaining unique exported effect names in cue order. */
export function finaleExportWarning(cues: readonly Finale3dCueInput[]): FinaleExportWarning | null {
  const unmatched = cues.filter((cue) => !cue.finaleProductId);
  return unmatched.length
    ? {
        kind: 'unmatched',
        cueCount: unmatched.length,
        effectNames: [...new Set(unmatched.map((cue) => cue.finaleEffectName ?? cue.effectName))],
      }
    : null;
}

/** Narrows the API's expected confirmation response before displaying it. */
export function isFinaleExportWarning(value: unknown): value is FinaleExportWarning {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'unmatched' &&
    'cueCount' in value &&
    typeof value.cueCount === 'number' &&
    Number.isSafeInteger(value.cueCount) &&
    value.cueCount > 0 &&
    'effectNames' in value &&
    Array.isArray(value.effectNames) &&
    value.effectNames.every((name: unknown) => typeof name === 'string')
  );
}
