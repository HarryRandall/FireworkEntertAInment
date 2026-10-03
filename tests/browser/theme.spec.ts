/** Theme preferences exercise the document class and the rendered semantic palette. */
import { expect, test, type Page } from '@playwright/test';

const PALETTES = {
  light: { background: 'rgb(255, 255, 255)', foreground: 'rgb(36, 36, 42)' },
  dark: { background: 'rgb(5, 5, 7)', foreground: 'rgb(247, 247, 248)' },
};
// Viewers use the prototype's cinematic backdrop regardless of the page theme.
const STAGE_BACKGROUND = 'rgb(5, 7, 13)';
const ROUTES = ['/', '/dev', '/dev/fireworks'];

async function expectPalette(page: Page, theme: 'light' | 'dark') {
  const root = page.locator('html');
  await expect(root).toHaveClass(theme);
  await expect(root).toHaveCSS('color-scheme', theme);
  await expect(page.locator('body')).toHaveCSS('background-color', PALETTES[theme].background);
  await expect(page.locator('body')).toHaveCSS('color', PALETTES[theme].foreground);
}

for (const preference of ['light', 'dark'] as const) {
  test(`stored ${preference} preference survives navigation, reload and system changes`, async ({
    page,
  }) => {
    const opposite = preference === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: opposite });
    await page.addInitScript((theme) => {
      if (sessionStorage.getItem('theme-test-initialised') !== null) return;
      localStorage.setItem('theme', theme);
      sessionStorage.setItem('theme-test-initialised', 'true');
    }, preference);
    for (const route of ROUTES) {
      await page.goto(route);
      await expectPalette(page, preference);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await expect(page.getByTestId('stage')).toHaveCSS('background-color', STAGE_BACKGROUND);
    await page.emulateMedia({ colorScheme: preference });
    await expectPalette(page, preference);
    await page.emulateMedia({ colorScheme: opposite });
    await expectPalette(page, preference);
    await page.reload();
    await expectPalette(page, preference);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(preference);
  });
}

for (const preference of ['default', 'system'] as const) {
  test(`${preference} preference follows live system changes`, async ({ page }) => {
    await page.addInitScript((theme) => {
      if (sessionStorage.getItem('theme-test-initialised') !== null) return;
      sessionStorage.setItem('theme-test-initialised', 'true');
      if (theme === 'default') localStorage.removeItem('theme');
      else localStorage.setItem('theme', theme);
    }, preference);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expectPalette(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectPalette(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectPalette(page, 'light');
    await page.reload();
    await expectPalette(page, 'light');
  });
}
