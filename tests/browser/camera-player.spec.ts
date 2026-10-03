/** Chromium journeys for the large stage, finale gestures and native player boundaries. */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForDrawnTime, HIDE_PLAYER_OVERLAY } from './drawn-frame';
// Pointer travel in CSS pixels and a short stationary sample in show seconds.
const DRAG_PX = 80;
const SAMPLE_TIME_S = 2.2;
const FINALE_TIME_S = 14;
const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };
// Easing should finish within two wall-clock seconds even under software GL.
const SETTLE_MS = 2000;

async function ready(page: Page): Promise<Locator> {
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'GPU sprays' })).toBeEnabled();
  return page.locator('canvas');
}
async function seek(page: Page, time_s: number): Promise<void> {
  const slider = page.getByRole('slider', { name: 'Preview time' });
  await slider.evaluate((element, time) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected native player slider');
    element.value = String(time);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, time_s);
  await expect(slider).toHaveValue(String(time_s));
  await waitForDrawnTime(page, time_s);
}
async function drag(page: Page, canvas: Locator, shift = false): Promise<void> {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Stage is not visible');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + DRAG_PX, y - DRAG_PX, { steps: 8 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await page.waitForTimeout(SETTLE_MS);
}
async function image(canvas: Locator): Promise<string> {
  return (await canvas.screenshot({ style: HIDE_PLAYER_OVERLAY })).toString('base64');
}
for (const finale of [false, true]) {
  test(`${finale ? 'finale' : 'single firework'} supports paused drag, wheel zoom, free pan and resize in the large view`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const canvas = await ready(page);
    if (finale) {
      await page.getByRole('button', { name: 'Run 40-shot finale' }).click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
    }
    await seek(page, finale ? FINALE_TIME_S : SAMPLE_TIME_S);
    await page.getByRole('button', { name: 'Open large', exact: true }).click();
    await page.waitForTimeout(SETTLE_MS);
    const initial = await image(canvas);
    await drag(page, canvas);
    expect(await image(canvas)).not.toBe(initial);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    const dragged = await image(canvas);
    await canvas.hover();
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(SETTLE_MS);
    expect(await image(canvas)).not.toBe(dragged);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Free camera', exact: true }).check();
    await page.keyboard.press('Escape');
    const zoomed = await image(canvas);
    await drag(page, canvas, true);
    expect(await image(canvas)).not.toBe(zoomed);
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(SETTLE_MS);
    await drag(page, canvas);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('slider', { name: 'Preview time' })).toHaveValue(
      String(finale ? FINALE_TIME_S : SAMPLE_TIME_S),
    );
    await page.getByRole('button', { name: 'Reset view' }).click();
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
}

test('touch orbit and pinch change a paused finale without toggling playback', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const canvas = await ready(page);
  await page.getByRole('button', { name: 'Run 40-shot finale' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await seek(page, FINALE_TIME_S);
  await page.getByRole('button', { name: 'Open large', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Stage is not visible');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const client = await page.context().newCDPSession(page);
  const initial = await image(canvas);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + DRAG_PX, y: y - DRAG_PX, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(SETTLE_MS);
  expect(await image(canvas)).not.toBe(initial);
  const orbited = await image(canvas);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: x - 70, y, id: 1 },
      { x: x + 70, y, id: 2 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(SETTLE_MS);
  expect(await image(canvas)).not.toBe(orbited);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Preview time' })).toHaveValue(
    String(FINALE_TIME_S),
  );
  await client.detach();
});

test('canvas click and Space toggle once, buttons keep focus and native scrubbing pauses', async ({
  page,
}) => {
  const canvas = await ready(page);
  await seek(page, SAMPLE_TIME_S);
  await canvas.click({ position: { x: 100, y: 100 } });
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible();
  await page.keyboard.press('Space');
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible();
  await play.focus();
  await page.keyboard.press('Space');
  await expect(pause).toBeFocused();
  // Playback emits repeatedly; the existing button remains focused after the label changes.
  await page.waitForTimeout(200);
  await expect(pause).toBeFocused();
  await page.keyboard.press('Space');
  await expect(play).toBeFocused();
  await seek(page, SAMPLE_TIME_S);
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('0.25');
  await expect(page.getByRole('combobox', { name: 'Playback speed' })).toHaveValue('0.25');
  await expect(play).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(pause).toBeVisible();
});

test('settings persist across reload, malformed preferences recover and profiling returns a visible sample', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Smoke', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Camera shake', exact: true }).uncheck();
  await page.reload();
  await expect(page.getByRole('button', { name: 'GPU sprays' })).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Smoke', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Camera shake', exact: true })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Profile one frame' }).click();
  await expect(page.getByTestId('phase-profile')).toContainText('Bloom: absent');
  await expect(page.getByTestId('phase-profile')).not.toContainText('GPU timers: pending');
  await page.evaluate(() => localStorage.setItem('sc-viewer-settings', '{invalid'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'GPU sprays' })).toBeEnabled();
  await page.getByRole('link', { name: 'Developer routes', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.keyboard.press('Space');
});
