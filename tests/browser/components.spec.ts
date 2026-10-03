/** Component-gallery journeys and owner review captures, using synthetic local state. */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };

for (const [name, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${name} ${theme} component gallery and reduced motion`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/dev/components');
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Component gallery');
      const products = page.getByRole('group', { name: 'Products', exact: true });
      await expect(products.locator('img')).toHaveCount(4);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const animation = await page
        .locator('.sc-marquee-track')
        .evaluate((element) => getComputedStyle(element).animationName);
      expect(animation).toBe('none');
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
      // The whole gallery exceeds Chromium's capture height, so review one section at a time.
      const sections = page.locator('section[id]:has(> h2)');
      for (const id of await sections.evaluateAll((items) => items.map((item) => item.id))) {
        const screenshot = await page.locator(`section#${id}`).screenshot({
          path: `output/playwright/components-${name}-${theme}-${id}.png`,
        });
        await testInfo.attach(`components-${name}-${theme}-${id}`, {
          body: screenshot,
          contentType: 'image/png',
        });
      }
    });
  }
}

// Radix moves arrow-key focus on a zero-delay timer and selects only while the key is
// held; hold arrows as briefly as a person would rather than for Playwright's ~0 ms.
const ARROW_HOLD_MS = 30;

test('keyboard choices, tags, quantities, uploads and dialog focus', async ({ page }) => {
  await page.goto('/dev/components');
  const card = page.getByRole('radio', { name: /Start with a best-seller range/ });
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('ArrowRight', { delay: ARROW_HOLD_MS });
  await expect(page.getByRole('radio', { name: /Import your stock list/ })).toBeChecked();
  const imported = page.getByRole('radio', { name: /Import your stock list/ });
  await expect(imported).toBeFocused();
  // Arrows wrap past the disabled card and select in either direction.
  await page.keyboard.press('ArrowRight', { delay: ARROW_HOLD_MS });
  await expect(card).toBeChecked();
  await expect(card).toBeFocused();
  await page.keyboard.press('ArrowLeft', { delay: ARROW_HOLD_MS });
  await expect(imported).toBeChecked();
  await expect(imported).toBeFocused();
  const swatches = page.getByRole('radiogroup', { name: 'Brand colour' });
  const green = swatches.getByRole('radio', { name: 'Green', exact: true });
  await green.focus();
  await expect(green).toBeFocused();
  await page.keyboard.press('ArrowRight', { delay: ARROW_HOLD_MS });
  await expect(swatches.getByRole('radio', { name: 'Blue', exact: true })).toBeChecked();
  const tags = page.getByRole('textbox', { name: 'Add invitation emails' });
  await tags.fill('new@showcrafter.test');
  await tags.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove new@showcrafter.test' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove not-an-email' }).click();
  await expect(tags).toHaveAttribute('aria-invalid', 'false');
  const quantity = page.getByRole('group', { name: 'copies per store', exact: true });
  await quantity.getByRole('button', { name: 'Decrease copies per store' }).click();
  await expect(quantity.locator('output')).toHaveText('1');
  await expect(quantity.getByRole('button', { name: 'Decrease copies per store' })).toBeDisabled();
  await page.getByLabel('Drop your stock list', { exact: true }).setInputFiles({
    name: 'stock.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,quantity\nPeony,2'),
  });
  await expect(page.getByRole('button', { name: 'Remove stock.csv' })).toBeVisible();
  await page
    .getByLabel('Drop your stock list', { exact: true })
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByText('Choose a supported file type.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove stock.csv' })).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Open dialog' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Rename show' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('curve and gradient number rows retain pinned endpoints and ordered stops', async ({
  page,
}) => {
  await page.goto('/dev/components');
  const key = page.getByRole('spinbutton', { name: 'Brightness over life key 2 value' });
  await key.fill('0.4');
  await expect(key).toHaveValue('0.4');
  await expect(
    page.getByRole('spinbutton', { name: 'Brightness over life key 1 time' }),
  ).toBeDisabled();
  const colourTime = page.getByRole('spinbutton', { name: 'Colour over life stop 2 time' });
  await colourTime.fill('0.3');
  await expect(colourTime).toHaveValue('0.3');
  const handle = page.getByRole('button', { name: 'Colour over life stop 2', exact: true });
  const bounds = await handle.boundingBox();
  if (bounds === null) throw new Error('Gradient handle is missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 30, bounds.y + bounds.height / 2);
  await page.mouse.up();
  expect(Number(await colourTime.inputValue())).toBeGreaterThan(0.3);
});
