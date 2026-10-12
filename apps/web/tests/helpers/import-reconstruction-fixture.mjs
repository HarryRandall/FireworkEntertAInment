/** A version 2 import reconstruction built from renderer templates. */
await import('../../../../scripts/renderer/register-typescript.mjs');
const { effectTemplates } = await import('@showcrafter/renderer');

const peony = effectTemplates.find((template) => template.key === 'peony').design;
const willow = effectTemplates.find((template) => template.key === 'willow').design;

export function reconstruction(overrides = {}) {
  return {
    version: 2,
    name: 'Imported cake',
    description: null,
    durationSeconds: 9,
    designs: [
      {
        key: 'a',
        template: 'peony',
        label: 'Peony',
        design: peony,
        durationSeconds: 4,
        colorPalette: ['#ff0000'],
      },
      {
        key: 'b',
        template: 'willow',
        label: 'Willow',
        design: willow,
        durationSeconds: 6,
        colorPalette: [],
      },
    ],
    shots: [
      { id: '0', designKey: 'a', timeOffsetSeconds: 0, panDegrees: 0, x: 0.5 },
      { id: '1', designKey: 'b', timeOffsetSeconds: 3, panDegrees: -12, x: 0.4 },
      { id: '2', designKey: 'a', timeOffsetSeconds: 1.5, panDegrees: 8, x: null },
    ],
    source: { durationSeconds: 10, firstShotSeconds: 0.75, extractor: 'test' },
    ...overrides,
  };
}
