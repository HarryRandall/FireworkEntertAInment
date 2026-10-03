/** Local shopper QR journeys, responsive accessibility and owner review captures. */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'http://127.0.0.1:55421';
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 1000 } };

test.beforeAll(() => {
  const env = readFileSync('apps/web/.env.local', 'utf8');
  if (
    !env.includes(`NEXT_PUBLIC_SUPABASE_URL=${API}`) &&
    !env.includes(`NEXT_PUBLIC_SUPABASE_URL="${API}"`)
  )
    throw new Error('Shopper journeys require local Supabase');
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_showcrafter',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: readFileSync('tests/browser/shopper-fixtures.sql'), stdio: ['pipe', 'pipe', 'pipe'] },
  );
});

for (const target of [
  { code: 'hartley-leeds', route: /\/shopper\/stores\/leeds\?qr=/, heading: 'Hartley Fireworks' },
  { code: 'hartley-york', route: /\/shopper\/stores\/york\/plan\?qr=/, heading: 'Plan your show' },
  {
    code: 'hartley-family',
    route: /\/shopper\/stores\/leeds\/shows\//,
    heading: 'Family Garden Show',
  },
  { code: 'hartley-garden', route: /\?collection=.*#collections$/, heading: 'Hartley Fireworks' },
  {
    code: 'browser-product',
    route: /\/shopper\/stores\/leeds\/products\//,
    heading: 'Heart Burst',
  },
  {
    code: 'browser-pack',
    route: /\/shopper\/stores\/leeds\/products\//,
    heading: 'Garden selection pack',
  },
]) {
  test(`QR ${target.code} redirects to its public target and establishes a session`, async ({
    page,
  }) => {
    await page.goto(`/q/${target.code}`);
    await expect(page).toHaveURL(target.route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(target.heading);
    expect(
      (await page.context().cookies()).some((cookie) => /sb-.*-auth-token/.test(cookie.name)),
    ).toBe(true);
  });
}

test('unknown and retired codes offer honest recovery, organisation codes offer store choices', async ({
  page,
}) => {
  await page.goto('/q/browser-unknown');
  await expect(page.getByRole('heading', { name: 'This code is unavailable' })).toBeVisible();
  await expect(page.getByText('We could not find this code.', { exact: false })).toBeVisible();
  await page.goto('/q/browser-retired');
  await page.getByRole('link', { name: 'Browse this shop' }).click();
  await expect(page).toHaveURL(/\/shopper\/stores\/leeds$/);
  await page.goto('/q/browser-organisation');
  await expect(page.getByRole('heading', { name: 'Choose your shop' })).toBeVisible();
  await page.getByRole('link', { name: 'York, Clifton Moor' }).click();
  await expect(page).toHaveURL(/\/shopper\/stores\/york\/products\//);
});

for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['store', 'product', 'show'] as const) {
      test(`${surface} at ${viewportName} in ${theme} has accessible sections and no page overflow`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.addInitScript((value) => {
          localStorage.setItem('theme', value);
        }, theme);
        const code =
          surface === 'store'
            ? 'hartley-leeds'
            : surface === 'product'
              ? 'browser-product'
              : 'hartley-family';
        await page.goto(`/q/${code}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
        await expect(page.getByText('Preparing 3D poster', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Poster unavailable', { exact: true })).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        const sections = page.locator('[data-section]');
        for (const section of await sections.all()) {
          const name = await section.getAttribute('data-section');
          const screenshot = await section.screenshot({
            path: `output/playwright/shopper-${surface}-${viewportName}-${theme}-${name}.png`,
          });
          await testInfo.attach(`${surface}-${viewportName}-${theme}-${name}`, {
            body: screenshot,
            contentType: 'image/png',
          });
        }
      });
    }
  }
}

test('product actions retain context and transport supports keyboard seek and playback', async ({
  page,
}) => {
  await page.goto('/q/browser-product');
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeEnabled();
  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const seek = page.getByRole('slider', { name: 'Show time' });
  await seek.focus();
  await page.keyboard.press('Home');
  await expect.poll(async () => Number(await seek.inputValue())).toBe(0);
  await page.keyboard.down('ArrowRight');
  await expect(seek).toBeFocused();
  await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(0);
  await page.keyboard.up('ArrowRight');
  const productUrl = new URL(page.url());
  const productId = productUrl.pathname.split('/').at(-1);
  await page.getByRole('link', { name: 'Plan a show around this' }).click();
  await expect(page).toHaveURL(new RegExp(`/plan\\?product=${productId}$`));
  await expect(page.getByText('No plan or list has been saved.', { exact: false })).toBeVisible();
  await page.goto(productUrl.toString());
  await page.getByRole('link', { name: 'Add to my list' }).click();
  await expect(page).toHaveURL(new RegExp(`/list\\?product=${productId}$`));
});

test('missing store and malformed product identifiers show a friendly unavailable page', async ({
  page,
}) => {
  for (const route of ['/shopper/stores/missing', '/shopper/stores/leeds/products/not-a-uuid']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'This page is unavailable' })).toBeVisible();
  }
});

test('empty shop range remains distinct from an unavailable store', async ({ page }) => {
  await page.goto('/shopper/stores/other-store');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Other Demo Shop');
  await expect(page.getByText('No fireworks here yet', { exact: true })).toBeVisible();
  await expect(page.getByText('No shows available yet', { exact: true })).toBeVisible();
});

test('unavailable WebGL leaves product facts and actions usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, contextId: string, options?: unknown) {
        if (contextId.startsWith('webgl')) return null;
        return original.call(this, contextId, options);
      },
    });
  });
  await page.goto('/q/browser-product');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'The 3D preview could not load',
  );
  await expect(page.getByRole('heading', { name: 'Heart Burst' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Plan a show around this' })).toBeVisible();
});
