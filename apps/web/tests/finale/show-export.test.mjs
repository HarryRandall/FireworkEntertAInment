import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinale3dCsv, finaleExportWarning } from '../../lib/finale3d.ts';
import { readCsv } from '../../lib/finale/csv.ts';

const cue = (patch = {}) => ({
  timeSeconds: 1,
  effectName: 'Catalogue shell',
  launchPositionIndex: 1,
  sourcePayload: { partNumber: 'SUPPLIER-1', manufacturerPartNumber: 'MP-1', duration: '3' },
  ...patch,
});
const fixedHeader =
  'FIRING_HEADER_ROW,Time Cue Number,Ignition Event Time,Number Of Devices,Duration,Coordinates,Chain Identifier,Lockout Identifier,Device Delay,Prefire Delay,Effect Name,Caliber,Category,Angles,Position Name,Animation Description,Module Description,Module Address,Slat Address,Pin Address,Firing Notes,Product ID,Manufacturer Product ID,Animation ID,Location Primary,Location Secondary,Price Per Device,Mortar Caliber,Track Identifier';

test('mixed mapped and unmatched cues retain the exact fixed columns and every row', () => {
  const cues = [
    cue({ finaleProductId: 'FIN-42', finaleEffectName: 'Finale, "name"' }),
    cue({ finaleProductId: null }),
    cue({ finaleProductId: null }),
  ];
  const csv = buildFinale3dCsv(cues);
  assert.equal(csv.split('\n')[0], fixedHeader);
  const rows = readCsv(csv);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.length === 29));
  assert.equal(rows[1][10], 'Finale, "name"');
  assert.equal(rows[1][21], 'FIN-42');
  assert.equal(rows[1][20], '');
  assert.equal(rows[2][10], 'Catalogue shell');
  assert.equal(rows[2][20], 'No Finale 3D equivalent');
  assert.equal(rows[2][21], '');
  assert.equal(rows[1][22], 'MP-1');
  assert.equal(rows[1][14], 'P-02');
  assert.deepEqual(finaleExportWarning(cues), {
    kind: 'unmatched',
    cueCount: 2,
    effectNames: ['Catalogue shell'],
  });
});

test('a multishot mapping is decided solely by its own catalogue product', () => {
  const unmatchedParent = cue({
    effectName: 'Multishot',
    finaleProductId: null,
    sourcePayload: { partNumber: 'PARENT', children: [{ finaleProductId: 'CHILD' }] },
  });
  const matchedParent = cue({
    effectName: 'Multishot',
    finaleProductId: 'CAKE',
    sourcePayload: { children: [{ finaleProductId: null }] },
  });
  const rows = readCsv(buildFinale3dCsv([unmatchedParent, matchedParent]));
  assert.deepEqual(
    rows.slice(1).map((row) => [row[20], row[21]]),
    [
      ['No Finale 3D equivalent', ''],
      ['', 'CAKE'],
    ],
  );
  assert.equal(finaleExportWarning([matchedParent]), null);
});
