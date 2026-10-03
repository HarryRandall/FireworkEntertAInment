/** Component-gallery journeys and owner review captures, using synthetic local state. */
import { expect, test, type Locator, type Page } from '@playwright/test';
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
      const gridScroll = page.getByRole('region', { name: 'Synthetic scan records table' });
      await expect(gridScroll).toHaveAttribute('tabindex', '0');
      if (name === 'phone') {
        await gridScroll.focus();
        expect(
          await gridScroll.evaluate((element) => element.scrollWidth > element.clientWidth),
        ).toBe(true);
        await page.keyboard.press('ArrowRight', { delay: ARROW_HOLD_MS });
        await expect
          .poll(() => gridScroll.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }
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
// held; hold other arrows as briefly as a person would rather than for Playwright's ~0 ms.
const ARROW_HOLD_MS = 30;

/** Holds an arrow key until Radix's deferred focus reaches the target, like a held key. */
async function holdArrowUntilFocused(page: Page, key: string, target: Locator) {
  await page.keyboard.down(key);
  await expect(target).toBeFocused();
  await page.keyboard.up(key);
}

test('keyboard choices, tags, quantities, uploads and dialog focus', async ({ page }) => {
  await page.goto('/dev/components');
  const card = page.getByRole('radio', { name: /Start with a best-seller range/ });
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute('tabindex', '0');
  const imported = page.getByRole('radio', { name: /Import your stock list/ });
  await holdArrowUntilFocused(page, 'ArrowRight', imported);
  await expect(imported).toBeChecked();
  // Arrows wrap past the disabled card and select in either direction.
  await holdArrowUntilFocused(page, 'ArrowRight', card);
  await expect(card).toBeChecked();
  await holdArrowUntilFocused(page, 'ArrowLeft', imported);
  await expect(imported).toBeChecked();
  await expect(imported).toBeFocused();
  const swatches = page.getByRole('radiogroup', { name: 'Brand colour' });
  const green = swatches.getByRole('radio', { name: 'Green', exact: true });
  await green.focus();
  await expect(green).toBeFocused();
  const blue = swatches.getByRole('radio', { name: 'Blue', exact: true });
  await holdArrowUntilFocused(page, 'ArrowRight', blue);
  await expect(blue).toBeChecked();
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

test('grid sorting, column visibility, selection, actions and pagination work with the keyboard', async ({
  page,
}) => {
  await page.goto('/dev/components');
  const grid = page.locator('#scan-grid');
  const scans = grid.getByRole('button', { name: 'Scans', exact: true });
  await scans.focus();
  await page.keyboard.press('Enter');
  await expect(grid.getByRole('columnheader', { name: 'Scans', exact: true })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await page.keyboard.press('Enter');
  await expect(grid.getByRole('columnheader', { name: 'Scans', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await grid.getByRole('button', { name: 'Store', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(grid.getByRole('columnheader', { name: 'Store', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  const selection = grid.getByRole('checkbox', { name: 'Select page rows' });
  await selection.focus();
  await page.keyboard.press('Space');
  await expect(selection).toBeChecked();
  await expect(grid.locator('[data-slot="data-grid-pagination"] [role="status"]')).toContainText(
    '5 selected',
  );
  await grid.getByRole('button', { name: 'Next page' }).click();
  await expect(grid.locator('[data-slot="data-grid-pagination"] [role="status"]')).toContainText(
    '6 to 10',
  );
  await expect(selection).not.toBeChecked();
  await grid.getByRole('button', { name: 'Previous page' }).click();
  await expect(selection).toBeChecked();
  await grid.getByRole('button', { name: 'Columns', exact: true }).click();
  const store = page.getByRole('menuitemcheckbox', { name: 'Store', exact: true });
  await store.focus();
  await page.keyboard.press('Space');
  await expect(store).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(grid.getByRole('columnheader', { name: 'Store', exact: true })).toHaveCount(0);
  await grid
    .getByRole('button', { name: /Actions for/ })
    .first()
    .click();
  await page.keyboard.press('ArrowDown', { delay: ARROW_HOLD_MS });
  await page.getByRole('menuitem', { name: 'Inspect record' }).click();
  await expect(grid.getByRole('status').last()).toContainText('scans on');
});

test('breakdown tabs add filter chips, custom ranges validate and CSV exports filtered records', async ({
  page,
}) => {
  await page.goto('/dev/components');
  const breakdown = page.getByRole('region', { name: 'Where scans happen' });
  await breakdown.getByRole('tab', { name: 'Placement', exact: true }).focus();
  await page.keyboard.press('ArrowRight', { delay: ARROW_HOLD_MS });
  await expect(breakdown.getByRole('tab', { name: 'Store', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await breakdown.getByRole('button', { name: /North shop/ }).click();
  const filters = page.locator('#dashboard-filters');
  await expect(filters.getByRole('button', { name: 'Remove Store: North shop' })).toBeVisible();
  const grid = page.locator('#scan-grid');
  await expect(grid.getByRole('cell', { name: 'South shop', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await filters.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('synthetic-scans.csv');
  const stream = await download.createReadStream();
  if (stream === null) throw new Error('CSV download unavailable');
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('North shop');
  expect(csv).not.toContain('South shop');
  await filters.getByRole('button', { name: 'Share', exact: true }).click();
  const link = await filters.getByLabel('Share this local view').inputValue();
  await page.goto(link);
  await expect(filters.getByRole('button', { name: 'Remove Store: North shop' })).toBeVisible();
  await filters.getByRole('button', { name: 'Remove Store: North shop' }).click();
  await filters.getByRole('button', { name: 'Custom range', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Custom date range' });
  await dialog.getByLabel('From', { exact: true }).fill('2026-11-10');
  await dialog.getByLabel('To', { exact: true }).fill('2026-11-09');
  await dialog.getByRole('button', { name: 'Apply date range' }).click();
  await expect(dialog.getByRole('status')).toContainText('end on or after');
  await dialog.getByLabel('From', { exact: true }).fill('2027-01-01');
  await dialog.getByLabel('To', { exact: true }).fill('2027-01-02');
  await dialog.getByRole('button', { name: 'Apply date range' }).click();
  await page.keyboard.press('Escape');
  await expect(grid.getByRole('cell', { name: 'No matching records.' })).toBeVisible();
  await expect(page.getByText('No chart data in this range.')).toBeVisible();
});

test('chart measurements are readable without hover and comparison can be toggled', async ({
  page,
}) => {
  await page.goto('/dev/components');
  const charts = page.locator('#season-charts');
  const summary = charts.getByText('View scans data', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(charts.getByRole('table', { name: 'Scans measurements' })).toBeVisible();
  const measurements = charts.getByRole('region', { name: 'Scans measurements', exact: true });
  await expect(measurements).toHaveAttribute('tabindex', '0');
  await measurements.focus();
  await page.keyboard.press('ArrowDown', { delay: ARROW_HOLD_MS });
  await expect.poll(() => measurements.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(charts.getByRole('rowheader', { name: /Last season:/ }).first()).toBeVisible();
  await page
    .locator('#dashboard-filters')
    .getByRole('button', { name: 'Compare', exact: true })
    .click();
  await expect(charts.getByRole('rowheader', { name: /Last season:/ })).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include('#dashboard')
    .include('#data-grid')
    .include('#charts')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('grid pending and failed reads remain distinct from empty results', async ({ page }) => {
  await page.goto('/dev/components');
  const feedback = page.locator('#grid-feedback');
  await expect(feedback.getByRole('status')).toHaveText('Loading grid feedback preview...');
  await feedback.getByRole('button', { name: 'Show failed grid' }).click();
  await expect(feedback.getByRole('alert')).toHaveText('The synthetic preview could not load.');
  await feedback.getByRole('button', { name: 'Retry grid feedback preview' }).click();
  await expect(feedback.getByRole('table', { name: 'Grid feedback preview' })).toBeVisible();
});
