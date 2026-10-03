/** Dashboard state and CSV tests exercise consumer-visible data semantics. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRange,
  dashboardLink,
  exportCsv,
  readDashboardState,
  removeFacet,
  setFacet,
  trailingRange,
  validRange,
  funnelPercent,
} from '../ui/kit/dashboard-logic.ts';

test('facet replacement preserves other filters and does not mutate input', () => {
  const filters = [
    { facet: 'Store', value: 'North' },
    { facet: 'Placement', value: 'Shelf' },
  ];
  const next = setFacet(filters, { facet: 'Placement', value: 'Counter' });
  assert.deepEqual(next, [
    { facet: 'Store', value: 'North' },
    { facet: 'Placement', value: 'Counter' },
  ]);
  assert.equal(filters[1].value, 'Shelf');
  assert.deepEqual(removeFacet(next, 'Store'), [{ facet: 'Placement', value: 'Counter' }]);
});
test('inclusive ranges cross month, year and daylight-saving boundaries', () => {
  assert.deepEqual(trailingRange('2026-01-02', 7), { from: '2025-12-27', to: '2026-01-02' });
  assert.deepEqual(trailingRange('2026-10-06', 7), { from: '2026-09-30', to: '2026-10-06' });
  assert.deepEqual(trailingRange('2026-11-09', 1), { from: '2026-11-09', to: '2026-11-09' });
  assert.throws(() => trailingRange('2026-02-30', 7), RangeError);
  assert.throws(() => trailingRange('2026-11-09', 0), RangeError);
  assert.throws(() => trailingRange('2026-11-09', 1.5), RangeError);
});
test('same-date last-season comparison clamps leap days', () => {
  assert.deepEqual(compareRange({ from: '2024-02-29', to: '2024-03-02' }), {
    from: '2023-02-28',
    to: '2023-03-02',
  });
  assert.deepEqual(compareRange({ from: '2026-10-20', to: '2026-11-09' }), {
    from: '2025-10-20',
    to: '2025-11-09',
  });
  assert.throws(() => compareRange({ from: '2026-11-10', to: '2026-11-09' }), RangeError);
});
test('calendar validation rejects impossible dates, missing padding and reversed ranges', () => {
  for (const from of ['2026-02-29', '2026-2-01', 'not-a-date', '2026-13-01']) {
    assert.equal(validRange({ from, to: '2026-12-31' }), false);
  }
  assert.equal(validRange({ from: '2024-02-29', to: '2024-02-29' }), true);
});
test('CSV quotes commas, quotes and line breaks and retains zero and negative numeric values', () => {
  assert.equal(
    exportCsv(
      ['Name', 'Value'],
      [
        ['A,"B"\nC', 0],
        ['plain', -2],
      ],
    ),
    '"Name","Value"\r\n"A,""B""\nC","0"\r\n"plain","-2"\r\n',
  );
  assert.equal(exportCsv(['Name'], []), '"Name"\r\n');
  assert.throws(() => exportCsv(['Name'], [['a', 'b']]), RangeError);
});
test('CSV neutralises spreadsheet formulas after whitespace', () => {
  const values = ['=SUM(A1)', '+1', '-2', '@SUM(A1)', ' \t=1', '\r=1'];
  const csv = exportCsv(
    ['=Header'],
    values.map((value) => [value]),
  );
  for (const value of values) assert.ok(csv.includes(`"'${value}"`));
  assert.ok(csv.startsWith('"\'=Header"'));
});
test('share links round-trip allowed filters without losing existing query parameters', () => {
  const state = {
    filters: [{ facet: 'Placement', value: 'Shelf' }],
    range: { from: '2026-10-20', to: '2026-11-09' },
    compare: true,
  };
  const link = new URL(
    dashboardLink('http://localhost:3001/dev/components?example=1#dashboard', state),
  );
  assert.equal(link.searchParams.get('example'), '1');
  assert.equal(link.hash, '#dashboard');
  assert.deepEqual(
    readDashboardState(link.searchParams.get('dashboard'), { Placement: ['Shelf'] }),
    state,
  );
});
test('untrusted share state rejects unknown facets, duplicate facets, invalid dates and unexpected properties', () => {
  const state = { filters: [], range: { from: '2026-10-20', to: '2026-11-09' }, compare: false };
  const badStates = [
    null,
    [],
    {},
    { ...state, compare: 'true' },
    { ...state, range: { from: '2026-02-30', to: '2026-11-09' } },
    { ...state, filters: [{ facet: '__proto__', value: 'Shelf' }] },
    { ...state, filters: [{ facet: 'Placement', value: 'Unknown' }] },
    {
      ...state,
      filters: [
        { facet: 'Placement', value: 'Shelf' },
        { facet: 'Placement', value: 'Shelf' },
      ],
    },
    { ...state, unexpected: true },
  ];
  for (const value of badStates)
    assert.equal(readDashboardState(JSON.stringify(value), { Placement: ['Shelf'] }), null);
  assert.equal(readDashboardState('{broken', {}), null);
  assert.equal(readDashboardState(null, {}), null);
});
test('empty funnel percentages avoid division by zero', () => {
  assert.equal(funnelPercent(0, 0), 0);
  assert.equal(funnelPercent(300, 500), 60);
});
