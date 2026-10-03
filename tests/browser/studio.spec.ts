/** Authenticated Studio journeys and composer-owned viewport/theme screenshots. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from './auth-helpers';

const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };

async function openFromCatalogue(page: Page, search = 'Peony') {
  await page.goto('/admin/catalogue');
  await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
  await page.getByLabel('Search effects').fill(search);
  await page.getByRole('table').locator('tbody a').first().click();
  await page.getByRole('link', { name: 'Open in Studio', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/studio\/[\da-f-]+$/);
  await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.locator('[data-studio]')).toBeVisible();
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
      for (const tab of ['Launch', 'Burst', 'Stars', 'Trail', 'Effect']) {
        await expect(async () => {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
            'aria-selected',
            'true',
          );
        }).toPass();
        await expect(page.getByRole('tabpanel')).toContainText(`${tab} settings`);
        await capture(
          page,
          testInfo,
          `studio-${size}-${theme}-inspector-${tab}`,
          '.sc-studio-inspector',
        );
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
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
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Ground', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
  await name.fill(original);
  await name.blur();
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
});
