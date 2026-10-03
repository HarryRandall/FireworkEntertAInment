/** Browser journeys and representative review stills exercise the rendered WebGL surface. */
import { test, expect, type Page } from '@playwright/test';
import { waitForDrawnTime, captureRenderer } from './drawn-frame';
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
  await waitForDrawnTime(page, time_s);
}

test('progressive catalogue posters allow selected playback and exact scrubbing', async ({
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
    test(`${viewportName} ${colourScheme} review frames and seek replay`, async ({
      page,
    }, testInfo) => {
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
        const first = await captureRenderer(page);
        await seek(page, OTHER_TIME_S);
        await seek(page, REVIEW_TIME_S);
        const replay = await captureRenderer(
          page,
          `output/playwright/${viewportName}-${colourScheme}-${key}.png`,
        );
        if (!replay.equals(first)) {
          await testInfo.attach(`${key}-first`, { body: first, contentType: 'image/png' });
          await testInfo.attach(`${key}-replay`, { body: replay, contentType: 'image/png' });
        }
        expect(
          replay.equals(first),
          `${key}: paused seek replay should produce identical pixels`,
        ).toBe(true);
      }
      // A full-page capture of every card exceeds Chromium's capture size, so the page
      // still is the visible viewport; the canvas stills above are the review evidence.
      await page.screenshot({
        path: `output/playwright/${viewportName}-${colourScheme}-page.png`,
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
  const before = await captureRenderer(page);
  await seek(page, REVIEW_TIME_S);
  const after = await captureRenderer(page, 'output/playwright/ldr.png');
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
      // The detached thumbnail context may still draw while the live stage is paused.
      if (!(this.canvas instanceof HTMLCanvasElement) || !this.canvas.isConnected)
        return original.call(this, mode, first, count);
      const root = document.documentElement;
      root.dataset.webglDraws = String(Number(root.dataset.webglDraws ?? 0) + 1);
      return original.call(this, mode, first, count);
    };
  });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await seek(page, REVIEW_TIME_S);
  const readDraws = () =>
    page.evaluate(() => Number(document.documentElement.dataset.webglDraws ?? 0));
  const paused = await readDraws();
  await page.waitForTimeout(IDLE_OBSERVATION_MS);
  expect(await readDraws()).toBe(paused);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(readDraws).toBeGreaterThan(paused);
  await page.locator('[data-template]').last().scrollIntoViewIfNeeded();
  await expect(page.locator('canvas')).not.toBeInViewport();
  const hidden = await readDraws();
  await page.waitForTimeout(IDLE_OBSERVATION_MS);
  expect(await readDraws()).toBe(hidden);
  await page.getByRole('link', { name: 'Developer routes', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('the finale compares CPU and GPU sprays in one context and resets frame samples', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/dev/fireworks');
  const gpu = page.getByRole('button', { name: 'GPU sprays', exact: true });
  const cpu = page.getByRole('button', { name: 'CPU sprays', exact: true });
  await expect(gpu).toBeEnabled();
  await expect(gpu).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Run 40-shot finale' }).click();
  await expect(page.getByTestId('selected-name')).toHaveText('40-shot finale');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await seek(page, 11.2);
  await cpu.click();
  await expect(cpu).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('frame-times')).toContainText('(0/120 playing frames)');
  await expect(page.getByRole('slider', { name: 'Preview time' })).toHaveValue('11.2');
  await gpu.click();
  await expect(gpu).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to one firework' }).click();
  await expect(page.getByTestId('selected-name')).not.toHaveText('40-shot finale');
  expect(errors).toEqual([]);
});

test('drawn time retains completed live draws while repeated seeks are pending', async ({
  page,
}) => {
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await seek(page, REVIEW_TIME_S);
  for (const time_s of [REVIEW_TIME_S, 2.205142857, OTHER_TIME_S]) {
    const previousTime = await page.locator('canvas').getAttribute('data-drawn-time');
    const duringSeek = await page
      .getByRole('slider', { name: 'Preview time' })
      .evaluate((element, time) => {
        if (!(element instanceof HTMLInputElement)) throw new Error('Expected native seek range');
        element.value = String(time);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        const canvas = document.querySelector('canvas');
        return {
          time: canvas?.getAttribute('data-drawn-time'),
          pending: canvas?.getAttribute('data-draw-pending'),
        };
      }, time_s);
    expect(duringSeek).toEqual({ time: previousTime, pending: 'true' });
    await waitForDrawnTime(page, time_s);
    await expect(page.getByRole('slider', { name: 'Preview time' })).toHaveValue(String(time_s));
  }
});
