/** Behaviour checks for area containment and visibility-driven navigation. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areaConfigs } from '../ui/shell/config/index.ts';
import {
  currentItem,
  currentSection,
  visibleSections,
  shellNavigation,
  identityVisibility,
} from '../ui/shell/navigation.ts';

for (const config of Object.values(areaConfigs)) {
  test(`${config.area} destinations remain within their area and select their rail section`, () => {
    for (const section of config.sections) {
      for (const item of [...section.items, ...section.shortcuts]) {
        assert.ok(item.href === config.href || item.href.startsWith(config.href + '/'));
        assert.equal(currentItem(config, item.href)?.href, item.href);
        if (section.items.includes(item))
          assert.equal(currentSection(config, item.href).label, section.label);
      }
    }
    assert.equal(currentItem(config, config.href + '-neighbour'), undefined);
  });
  test(`${config.area} optional predicates filter every navigation surface`, () => {
    assert.deepEqual(visibleSections(config, { area: () => false }), []);
    const filtered = visibleSections(config, { item: (item) => item.href === config.href });
    assert.equal(filtered.length, 1);
    assert.deepEqual(filtered[0].shortcuts, []);
    assert.ok(filtered[0].items.every((item) => item.href === config.href));
    assert.equal(shellNavigation(config, config.href, { area: () => false }).section, undefined);
  });
}

test('server area permissions constrain navigation even when preview predicates allow more', () => {
  const visibility = identityVisibility({ permittedAreas: ['account'] }, { area: () => true });
  for (const config of Object.values(areaConfigs)) {
    assert.equal(visibility.area(config.area), config.area === 'account');
    assert.equal(visibleSections(config, visibility).length > 0, config.area === 'account');
  }
  assert.deepEqual(
    visibleSections(areaConfigs.account, identityVisibility({ permittedAreas: [] })),
    [],
  );
});

test('preview predicates can narrow permitted areas and still filter items', () => {
  const visibility = identityVisibility(
    { permittedAreas: ['retailer', 'account'] },
    {
      area: (area) => area === 'retailer',
      item: (item) => item.href === '/retailer',
    },
  );
  assert.equal(visibility.area('account'), false);
  assert.deepEqual(visibleSections(areaConfigs.retailer, visibility)[0].items, [
    { label: 'Overview', href: '/retailer' },
  ]);
  const preview = identityVisibility(undefined);
  for (const area of Object.keys(areaConfigs)) assert.equal(preview.area(area), true);
});
