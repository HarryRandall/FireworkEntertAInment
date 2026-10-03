/** Approved thumbnail baselines and live-canvas isolation on the progressive showcase. */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { captureRenderer, waitForDrawnTime } from './drawn-frame';

// Small 160 by 100 pixel baselines keep committed images inexpensive.
const SNAPSHOT_WIDTH_PX = 160;
const SNAPSHOT_HEIGHT_PX = 100;
// Pixelmatch's YIQ perceptual threshold tolerates subtle colour/edge rounding in software GL.
// At most 1% of pixels may exceed 0.15; framing, missing trails and wrong moments still fail.
const PERCEPTUAL_THRESHOLD = 0.15;
const MAX_CHANGED_PIXEL_FRACTION = 0.01;
// The entire catalogue is rendered progressively before the final fixture arrives.
const CATALOGUE_TIMEOUT_MS = 180_000;
const READY_TIMEOUT_MS = 5_000;
const FIXTURES = ['fixture-peony', 'fixture-comet', 'fixture-multi-break'];
const REPRESENTATIVES = [
  'peony',
  'willow',
  'crackle',
  'fountain',
  'wheel',
  'romanCandle',
  'skyRocket',
];
const REVIEW_TIME_S = 2.2;

async function waitForPoster(page: Page, key: string) {
  await expect(page.locator(`[data-template="${key}"]`)).toHaveAttribute(
    'data-poster-status',
    'ready',
    {
      timeout: CATALOGUE_TIMEOUT_MS,
    },
  );
  const image = page.locator(`[data-template="${key}"] img`);
  await expect(image).toHaveAttribute('src', /^blob:/, { timeout: CATALOGUE_TIMEOUT_MS });
  await image.evaluate(async (element) => {
    if (!(element instanceof HTMLImageElement)) throw new Error('Expected a poster image');
    await element.decode();
    if (element.naturalWidth === 0) throw new Error('Poster pixels were not decoded');
  });
  return image;
}

/** Scales the decoded poster itself to a fixed-size PNG, so card layout rounding cannot change its size. */
async function posterPixels(image: Locator): Promise<Buffer> {
  const dataUrl = await image.evaluate(
    (element, size) => {
      if (!(element instanceof HTMLImageElement)) throw new Error('Expected a poster image');
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('Snapshot canvas needs a 2D context');
      context.drawImage(element, 0, 0, size.width, size.height);
      return canvas.toDataURL('image/png');
    },
    { width: SNAPSHOT_WIDTH_PX, height: SNAPSHOT_HEIGHT_PX },
  );
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

test('fixture and representative posters match approved small perceptual baselines', async ({
  page,
}) => {
  test.setTimeout(CATALOGUE_TIMEOUT_MS);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: READY_TIMEOUT_MS,
  });
  const keys =
    process.env.POSTER_SNAPSHOTS_ALL === '1'
      ? await page
          .locator('[data-template]')
          .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-template') ?? ''))
      : [...FIXTURES, ...REPRESENTATIVES];
  for (const key of keys) {
    const image = await waitForPoster(page, key);
    const pixels = await posterPixels(image);
    expect(pixels).toMatchSnapshot(`${key}.png`, {
      threshold: PERCEPTUAL_THRESHOLD,
      maxDiffPixelRatio: MAX_CHANGED_PIXEL_FRACTION,
    });
  }
});

test('progressive posters allocate one detached context and preserve the paused live frame', async ({
  page,
}) => {
  test.setTimeout(CATALOGUE_TIMEOUT_MS);
  await page.addInitScript(() => {
    const contexts = new Set<WebGL2RenderingContext>();
    let peak = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      const context = original.apply(this, args);
      if (context instanceof WebGL2RenderingContext) {
        contexts.add(context);
        peak = Math.max(peak, [...contexts].filter((gl) => !gl.isContextLost()).length);
        document.documentElement.dataset.rendererContexts = String(peak);
      }
      return context;
    } as typeof original;
  });
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: READY_TIMEOUT_MS,
  });
  await page.getByRole('slider', { name: 'Preview time' }).evaluate((element, time) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected seek range');
    element.value = String(time);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, REVIEW_TIME_S);
  await waitForDrawnTime(page, REVIEW_TIME_S);
  const canvas = page.getByTestId('stage').locator('canvas');
  const readSize = () =>
    canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected live canvas');
      return { width: element.width, height: element.height };
    });
  const size = await readSize();
  const before = await captureRenderer(page);
  await waitForPoster(page, 'fixture-multi-break');
  await waitForDrawnTime(page, REVIEW_TIME_S);
  expect(await readSize()).toEqual(size);
  expect((await captureRenderer(page)).equals(before)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-renderer-contexts', '2');
  await expect(page.locator('canvas')).toHaveCount(1);
});
