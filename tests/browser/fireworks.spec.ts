/** Browser journeys and representative review stills exercise the rendered WebGL surface. */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Desktop and owner-requested narrow viewport, in CSS pixels.
const DESKTOP = { width: 1440, height: 1000 },
  MOBILE = { width: 390, height: 844 };
// The catalogue owns 99 converted templates plus three hand-authored fixtures.
const REVIEW_CARD_COUNT = 102;
// Representative aerial, dense trail, modifier, ground and sequential designs.
const REPRESENTATIVES = [
  'peony',
  'willow',
  'crackle',
  'fountain',
  'wheel',
  'romanCandle',
  'multiBreak',
];
// Fixed times, in seconds, allow exact seek replay rather than wall-clock screenshots.
const REVIEW_TIME_S = 2.2;
const OTHER_TIME_S = 0.5;

/** Sets a range through its native input boundary so React observes the authored seconds. */
async function seek(page: Page, time_s: number): Promise<void> {
  await page.getByRole('slider', { name: 'Preview time' }).evaluate((element, time) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, String(time));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, time_s);
}

test('all templates share one context and selected playback supports exact scrubbing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(page.locator('[data-template]')).toHaveCount(REVIEW_CARD_COUNT);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('[data-template] img')).toHaveCount(REVIEW_CARD_COUNT);
  await page.locator('[data-template="wheel"]').click();
  await expect(page.getByTestId('selected-name')).toHaveText('Wheel');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const time = page.getByRole('slider', { name: 'Preview time' });
  await seek(page, REVIEW_TIME_S);
  await expect(time).toHaveValue(String(REVIEW_TIME_S));
  await expect(page.locator('output')).toContainText('2.20');
  await page.getByRole('button', { name: 'Open large', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Standard view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Open prototype alongside this viewer' }),
  ).toHaveAttribute('href', 'http://localhost:8765/fireworks.html');
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors, 'Browser and WebGL console errors').toEqual([]);
});

for (const [viewportName, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
  for (const colourScheme of ['light', 'dark'] as const) {
    test(`${viewportName} ${colourScheme} review frames and seek replay`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: colourScheme, reducedMotion: 'reduce' });
      await page.goto('/dev/fireworks');
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
      for (const key of REPRESENTATIVES) {
        await page.locator(`[data-template="${key}"]`).click();
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await seek(page, REVIEW_TIME_S);
        // Two frames flush the demand-driven seek draw before reading the canvas.
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const first = await page.locator('canvas').screenshot();
        await seek(page, OTHER_TIME_S);
        await seek(page, REVIEW_TIME_S);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const replay = await page
          .locator('canvas')
          .screenshot({ path: `output/playwright/${viewportName}-${colourScheme}-${key}.png` });
        expect(replay.equals(first), 'Paused seek replay should produce identical pixels').toBe(
          true,
        );
      }
      await page.screenshot({
        path: `output/playwright/${viewportName}-${colourScheme}-page.png`,
        fullPage: true,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors, 'Browser and WebGL console errors').toEqual([]);
    });
  }
}

test('8-bit output remains visible without half-float colour', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/dev/fireworks?ldr');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(page.getByText(/8-bit output/)).toBeVisible();
  await seek(page, 0);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const before = await page.locator('canvas').screenshot();
  await seek(page, REVIEW_TIME_S);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const after = await page.locator('canvas').screenshot({ path: 'output/playwright/ldr.png' });
  expect(
    after.equals(before),
    'Fallback must draw a changing firework rather than a black canvas',
  ).toBe(false);
  expect(errors).toEqual([]);
});

// A short observation window distinguishes idle demand rendering from a continuous loop.
const IDLE_OBSERVATION_MS = 200;

test('paused and off-screen previews stop GPU draws and navigation releases the canvas', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const prototype = WebGL2RenderingContext.prototype;
    const original = prototype.drawArrays;
    prototype.drawArrays = function (mode, first, count) {
      const root = document.documentElement;
      root.dataset.webglDraws = String(Number(root.dataset.webglDraws ?? 0) + 1);
      return original.call(this, mode, first, count);
    };
  });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await seek(page, REVIEW_TIME_S);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const readDraws = () =>
    page.evaluate(() => Number(document.documentElement.dataset.webglDraws ?? 0));
  const paused = await readDraws();
  await page.waitForTimeout(IDLE_OBSERVATION_MS);
  expect(await readDraws()).toBe(paused);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(readDraws).toBeGreaterThan(paused);
  await page.locator('[data-template]').last().scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const hidden = await readDraws();
  await page.waitForTimeout(IDLE_OBSERVATION_MS);
  expect(await readDraws()).toBe(hidden);
  await page.getByRole('link', { name: 'Developer routes', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
});
