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
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
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

export function buildFinale3dCsv(cues: Finale3dCueInput[]): string {
  const lines: string[] = [HEADER.join(',')];

  for (const cue of cues) {
    const p = parsePayload(cue.sourcePayload);
    const pos = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
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
      cue.effectName,
      p.size ?? '',
      normalizeCategory(p.category),
      '',
      pos,
      p.vdl ?? '',
      '',
      '',
      '',
      '',
      '',
      p.partNumber ?? '',
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
