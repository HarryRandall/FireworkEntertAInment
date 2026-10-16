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

test('placements reproduce the replay site: spread racks, cake slots and outward leans', async () => {
  await import('../../../../scripts/renderer/register-typescript.mjs');
  const { finalePlacements, finaleCoordinates } =
    await import('../../lib/shows/finale-placement.ts');
  const { MIN_LAUNCH_POSITION_GAP_M, SHOW_OUTER_LEAN_DEGREES } =
    await import('../../lib/shows/renderer-shots.ts');
  const positions = [
    { x: -200, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 200, y: 0, z: 0 },
  ];
  const placements = finalePlacements(
    [
      { id: 'shell-left', launchPositionIndex: 0, isCake: false, leansOnRack: true },
      { id: 'cake', launchPositionIndex: 1, isCake: true, leansOnRack: false },
      { id: 'shell-right', launchPositionIndex: 2, isCake: false, leansOnRack: true },
      { id: 'shell-centre', launchPositionIndex: 1, isCake: false, leansOnRack: true },
    ],
    positions,
  );
  const left = placements.get('shell-left');
  const right = placements.get('shell-right');
  assert.equal(left.positionName, 'P-01');
  assert.equal(right.coordinates[0] - left.coordinates[0], 2 * MIN_LAUNCH_POSITION_GAP_M);
  assert.equal(left.leanDeg, -SHOW_OUTER_LEAN_DEGREES);
  assert.equal(placements.get('shell-centre').leanDeg, 0);
  const cake = placements.get('cake');
  assert.equal(cake.positionName, 'P-02 C1');
  assert.ok(cake.coordinates[2] > 0, 'cakes sit in front of their rack, towards the audience');
  assert.equal(finaleCoordinates(placements.get('shell-centre')), '0.00 0.00 0.00');
  assert.equal(
    finaleCoordinates(right),
    `${MIN_LAUNCH_POSITION_GAP_M.toFixed(2)} 0.00 0.00 0 0 0 90.00 ${SHOW_OUTER_LEAN_DEGREES.toFixed(2)} -90.00`,
  );
});

test('rows with a placement export its position name and coordinates', () => {
  const rows = readCsv(
    buildFinale3dCsv([
      cue({ placement: { positionName: 'P-02 C1', coordinates: '0.00 0.00 6.00' } }),
    ]),
  );
  assert.equal(rows[1][14], 'P-02 C1');
  assert.equal(rows[1][5], '0.00 0.00 6.00');
});
