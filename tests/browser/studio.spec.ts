/** Authenticated Studio journeys and composer-owned viewport/theme screenshots. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { openCatalogueEffect } from './catalogue-helpers';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from './auth-helpers';

const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };

async function openFromCatalogue(page: Page, search = 'Peony') {
  await page.goto('/admin/catalogue');
  await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
  await openCatalogueEffect(page, search);
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  await expect(async () => {
    if (!/\/admin\/studio\/[\da-f-]+$/.test(page.url()))
      await page.getByRole('link', { name: 'Open in Studio', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/studio\/[\da-f-]+$/);
  }).toPass();
  await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
}
async function pauseStage(page: Page) {
  const stage = page.getByRole('region', { name: 'Stage', exact: true });
  await stage.scrollIntoViewIfNeeded();
  await expect(stage.locator('canvas')).toHaveAttribute('data-draw-pending', 'false');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible()) await pause.click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}
async function capture(page: Page, testInfo: TestInfo, label: string, selector: string) {
  await testInfo.attach(label, {
    body: await page.locator(selector).screenshot({ path: `output/playwright/${label}.png` }),
    contentType: 'image/png',
  });
}
for (const [size, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} Studio layers, tabs, history and saved reload`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      await openFromCatalogue(page);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await pauseStage(page);
      const layers = page.getByRole('region', { name: 'Layers', exact: true });
      await expect(async () => {
        await layers.getByRole('button', { name: 'Collapse Break 1', exact: true }).click();
        await expect(
          layers.getByRole('button', { name: 'Expand Break 1', exact: true }),
        ).toBeVisible();
      }).toPass();
      await layers.getByRole('button', { name: 'Expand Break 1', exact: true }).click();
      const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
      const original = await name.inputValue();
      await layers.getByRole('button', { name: 'Launch', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Inspector', exact: true })).toContainText(
        'From the tube to the break',
      );
      await layers.locator('button[aria-pressed]').filter({ hasText: original }).first().click();
      await expect(name).toHaveValue(original);
      await layers.getByRole('button', { name: `Hide ${original}`, exact: true }).click();
      await expect(
        layers.getByRole('button', { name: `Show ${original}`, exact: true }),
      ).toBeVisible();
      await layers.getByRole('button', { name: `Show ${original}`, exact: true }).click();
      const editLabel = `Studio ${size} ${theme}`;
      const edited = original === editLabel ? `${editLabel} updated` : editLabel;
      await name.fill(edited);
      await name.blur();
      await expect(layers).toContainText(edited);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(name).toHaveValue(original);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect(name).toHaveValue(edited);
      await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
      await page.reload();
      await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
      await expect(name).toHaveValue(edited);
      await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
      await pauseStage(page);
      await watchDraws(page);
      for (const [tab, sliderLabel] of [
        ['Launch', 'Height'],
        ['Burst', 'Flash strength'],
        ['Stars', 'Size'],
        ['Trail', 'Density'],
        ['Effect', 'Twinkle twinkle rate'],
      ]) {
        if (!tab || !sliderLabel) throw new Error('Missing inspector test case');
        await expect(async () => {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
            'aria-selected',
            'true',
          );
        }).toPass();
        await expect(
          page.getByRole('region', { name: 'Inspector', exact: true }).getByRole('tabpanel'),
        ).toContainText(`${tab} settings`);
        let temporaryToggle = false;
        if (tab === 'Trail') temporaryToggle = await ensureToggle(page, 'Trail on');
        if (tab === 'Effect') temporaryToggle = await ensureToggle(page, 'Twinkle');
        if (tab === 'Launch') await checkQuickAdjustment(page);
        await checkSliderEdit(page, sliderLabel);
        if (tab === 'Stars') {
          await checkNumberEdit(page, 'Brightness key 2 value');
          await checkColourEdit(page, 'Star colour stop 2 colour 1');
          await openDisclosure(page, 'Physics and fine controls');
          await checkSliderEdit(page, 'Air drag');
          await capture(
            page,
            testInfo,
            `studio-${size}-${theme}-inspector-Physics`,
            '.sc-studio-inspector',
          );
        }
        await capture(
          page,
          testInfo,
          `studio-${size}-${theme}-inspector-${tab}`,
          '.sc-studio-inspector',
        );
        await expect(async () => {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }).toPass();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        if (temporaryToggle) await page.getByRole('button', { name: 'Undo', exact: true }).click();
      }
      await openDisclosure(page, 'Sound mix');
      await checkSliderEdit(page, 'Lift');
      await capture(
        page,
        testInfo,
        `studio-${size}-${theme}-inspector-Sound`,
        '.sc-studio-inspector',
      );
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }).toPass();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const section of ['toolbar', 'layers', 'stage'])
        await capture(
          page,
          testInfo,
          `studio-${size}-${theme}-${section}`,
          `.sc-studio-${section}`,
        );
      await capture(page, testInfo, `studio-${size}-${theme}-full`, '.sc-shell');
      // Keep the seeded template intact for the composer's other catalogue journeys.
      await name.fill(original);
      await name.blur();
      await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
    });
  }
}
test('ground Studio exposes one inspector panel and playback controls', async ({ page }) => {
  await signInAs(page, 'admin');
  await openFromCatalogue(page, 'Fountain');
  const inspector = page.getByRole('region', { name: 'Inspector', exact: true });
  await expect(inspector.getByRole('tab')).toHaveCount(1);
  await expect(inspector.getByRole('tab', { name: 'Ground', exact: true })).toBeVisible();
  await expect(inspector.getByRole('tabpanel')).toHaveCount(1);
  await pauseStage(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('slider', { name: 'Preview time', exact: true }).fill('1');
  await expect(page.locator('.sc-studio-stage canvas')).toHaveAttribute(
    'data-drawn-time',
    '1.000000',
  );
});
test('non-admin is refused Studio access before a document loads', async ({ page }) => {
  await signInAs(page, 'owner');
  await page.goto('/admin/studio/ffffffff-ffff-ffff-ffff-ffffffffffff');
  await expect(page).toHaveURL('/access-denied');
  await expect(page.locator('[data-studio]')).toHaveCount(0);
});
test('failed autosave retains edits and Save retries the same draft', async ({ page }) => {
  await signInAs(page, 'admin');
  await openFromCatalogue(page);
  const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
  const original = await name.inputValue();
  await page.route('**/admin/studio/*', async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  await name.fill('Retained after failure');
  await name.blur();
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Save failed');
  await expect(name).toHaveValue('Retained after failure');
  await page.unroute('**/admin/studio/*');
  await page.getByRole('button', { name: 'Editor actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
  await name.fill(original);
  await name.blur();
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
});

async function watchDraws(page: Page) {
  await page.locator('.sc-studio-stage canvas').evaluate((canvas) => {
    canvas.setAttribute('data-test-redraws', '0');
    // Observe the Viewer's real completion signal, including coalesced updates while offscreen.
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) => record.attributeName === 'data-draw-pending') &&
        canvas.getAttribute('data-draw-pending') === 'false'
      ) {
        canvas.setAttribute(
          'data-test-redraws',
          String(Number(canvas.getAttribute('data-test-redraws')) + 1),
        );
      }
    });
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-draw-pending'] });
  });
}
async function redrawCount(page: Page) {
  return Number(await page.locator('.sc-studio-stage canvas').getAttribute('data-test-redraws'));
}
async function waitForEditedStage(page: Page, before: number) {
  const stage = page.getByRole('region', { name: 'Stage', exact: true });
  await stage.scrollIntoViewIfNeeded();
  await expect.poll(() => redrawCount(page)).toBeGreaterThan(before);
  await expect(stage.locator('canvas')).toHaveAttribute('data-draw-pending', 'false');
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
}
async function checkSliderEdit(page: Page, label: string) {
  const slider = page.getByRole('slider', { name: label, exact: true }).first();
  const original = await slider.getAttribute('aria-valuenow');
  if (original === null) throw new Error(`Missing slider value: ${label}`);
  const direction =
    original === (await slider.getAttribute('aria-valuemax')) ? 'ArrowLeft' : 'ArrowRight';
  const before = await redrawCount(page);
  await slider.focus();
  await slider.press(direction);
  await slider.blur();
  await expect(slider).not.toHaveAttribute('aria-valuenow', original);
  const edited = await slider.getAttribute('aria-valuenow');
  if (edited === null) throw new Error(`Missing edited value: ${label}`);
  await waitForEditedStage(page, before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', edited);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', original);
}
async function ensureToggle(page: Page, label: string) {
  const toggle = page
    .getByRole('region', { name: 'Inspector', exact: true })
    .getByRole('button', { name: label, exact: true });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await expect(async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }).toPass();
    return true;
  }
  return false;
}
async function openDisclosure(page: Page, title: string) {
  const summary = page
    .getByRole('region', { name: 'Inspector', exact: true })
    .locator('summary')
    .filter({ hasText: title });
  const details = summary.locator('..');
  if ((await details.getAttribute('open')) === null) await summary.click();
  await expect(details).toHaveAttribute('open', '');
}
async function checkNumberEdit(page: Page, label: string) {
  const input = page.getByRole('spinbutton', { name: label, exact: true });
  const original = await input.inputValue();
  const next = Number(original) > 0.5 ? '0.4' : '0.8';
  const before = await redrawCount(page);
  await input.fill(next);
  await input.blur();
  await expect(input).toHaveValue(next);
  await waitForEditedStage(page, before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(input).toHaveValue(original);
}
async function checkColourEdit(page: Page, label: string) {
  const input = page.getByLabel(label, { exact: true });
  const original = await input.inputValue();
  const next = original === '#ff4f6a' ? '#2ee6a0' : '#ff4f6a';
  const before = await redrawCount(page);
  await input.fill(next);
  await input.blur();
  await expect(input).toHaveValue(next);
  await waitForEditedStage(page, before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(input).toHaveValue(original);
}

for (const [size, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} ground inspector edits and saved reload`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      await openFromCatalogue(page, 'Fountain');
      await pauseStage(page);
      await watchDraws(page);
      await checkSliderEdit(page, 'Height');
      await openDisclosure(page, 'Sound mix');
      await checkSliderEdit(page, 'Break');
      await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
      await page.reload();
      await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
      await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
      await pauseStage(page);
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }).toPass();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await capture(
        page,
        testInfo,
        `studio-${size}-${theme}-inspector-Ground`,
        '.sc-studio-inspector',
      );
      await capture(page, testInfo, `studio-${size}-${theme}-ground-full`, '.sc-shell');
    });
  }
}

async function checkQuickAdjustment(page: Page) {
  const group = page.getByRole('radiogroup', { name: 'Height adjustment', exact: true });
  const selected = group.locator('[aria-checked="true"]');
  const original = await selected.getAttribute('aria-label');
  if (original === null) throw new Error('Missing selected height adjustment');
  const option = group.getByRole('radio', {
    name: original === 'Height Slightly High' ? 'Height More High' : 'Height Slightly High',
    exact: true,
  });
  const before = await redrawCount(page);
  await expect(async () => {
    await option.click();
    await expect(option).toHaveAttribute('aria-checked', 'true');
  }).toPass();
  await waitForEditedStage(page, before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(group.getByRole('radio', { name: original, exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

test('break list and curve/gradient drags each commit a single undo step', async ({ page }) => {
  await signInAs(page, 'admin');
  await openFromCatalogue(page);
  await pauseStage(page);
  await watchDraws(page);
  await selectInspectorTab(page, 'Burst');
  const inspector = page.getByRole('region', { name: 'Inspector', exact: true });
  const breaks = inspector.getByRole('button', { name: /^Remove break / });
  const originalCount = await breaks.count();
  const before = await redrawCount(page);
  await expect(async () => {
    await inspector.getByRole('button', { name: 'Add break', exact: true }).click();
    await expect(breaks).toHaveCount(originalCount + 1);
  }).toPass();
  await waitForEditedStage(page, before);
  await inspector
    .getByRole('button', { name: `Remove break ${originalCount + 1}`, exact: true })
    .click();
  await expect(breaks).toHaveCount(originalCount);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(breaks).toHaveCount(originalCount + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(breaks).toHaveCount(originalCount);
  await selectInspectorTab(page, 'Stars');
  for (const [graph, handle, inputLabel, addLabel] of [
    ['Brightness', 'Brightness key 2', 'Brightness key 2 time', 'Add key'],
    ['Star colour', 'Star colour stop 2', 'Star colour stop 2 time', 'Add stop'],
  ]) {
    if (!graph || !handle || !inputLabel || !addLabel) throw new Error('Missing graph case');
    const surface = page.getByLabel(graph, { exact: true });
    const originalKeys = await surface.getByRole('button').count();
    await expect(async () => {
      await inspector.getByRole('button', { name: addLabel, exact: true }).click();
      await expect(surface.getByRole('button')).toHaveCount(originalKeys + 1);
    }).toPass();
    const input = page.getByRole('spinbutton', { name: inputLabel, exact: true });
    await expect(input).toBeEnabled();
    const original = await input.inputValue();
    const key = page.getByRole('button', { name: handle, exact: true });
    await key.scrollIntoViewIfNeeded();
    const keyBounds = await key.boundingBox();
    const bounds = await surface.boundingBox();
    if (!bounds || !keyBounds) throw new Error('Graph is not visible');
    await page.mouse.move(keyBounds.x + keyBounds.width / 2, keyBounds.y + keyBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.6, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(input).not.toHaveValue(original);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(input).toHaveValue(original);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(input).not.toHaveValue(original);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(input).toHaveValue(original);
    // One further undo removes preparation, proving the drag produced exactly one entry.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(surface.getByRole('button')).toHaveCount(originalKeys);
  }
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
});

async function selectInspectorTab(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: label, exact: true });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }).toPass();
}

test('first draft save preserves history, selection and subsequent saves', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/admin/catalogue');
  await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
  await openCatalogueEffect(page, 'Peony');
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  const originalUrl = page.url();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page).not.toHaveURL(originalUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Peony copy');
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: 'Publish draft', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText(
    'published',
  );
  await expect(async () => {
    if (!/\/admin\/studio\/[\da-f-]+$/.test(page.url()))
      await page.getByRole('link', { name: 'Open in Studio', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/studio\/[\da-f-]+$/);
  }).toPass();
  await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
  await selectInspectorTab(page, 'Burst');
  const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
  const original = await name.inputValue();
  const status = page.locator('.sc-studio-toolbar').getByRole('status');
  await name.fill('First saved edit');
  await name.blur();
  await expect(status).toHaveText(/^(Unsaved|Saving\.\.\.)$/);
  await expect(status).toHaveText('Saved');
  await expect(name).toHaveValue('First saved edit');
  await expect(page.getByRole('tab', { name: 'Burst', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await name.fill('Second saved edit');
  await name.blur();
  await expect(status).toHaveText(/^(Unsaved|Saving\.\.\.)$/);
  await expect(status).toHaveText('Saved');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(name).toHaveValue('First saved edit');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(name).toHaveValue(original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(name).toHaveValue('First saved edit');
  await expect(status).toHaveText('Saved');
  await page.reload();
  await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
  await expect(name).toHaveValue('First saved edit');
  await expect(status).toHaveText('Saved');
});

for (const width of [1440, 1000, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`${width}px ${theme} Studio panels stay separate and selected-layer controls render`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      await openFromCatalogue(page);
      await pauseStage(page);
      const regions = ['.sc-studio-stage', '.sc-studio-layers', '.sc-studio-inspector'];
      await expect(async () => {
        const boxes = await Promise.all(
          regions.map((selector) => page.locator(selector).boundingBox()),
        );
        for (const box of boxes) {
          expect(box).not.toBeNull();
          expect(box?.width).toBeGreaterThan(0);
          expect(box?.height).toBeGreaterThan(0);
        }
        for (const [index, first] of boxes.entries()) {
          if (!first) throw new Error('Studio region has no bounds');
          for (const second of boxes.slice(index + 1)) {
            if (!second) throw new Error('Studio region has no bounds');
            const overlaps =
              first.x < second.x + second.width &&
              second.x < first.x + first.width &&
              first.y < second.y + second.height &&
              second.y < first.y + first.height;
            expect(overlaps).toBe(false);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (width >= 900) {
          expect(
            await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
          ).toBe(true);
          const body = page.locator('.sc-shell-editor-body');
          expect(
            await body.evaluate((element) => element.scrollHeight <= element.clientHeight),
          ).toBe(true);
        }
      }).toPass();
      const inspector = page.getByRole('region', { name: 'Inspector', exact: true });
      await expect(
        inspector.getByRole('textbox', { name: 'Star group name', exact: true }),
      ).not.toHaveValue('');
      await expect(inspector.getByRole('slider', { name: 'Size', exact: true })).toBeVisible();
      for (const [section, role, name] of [
        ['Launch', 'slider', 'Height'],
        ['Burst', 'slider', 'Flash strength'],
        ['Stars', 'slider', 'Size'],
        ['Trail', 'button', 'Trail on'],
        ['Effect', 'button', 'Twinkle'],
      ] as const) {
        await selectInspectorTab(page, section);
        await expect(inspector.getByRole(role, { name, exact: true })).toBeVisible();
      }
      await selectInspectorTab(page, 'Stars');
      const panelNavigation = page.getByRole('navigation', { name: 'Editor panels', exact: true });
      if (width < 900)
        await panelNavigation.getByRole('button', { name: 'Inspector', exact: true }).click();
      await expect(inspector.getByRole('slider', { name: 'Size', exact: true })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const label = `studio-layout-${width}-${theme}`;
      await info.attach(label, {
        body: await page.screenshot({ path: `output/playwright/${label}.png`, fullPage: false }),
        contentType: 'image/png',
      });
    });
  }
}
