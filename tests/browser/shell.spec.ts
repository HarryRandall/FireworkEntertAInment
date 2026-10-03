/** Workspace navigation, keyboard panels and composer-owned visual review captures. */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { areaConfigs } from '../../apps/web/ui/shell/config';
import { currentItem } from '../../apps/web/ui/shell/navigation';

const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };

/** Waits for installed client handlers before exercising server-rendered controls. */
async function openWorkspace(page: Page, href: string) {
  await page.goto(href);
  await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
}

/** Asserts that only the local tab content changes and the route remains in its area. */
async function checkTabs(page: Page) {
  const url = page.url();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tabpanel')).toHaveText('No activity has been loaded.');
  expect(page.url()).toBe(url);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
}

for (const config of Object.values(areaConfigs)) {
  test(`${config.area} rail, destinations and shortcuts stay in their area`, async ({ page }) => {
    await openWorkspace(page, config.href);
    for (const section of config.sections) {
      await page
        .getByRole('navigation', { name: 'Workspace sections', exact: true })
        .getByRole('link', { name: section.label, exact: true })
        .click();
      await expect(page).toHaveURL(section.items[0].href);
      for (const item of section.items) {
        await page
          .getByRole('navigation', { name: 'Section pages', exact: true })
          .getByRole('link', { name: item.label, exact: true })
          .click();
        await expect(page).toHaveURL(item.href);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.label);
        await checkTabs(page);
      }
      for (const item of section.shortcuts) {
        await page
          .getByRole('navigation', { name: 'Sidebar shortcuts', exact: true })
          .getByRole('link', { name: item.label, exact: true })
          .click();
        await expect(page).toHaveURL(item.href);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          currentItem(config, item.href)?.label ?? item.label,
        );
        expect(new URL(page.url()).pathname.startsWith(config.href + '/')).toBe(true);
        // Shortcuts may open another section; return before testing the next shortcut.
        await openWorkspace(page, section.items[0].href);
      }
    }
  });
}

for (const [name, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${name} ${theme} shell areas, editor and panel captures`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await openWorkspace(page, '/dev/shell');
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      for (const config of Object.values(areaConfigs)) {
        await page.getByLabel('Review area', { exact: true }).selectOption(config.area);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${config.label} shell`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        for (const section of ['.sc-shell-rail', '.sc-shell-header', '.sc-shell-main']) {
          const capture = await page.locator(section).screenshot({
            path: `output/playwright/shell-${config.area}-${name}-${theme}-${section.slice(1)}.png`,
          });
          await testInfo.attach(`${config.area}-${section}`, {
            body: capture,
            contentType: 'image/png',
          });
        }
        if (name === 'desktop') {
          const capture = await page.locator('.sc-shell-sidebar').screenshot({
            path: `output/playwright/shell-${config.area}-${name}-${theme}-sidebar.png`,
          });
          await testInfo.attach(`${config.area}-sidebar`, {
            body: capture,
            contentType: 'image/png',
          });
        } else {
          await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
          await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(
            page.getByRole('button', { name: 'Open navigation', exact: true }),
          ).toBeFocused();
        }
      }
      await page.getByRole('button', { name: 'Editor frame', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor frame');
      await expect(page.locator('.sc-shell-sidebar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /back/i })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Editor stage', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('No data was written.');
      await page.getByRole('button', { name: 'Editor actions', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Inspect frame', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Editor frame inspected.');
      const frame = await page
        .locator('.sc-shell-editor')
        .screenshot({ path: `output/playwright/shell-editor-${name}-${theme}.png` });
      await testInfo.attach(`editor-${name}-${theme}`, { body: frame, contentType: 'image/png' });
      for (const key of ['Control+k', '?']) {
        await page.getByRole('heading', { level: 1 }).click();
        await page.keyboard.press(key);
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        const capture = await dialog.screenshot({
          path: `output/playwright/shell-${key === '?' ? 'shortcuts' : 'command'}-${name}-${theme}.png`,
        });
        await testInfo.attach(key, { body: capture, contentType: 'image/png' });
        await page.keyboard.press('Escape');
      }
      for (const panel of [
        { button: 'Notifications', title: 'Notifications inbox' },
        { button: 'Profile menu', title: 'Profile menu' },
      ]) {
        if (name === 'phone')
          await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await page.getByRole('button', { name: panel.button, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: panel.title, exact: true });
        await expect(dialog).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        const capture = await dialog.screenshot({
          path: `output/playwright/shell-${panel.button.toLowerCase().replaceAll(' ', '-')}-${name}-${theme}.png`,
        });
        await testInfo.attach(panel.title, { body: capture, contentType: 'image/png' });
        await page.keyboard.press('Escape');
      }
    });
  }
}

test('retailer organisation, store and area menus select their context', async ({ page }) => {
  await openWorkspace(page, '/dev/shell');
  await page.getByRole('button', { name: 'Switch store', exact: true }).click();
  await page.getByRole('menuitem', { name: 'York, Clifton Moor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Switch store', exact: true })).toHaveText(
    'York, Clifton Moor',
  );
  await page.getByRole('button', { name: 'Switch organisation', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Demo Fireworks', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Switch store', exact: true })).toHaveText(
    'Demo shop',
  );
  for (const config of Object.values(areaConfigs)) {
    await page.getByRole('button', { name: 'Switch area', exact: true }).click();
    await page.getByRole('menuitem', { name: config.label, exact: true }).click();
    await expect(page).toHaveURL(config.href);
  }
});

test('command selection, empty search, help focus, inbox read state and profile theme', async ({
  page,
}) => {
  await openWorkspace(page, '/dev/shell');
  const trigger = page.getByRole('button', { name: 'Search workspace', exact: true });
  await trigger.focus();
  await page.keyboard.press('Meta+k');
  const search = page.getByRole('combobox', { name: 'Search destinations', exact: true });
  await expect(search).toBeFocused();
  await search.fill('nothing-matches-this');
  await expect(page.getByText('No matching destinations.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await page.getByRole('button', { name: 'Mark Shell review ready as read', exact: true }).click();
  await expect(page.getByText('Unread', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.getByText('Read', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Profile menu', exact: true }).click();
  await page.getByRole('button', { name: 'dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await search.fill('Shelf labels');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/retailer/labels');
});

test('visibility predicates hide areas and destinations from every shell surface', async ({
  page,
}) => {
  await openWorkspace(page, '/dev/shell');
  await page.getByLabel('Restrict preview navigation', { exact: true }).check();
  await expect(
    page.getByRole('navigation', { name: 'Workspace sections', exact: true }).getByRole('link'),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Switch area', exact: true }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('option')).toHaveCount(1);
});
