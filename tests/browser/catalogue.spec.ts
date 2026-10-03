/** Authenticated catalogue journeys and composer-owned desktop/mobile visual captures. */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from './auth-helpers';

const routes = {
  Effects: '/admin/catalogue',
  Products: '/admin/products',
  Multishots: '/admin/multishots',
  Suppliers: '/admin/suppliers',
};
const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };

for (const [size, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} catalogue lists and detail sections`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      for (const [title, href] of Object.entries(routes)) {
        await page.goto(href);
        await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute(
          'data-hydrated',
          'true',
        );
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
        await expect(page.getByRole('table', { name: title, exact: true })).toBeVisible();
        await expect(async () => {
          await page.getByRole('button', { name: 'Name', exact: true }).click();
          await expect(
            page.getByRole('columnheader', { name: 'Name', exact: true }),
          ).toHaveAttribute('aria-sort', 'ascending');
        }).toPass();
        await page.getByLabel(`Search ${title.toLowerCase()}`).fill('No catalogue match exists');
        await expect(
          page.getByRole('status').filter({ hasText: /^0 of \d+ records$/ }),
        ).toBeVisible();
        await page.getByLabel(`Search ${title.toLowerCase()}`).fill('');
        await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
        await expect(page.getByText('Rendering preview...', { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await testInfo.attach(`${title}-${size}-${theme}`, {
          body: await page
            .locator('[data-catalogue-grid]')
            .screenshot({ path: `output/playwright/catalogue-${title}-${size}-${theme}.png` }),
          contentType: 'image/png',
        });
        if (title === 'Effects' || title === 'Products') {
          await page.getByRole('table').locator('tbody a').first().click();
          await expect(page.getByRole('region', { name: 'Versions', exact: true })).toBeVisible();
          const numbers = await page
            .locator('section[aria-label="Versions"] li b')
            .allTextContents();
          const values = numbers.map((text) => Number(text.replace('Version ', '')));
          expect(values).toEqual([...values].sort((a, b) => b - a));
          await expect(page.getByText('Rendering preview...', { exact: true })).toHaveCount(0);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          for (const section of ['Preview', 'Status', 'Used in', 'Versions']) {
            await testInfo.attach(`${title}-${section}-${size}-${theme}`, {
              body: await page.getByRole('region', { name: section, exact: true }).screenshot({
                path: `output/playwright/catalogue-${title}-${section.replaceAll(' ', '-')}-${size}-${theme}.png`,
              }),
              contentType: 'image/png',
            });
          }
        }
      }
    });
  }
}
for (const [title, href] of Object.entries(routes).filter(
  ([title]) => title === 'Effects' || title === 'Products',
)) {
  test(`${title} duplicate and confirmed archive preserve original`, async ({ page }) => {
    await signInAs(page, 'admin');
    await page.goto(href);
    await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
    await page.getByLabel('Status', { exact: true }).selectOption('published');
    if (title === 'Products')
      await page.getByLabel('Kind / market', { exact: true }).selectOption('single');
    const listUrl = page.url();
    await page.getByRole('table').locator('tbody a').first().click();
    // Read the source name only once the detail page has replaced the list heading.
    await expect(page).not.toHaveURL(listUrl);
    await expect(page.locator('[data-catalogue-controls]')).toBeVisible();
    const sourceUrl = page.url();
    const sourceName = await page.getByRole('heading', { level: 1 }).textContent();
    await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute(
      'data-hydrated',
      'true',
    );
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(page).not.toHaveURL(sourceUrl);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${sourceName} copy`);
    await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText('draft');
    await expect(async () => {
      await page.getByRole('button', { name: 'Archive', exact: true }).click();
      await expect(
        page.getByRole('dialog', { name: 'Archive this item?', exact: true }),
      ).toBeVisible();
    }).toPass();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText('draft');
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm archive', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Archived.');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText(
      'archived',
    );
    await expect(page.getByRole('region', { name: 'Versions', exact: true })).toContainText(
      'Version 1',
    );
    await page.goto(sourceUrl);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sourceName ?? '');
    await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText(
      'published',
    );
  });
}
test('non-admin is refused catalogue access', async ({ page }) => {
  await signInAs(page, 'owner');
  for (const href of [
    ...Object.values(routes),
    '/admin/catalogue/ffffffff-ffff-ffff-ffff-ffffffffffff',
    '/admin/products/ffffffff-ffff-ffff-ffff-ffffffffffff',
  ]) {
    await page.goto(href);
    await expect(page).toHaveURL('/access-denied');
  }
});

test('effect draft publication and dependency refusal use real RPC results', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/admin/catalogue');
  await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
  await page.getByLabel('Search effects').fill('Heart');
  await page.getByRole('table').getByRole('link', { name: 'Heart', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Used in', exact: true })).toContainText(
    'Heart Burst',
  );
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('published');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText(
    'published',
  );
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Heart copy');
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: 'Publish draft', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Status', exact: true })).toContainText(
    'published',
  );
  await expect(page.getByRole('region', { name: 'Versions', exact: true })).toContainText(
    'published',
  );
});
