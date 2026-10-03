/** Composer-run paired playback, local video, checks and responsive Studio evidence. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from './auth-helpers';
import { openCatalogueEffect } from './catalogue-helpers';

const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };
const clipPath = 'tests/browser/fixtures/reference-clock.webm';
async function openCopy(page: Page, publish: boolean) {
  await page.goto('/admin/catalogue');
  await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
  await openCatalogueEffect(page, 'Peony');
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  const original = page.url();
  await expect(async () => {
    if (page.url() === original)
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(page).not.toHaveURL(original);
  }).toPass();
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  const catalogueUrl = page.url();
  if (publish) {
    await expect(async () => {
      const button = page.getByRole('button', { name: 'Publish draft', exact: true });
      if (await button.isVisible()) await button.click();
      await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText(
        'published',
      );
    }).toPass();
  }
  await expect(async () => {
    if (!page.url().includes('/studio/'))
      await page.getByRole('link', { name: 'Open in Studio', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/studio\/[\da-f-]+$/);
  }).toPass();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
  return catalogueUrl;
}
async function mode(page: Page, name: string) {
  const button = page
    .getByRole('group', { name: 'Stage mode' })
    .getByRole('button', { name, exact: true });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }).toPass();
}
async function tab(page: Page, name: string) {
  const trigger = page.getByRole('tab', { name, exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-selected', 'true');
  }).toPass();
}
async function seek(page: Page, timeS: number) {
  const stage = page.getByRole('region', { name: 'Stage', exact: true });
  await stage.scrollIntoViewIfNeeded();
  const pause = stage.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible()) await pause.click();
  const slider = page.getByRole('slider', { name: 'Preview time', exact: true });
  await slider.evaluate((element: HTMLInputElement, time) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      element,
      String(time),
    );
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, timeS);
  await expect(slider).toHaveValue(String(timeS));
  const canvases = stage.locator('canvas');
  for (const canvas of await canvases.all()) {
    await expect(canvas).toHaveAttribute('data-draw-pending', 'false');
    await expect(canvas).toHaveAttribute('data-drawn-time', timeS.toFixed(6));
  }
}
async function capture(page: Page, info: TestInfo, label: string, selector: string) {
  await info.attach(label, {
    body: await page.locator(selector).screenshot({ path: `output/playwright/${label}.png` }),
    contentType: 'image/png',
  });
}
async function saved(page: Page) {
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
}
for (const [size, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} Compare and Reference share the scrubber and retain saved history`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      await openCopy(page, true);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
      const original = await name.inputValue();
      await name.fill('Compare draft edit');
      await name.blur();
      await saved(page);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(name).toHaveValue(original);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect(name).toHaveValue('Compare draft edit');
      await mode(page, 'Compare');
      await expect(page.locator('[data-preview="published"]')).toContainText('Published · v1');
      await expect(page.locator('.sc-studio-stage canvas')).toHaveCount(2);
      await seek(page, 1);
      await seek(page, 2);
      await capture(page, info, `compare-${size}-${theme}`, '.sc-studio-stage');
      await mode(page, 'Reference');
      await expect(page.locator('.sc-studio-stage canvas')).toHaveCount(1);
      await page.getByLabel('Reference video clip', { exact: true }).setInputFiles(clipPath);
      const video = page.getByLabel('Reference clip', { exact: true });
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
        .toBeGreaterThanOrEqual(2);
      await seek(page, 1);
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
        .toBeCloseTo(1, 1);
      await seek(page, 2);
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
        .toBeCloseTo(2, 1);
      await page
        .getByRole('region', { name: 'Stage', exact: true })
        .getByRole('button', { name: 'Play', exact: true })
        .click();
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
        .toBeGreaterThan(2);
      await seek(page, 1);
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
        .toBe(true);
      await capture(page, info, `reference-${size}-${theme}`, '.sc-studio-stage');
      const oldUrl = await video.getAttribute('src');
      await mode(page, 'Design');
      expect(
        await page.evaluate(async (url) => {
          try {
            await fetch(url ?? '');
            return false;
          } catch {
            return true;
          }
        }, oldUrl),
      ).toBe(true);
      await page.getByRole('button', { name: 'Checks', exact: true }).click();
      await expect(page.locator('[data-particle-check]')).toHaveAttribute(
        'data-particle-check',
        'passed',
      );
      await capture(page, info, `checks-${size}-${theme}`, '.sc-studio-checks');
      await page.getByRole('button', { name: 'Close checks', exact: true }).click();
      await capture(page, info, `compare-layers-${size}-${theme}`, '.sc-studio-layers');
      for (const label of ['Launch', 'Burst', 'Stars', 'Trail', 'Effect']) {
        await tab(page, label);
        await capture(
          page,
          info,
          `compare-inspector-${label}-${size}-${theme}`,
          '.sc-studio-inspector',
        );
      }
      await saved(page);
      await page.reload();
      await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
      await saved(page);
      await expect(name).toHaveValue('Compare draft edit');
      await mode(page, 'Compare');
      await seek(page, 1);
      await expect(page.locator('[data-preview="published"]')).toContainText('Published · v1');
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }).toPass();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await capture(page, info, `compare-full-${size}-${theme}`, '.sc-shell');
    });
  }
}
test('unpublished comparison is empty and a stored over-budget draft cannot publish', async ({
  page,
}) => {
  await signInAs(page, 'admin');
  const catalogueUrl = await openCopy(page, false);
  await mode(page, 'Compare');
  await expect(page.getByText('No published version yet.')).toBeVisible();
  await tab(page, 'Stars');
  await page.getByRole('slider', { name: 'Count', exact: true }).press('End');
  await tab(page, 'Trail');
  const on = page.getByRole('button', { name: 'Trail on', exact: true });
  if ((await on.getAttribute('aria-pressed')) === 'false') await on.click();
  await page.getByRole('slider', { name: 'Length', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Density', exact: true }).press('End');
  await saved(page);
  await page.getByRole('button', { name: 'Checks', exact: true }).click();
  await expect(page.locator('[data-particle-check]')).toHaveAttribute(
    'data-particle-check',
    'blocked',
  );
  await page.goto(catalogueUrl);
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  await expect(async () => {
    await page.getByRole('button', { name: 'Publish draft', exact: true }).click();
    await expect(page.locator('[data-catalogue-controls]')).toContainText(
      'Publishing blocked: over the particle budget',
    );
  }).toPass();
  await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText('draft');
});
test('a non-admin is refused access to comparison and references', async ({ page }) => {
  await signInAs(page, 'owner');
  await page.goto('/admin/studio/40000000-0000-0000-0000-000000000001');
  await expect(page).not.toHaveURL(/\/admin\/studio/);
  await expect(page.getByRole('group', { name: 'Stage mode' })).toHaveCount(0);
});
