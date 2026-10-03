/** Warm finale playback keeps camera-independent counts and bounded CPU submission work. */
import { test, expect, type Page } from '@playwright/test';
import { waitForDrawnTime, captureRenderer } from './drawn-frame';

// Regression ceiling in CPU milliseconds, deliberately below the owner's 200+ ms stalls.
// This includes synchronous driver submission, not asynchronous GPU completion or RAF intervals.
const CPU_FRAME_BUDGET_MS = 100;
// A five per cent sampling margin covers RAFs missing the exact candidate peak during playback.
const COUNT_BOUND_FACTOR = 1.05;
// Dense reference instant in show seconds, found by the 60 Hz whole-sequence Node audit.
const PEAK_TIME_S = 13.016667;
// Wall-clock limit allows software GL to complete a whole normal-speed finale.
const PLAYBACK_TIMEOUT_MS = 60_000;
// Pull to each camera range limit; normal controls clamp this synthetic pixel wheel gesture.
const ZOOM_WHEEL_PX = 10_000;
// At least this many completed frames are needed to make the playback assertion meaningful.
const MIN_MEASURED_FRAMES = 60;
// Paused control easing settles within two seconds under the existing camera journey convention.
const CAMERA_SETTLE_MS = 2000;

interface Sample {
  time: number;
  cpuMs: number;
  cpuParticles: number;
  candidates: number;
  allocations: number;
  compilations: number;
}

async function seek(page: Page, time: number): Promise<void> {
  await page.getByRole('slider', { name: 'Preview time' }).evaluate((element, value) => {
    const slider = element as HTMLInputElement;
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, time);
  await waitForDrawnTime(page, time);
}

async function readCounts(page: Page) {
  return page
    .getByTestId('stage')
    .locator('canvas')
    .evaluate((canvas) => ({
      cpu: Number(canvas.dataset.cpuParticles),
      candidates: Number(canvas.dataset.gpuCandidates),
    }));
}

async function playSequence(page: Page, measure: boolean): Promise<Sample[]> {
  await seek(page, 0);
  await page.evaluate((enabled) => {
    document.documentElement.dataset.zoomSamples = '[]';
    document.documentElement.dataset.measureZoom = String(enabled);
    document.documentElement.dataset.zoomCycleComplete = 'false';
    document.documentElement.dataset.watchZoomCycle = 'true';
  }, measure);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // Observe a whole cycle, including the sparse tail, rather than ending before the wrap.
  await page.waitForFunction(
    () => document.documentElement.dataset.zoomCycleComplete === 'true',
    undefined,
    { timeout: PLAYBACK_TIMEOUT_MS },
  );
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.dataset.measureZoom = 'false';
  });
  const raw = await page.evaluate(() => document.documentElement.dataset.zoomSamples ?? '[]');
  // The recording script below owns this JSON, rather than an external input.
  return JSON.parse(raw) as Sample[];
}

test('free-camera zoomed-out warm finale has bounded CPU work, counts and no GPU storage allocations', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    let allocations = 0;
    let compilations = 0;
    let lastTime = 0;
    const samples: Sample[] = [];
    const prototype = WebGL2RenderingContext.prototype;
    for (const name of ['bufferData', 'texImage2D', 'texStorage2D', 'linkProgram'] as const) {
      const original = prototype[name];
      Object.defineProperty(prototype, name, {
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          if (
            this.canvas instanceof HTMLCanvasElement &&
            this.canvas.closest('[data-testid="stage"]')
          ) {
            if (name === 'linkProgram') compilations++;
            else allocations++;
          }
          return Reflect.apply(original, this, args);
        },
      });
    }
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) =>
      request((now) => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="stage"] canvas');
        const before = canvas?.dataset.drawnTime;
        const storageBefore = allocations;
        const programsBefore = compilations;
        const started = performance.now();
        callback(now);
        const cpuMs = performance.now() - started;
        if (!canvas || canvas.dataset.drawnTime === before) return;
        const time = Number(canvas.dataset.drawnTime);
        if (document.documentElement.dataset.watchZoomCycle === 'true' && time < lastTime) {
          document.documentElement.dataset.zoomCycleComplete = 'true';
          document.documentElement.dataset.watchZoomCycle = 'false';
          document.documentElement.dataset.measureZoom = 'false';
        }
        lastTime = time;
        if (document.documentElement.dataset.measureZoom !== 'true') {
          if (document.documentElement.dataset.zoomCycleComplete !== 'true') samples.length = 0;
          return;
        }
        samples.push({
          time: Number(canvas.dataset.drawnTime),
          cpuMs,
          cpuParticles: Number(canvas.dataset.cpuParticles),
          candidates: Number(canvas.dataset.gpuCandidates),
          allocations: allocations - storageBefore,
          compilations: compilations - programsBefore,
        });
        document.documentElement.dataset.zoomSamples = JSON.stringify(samples);
      });
  });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Run 40-shot finale' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'GPU sprays', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Free camera', exact: true }).check();
  await page.keyboard.press('Escape');
  const canvas = page.getByTestId('stage').locator('canvas');
  await canvas.hover();
  await page.mouse.wheel(0, -ZOOM_WHEEL_PX);
  await page.waitForTimeout(CAMERA_SETTLE_MS);
  await seek(page, PEAK_TIME_S);
  const nearImage = await captureRenderer(page);
  const near = await readCounts(page);
  expect(near.candidates).toBeGreaterThan(0);
  // Traverse the entire sequence once so source textures, particle buffers and shaders are warm.
  await playSequence(page, false);
  await canvas.hover();
  await page.mouse.wheel(0, ZOOM_WHEEL_PX);
  await page.waitForTimeout(CAMERA_SETTLE_MS);
  await seek(page, PEAK_TIME_S);
  expect((await captureRenderer(page)).equals(nearImage)).toBe(false);
  expect(await readCounts(page)).toEqual(near);
  const samples = await playSequence(page, true);
  expect(samples.length).toBeGreaterThanOrEqual(MIN_MEASURED_FRAMES);
  for (const sample of samples) {
    expect(Number.isFinite(sample.cpuMs)).toBe(true);
    expect(sample.cpuMs, `CPU work at ${String(sample.time)} s`).toBeLessThanOrEqual(
      CPU_FRAME_BUDGET_MS,
    );
    expect(sample.candidates).toBeLessThanOrEqual(near.candidates * COUNT_BOUND_FACTOR);
    expect(sample.cpuParticles).toBeGreaterThanOrEqual(0);
    expect(sample.cpuParticles + sample.candidates).toBeLessThanOrEqual(
      (near.cpu + near.candidates) * COUNT_BOUND_FACTOR,
    );
    expect(sample.allocations, `GPU storage at ${String(sample.time)} s`).toBe(0);
    expect(sample.compilations, `Shader linking at ${String(sample.time)} s`).toBe(0);
  }
  console.log(
    JSON.stringify({
      frames: samples.length,
      maxCpuMs: Math.max(...samples.map((sample) => sample.cpuMs)),
      near,
    }),
  );
});
