/** Composer-run Library, variation and keyboard journeys with viewport/theme evidence. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { openCatalogueEffect } from './catalogue-helpers';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from './auth-helpers';

const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };
const STATIC_PREVIEW_OBSERVATION_FRAMES = 12; // Browser frames, spanning several 33 ms poster ticks.
async function openCopy(page: Page) {
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
  await expect(async () => {
    if (!page.url().includes('/studio/'))
      await page.getByRole('link', { name: 'Open in Studio', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/studio\/[\da-f-]+$/);
  }).toPass();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
}
async function tab(page: Page, name: string) {
  const trigger = page.getByRole('tab', { name, exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-selected', 'true');
  }).toPass();
}
async function section(page: Page, name: string) {
  const trigger = page
    .getByRole('group', { name: 'Library sections', exact: true })
    .getByRole('button', { name, exact: true });
  await expect(async () => {
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-pressed', 'true');
  }).toPass();
}
async function capture(page: Page, testInfo: TestInfo, label: string, selector: string) {
  await testInfo.attach(label, {
    body: await page.locator(selector).screenshot({ path: `output/playwright/${label}.png` }),
    contentType: 'image/png',
  });
}
async function saved(page: Page) {
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
}
async function checkReplace(page: Page) {
  const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
  const original = await name.inputValue();
  await page.getByLabel('Search library', { exact: true }).fill('Willow');
  const choice = page
    .getByRole('region', { name: 'Library', exact: true })
    .getByRole('button', { name: /^Willow\s*fireworks$/ });
  await choice.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(name).toHaveValue(original);
  await choice.click();
  await page.getByRole('button', { name: 'Replace firework', exact: true }).click();
  await expect(name).not.toHaveValue(original);
  await page.keyboard.press('Control+z');
  await expect(name).toHaveValue(original);
  await page.keyboard.press('Control+Shift+z');
  await expect(name).not.toHaveValue(original);
  await page.keyboard.press('Control+z');
  await expect(name).toHaveValue(original);
  await page.getByLabel('Search library', { exact: true }).fill('');
}
async function checkParts(page: Page) {
  await tab(page, 'Layers');
  const groups = page
    .getByRole('list', { name: 'Effect layers', exact: true })
    .getByRole('listitem');
  const originalCount = await groups.count();
  await tab(page, 'Library');
  await section(page, 'Star groups');
  await page.locator('.sc-studio-library-items button').first().click();
  await tab(page, 'Layers');
  await expect(groups).toHaveCount(originalCount + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(groups).toHaveCount(originalCount);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(groups).toHaveCount(originalCount + 1);
  await tab(page, 'Library');
  for (const label of ['Trails', 'Effects', 'Launch tails']) {
    await section(page, label);
    const choice = page.locator('.sc-studio-library-items button').first();
    await expect(choice).toBeEnabled();
    await choice.click();
  }
}
async function checkLocks(page: Page) {
  const first = page.locator('[data-variation="1"]');
  const second = page.locator('[data-variation="2"]');
  const lockedSeed = await first.getAttribute('data-seed');
  const originalSeed = await second.getAttribute('data-seed');
  await page.getByRole('button', { name: 'Lock variation 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lock variation 1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Roll again', exact: true }).click();
  await expect(first).toHaveAttribute('data-seed', lockedSeed ?? 'missing');
  await expect(second).not.toHaveAttribute('data-seed', originalSeed ?? 'missing');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const studio = page.locator('[data-studio]');
  const originalDesignSeed = await studio.getAttribute('data-design-seed');
  const appliedSeed = await second.getAttribute('data-seed');
  await page.getByRole('button', { name: 'Apply variation 2', exact: true }).click();
  await expect(undo).toBeEnabled();
  await expect(studio).toHaveAttribute('data-design-seed', appliedSeed ?? 'missing');
  await page.keyboard.press('Control+z');
  await expect(studio).toHaveAttribute('data-design-seed', originalDesignSeed ?? 'missing');
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.keyboard.press('Control+y');
  await expect(studio).toHaveAttribute('data-design-seed', appliedSeed ?? 'missing');
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
}
for (const [size, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} library copies, previews, locks and saved reload`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      await openCopy(page);
      await tab(page, 'Library');
      await checkReplace(page);
      await checkParts(page);
      await section(page, 'Trails');
      const choice = page.locator('.sc-studio-library-items button').first();
      await expect(async () => {
        await page.mouse.move(0, 0);
        await choice.hover();
        await expect(page.locator('.sc-studio-hover canvas')).toHaveAttribute('data-ready', 'true');
      }).toPass();
      await capture(page, testInfo, `library-${size}-${theme}-hover`, '.sc-studio-hover');
      await choice.focus();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await page.getByRole('button', { name: 'Save to library', exact: true }).click();
      const partName = `Saved ${size} ${theme} ${testInfo.retry}`;
      await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(partName);
      await page.getByRole('button', { name: 'Save part', exact: true }).click();
      await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Saved to library');
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      await section(page, 'Saved');
      await page.getByLabel('Search library', { exact: true }).fill(partName);
      await expect(page.locator('.sc-studio-library-items')).toContainText(partName);
      await capture(page, testInfo, `library-${size}-${theme}-saved`, '.sc-studio-layers');
      await tab(page, 'Layers');
      await tab(page, 'Library');
      await section(page, 'Saved');
      await page.getByLabel('Search library', { exact: true }).fill(partName);
      await expect(page.locator('.sc-studio-library-items')).toContainText(partName);
      await checkLocks(page);
      await saved(page);
      await page.reload();
      await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
      await saved(page);
      await tab(page, 'Library');
      await section(page, 'Saved');
      await page.getByLabel('Search library', { exact: true }).fill(partName);
      await expect(page.locator('.sc-studio-library-items')).toContainText(partName);
      await page.locator('.sc-studio-library-items button').first().click();
      await saved(page);
      for (const label of ['Launch', 'Burst', 'Stars', 'Trail', 'Effect']) {
        await tab(page, label);
        await capture(
          page,
          testInfo,
          `library-${size}-${theme}-inspector-${label}`,
          '.sc-studio-inspector',
        );
      }
      await expect(page.locator('[data-variation] canvas[data-ready="true"]')).toHaveCount(6);
      await capture(page, testInfo, `library-${size}-${theme}-variations`, '.sc-studio-variations');
      await tab(page, 'Layers');
      await capture(page, testInfo, `library-${size}-${theme}-layers`, '.sc-studio-layers');
      await capture(page, testInfo, `library-${size}-${theme}-stage`, '.sc-studio-stage');
      await capture(page, testInfo, `library-${size}-${theme}-full`, '.sc-shell');
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }).toPass();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
}
test('retailer is refused Studio library access', async ({ page }) => {
  await signInAs(page, 'owner');
  await page.goto('/admin/studio/40000000-0000-0000-0000-000000000001');
  await expect(page).not.toHaveURL(/\/admin\/studio/);
  await expect(page.getByRole('region', { name: 'Library', exact: true })).toHaveCount(0);
});
test('reduced motion preview is static and text editing keeps native undo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInAs(page, 'admin');
  await openCopy(page);
  await tab(page, 'Launch');
  const chip = page
    .getByRole('group', { name: 'Tail style', exact: true })
    .getByRole('button', { name: 'Silver', exact: true });
  const preview = page.locator('.sc-studio-hover canvas');
  await expect(async () => {
    await chip.blur();
    await chip.scrollIntoViewIfNeeded();
    await chip.focus();
    await expect(preview).toHaveAttribute('data-ready', 'true');
  }).toPass();
  // The accessible description must not mount another animated poster.
  await expect(page.getByRole('tooltip')).toHaveText('Silver. Preview in the current firework.');
  await expect(page.getByRole('tooltip').locator('canvas')).toHaveCount(0);
  await expect(page.locator('.sc-studio-hover canvas')).toHaveCount(1);
  const frames = await preview.evaluate(async (canvas: HTMLCanvasElement, observationFrames) => {
    const still = canvas.toDataURL();
    for (let frame = 0; frame < observationFrames; frame++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return [still, canvas.toDataURL()];
  }, STATIC_PREVIEW_OBSERVATION_FRAMES);
  expect(frames[1]).toBe(frames[0]);
  await page.keyboard.press('Escape');
  const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
  await name.fill('Native text history');
  await page.keyboard.press('Control+z');
  await name.blur();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
});
