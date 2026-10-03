/** Full WebGL draw accounting and synchronous pause evidence for the live finale. */
import { test, expect } from '@playwright/test';
import { waitForDrawnTime, captureRenderer } from './drawn-frame';

// A short idle observation after the single paused draw, in wall-clock milliseconds.
const IDLE_MS = 300;

test('finale batches draws, pauses synchronously and replays exact seeks', async ({ page }) => {
  await page.addInitScript(() => {
    const root = () => document.documentElement;
    const prototype = WebGL2RenderingContext.prototype;
    for (const name of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
    ] as const) {
      const original = prototype[name];
      // All four signatures use numeric arguments. Detached poster draws are excluded.
      Object.defineProperty(prototype, name, {
        value: function (this: WebGL2RenderingContext, ...args: number[]) {
          if (this.canvas instanceof HTMLCanvasElement && this.canvas.isConnected) {
            root().dataset.liveDraws = String(Number(root().dataset.liveDraws ?? 0) + 1);
          }
          return Reflect.apply(original, this, args);
        },
      });
    }
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      request((now) => {
        const before = Number(root().dataset.liveDraws ?? 0);
        callback(now);
        const count = Number(root().dataset.liveDraws ?? 0) - before;
        if (count > 0) root().dataset.frameDraws = String(count);
      });
  });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Run 40-shot finale' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-drawn-time', /[0-9]/);
  const pausedTime = await page
    .getByRole('button', { name: 'Pause', exact: true })
    .evaluate((button) => {
      const canvas = document.querySelector('canvas');
      const before = canvas?.dataset.drawnTime;
      (button as HTMLButtonElement).click();
      const slider = document.querySelector<HTMLInputElement>('input[aria-label="Preview time"]');
      return { before: Number(before), after: Number(slider?.value) };
    });
  expect(pausedTime.after).toBeCloseTo(pausedTime.before, 6);
  await waitForDrawnTime(page, pausedTime.after);
  const readDraws = () =>
    page.evaluate(() => Number(document.documentElement.dataset.liveDraws ?? 0));
  const pausedDraws = await readDraws();
  await page.waitForTimeout(IDLE_MS);
  expect(await readDraws()).toBe(pausedDraws);
  await expect(page.locator('canvas')).toHaveAttribute(
    'data-drawn-time',
    pausedTime.after.toFixed(6),
  );
  const seek = async (time: number) => {
    await page.getByRole('slider', { name: 'Preview time' }).evaluate((element, value) => {
      const slider = element as HTMLInputElement;
      slider.value = String(value);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, time);
    await waitForDrawnTime(page, time);
  };
  await seek(11.2);
  const draws = await page.evaluate(() => Number(document.documentElement.dataset.frameDraws));
  console.log(`Finale dense frame: ${String(draws)} WebGL draws`);
  const first = await captureRenderer(page);
  await seek(14);
  await seek(11.2);
  expect((await captureRenderer(page, 'output/playwright/finale-replay.png')).equals(first)).toBe(
    true,
  );
  // World, hardware, particle layers, GPU sprays and output have a fixed draw budget.
  expect(draws).toBeGreaterThan(0);
  expect(draws).toBeLessThanOrEqual(9);
  const beforePlay = await readDraws();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(readDraws).toBeGreaterThan(beforePlay);
  const playingDraws = await page.evaluate(() =>
    Number(document.documentElement.dataset.frameDraws),
  );
  console.log(`Finale playing frame: ${String(playingDraws)} WebGL draws`);
  expect(playingDraws).toBeLessThanOrEqual(9);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  // Pausing requests one redraw of the paused frame; count from after it completes.
  await expect(page.locator('canvas')).toHaveAttribute('data-draw-pending', 'false');
  const finalDraws = await readDraws();
  await page.waitForTimeout(IDLE_MS);
  expect(await readDraws()).toBe(finalDraws);
});
