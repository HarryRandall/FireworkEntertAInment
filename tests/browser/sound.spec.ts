/** Sound scheduling and cleanup journeys, with browser audio spying installed before the app. */
import { test, expect, type Page } from '@playwright/test';
import { waitForDrawnTime } from './drawn-frame';
import { installAudioSpy } from './audio-spy';
// Long enough to cross a launch cue and its acoustic delay, in wall-clock milliseconds.
const OBSERVE_MS = 500;
async function ready(page: Page): Promise<void> {
  await page.addInitScript(installAudioSpy);
  await page.goto('/dev/fireworks');
  await expect(page.getByRole('button', { name: 'GPU sprays' })).toBeEnabled();
}
async function starts(page: Page): Promise<number> {
  return page.evaluate(() => window.fireworkAudio.reduce((sum, record) => sum + record.starts, 0));
}
async function seek(page: Page, time_s: number): Promise<void> {
  await page.getByRole('slider', { name: 'Preview time' }).evaluate((element, time) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected native seek range');
    element.value = String(time);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, time_s);
  await waitForDrawnTime(page, time_s);
}
test('starts muted, schedules on play after unmute, and pause/seek cancel sound including delayed sources', async ({
  page,
}) => {
  await ready(page);
  expect(await page.evaluate(() => window.fireworkAudio.length)).toBe(0);
  await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await starts(page);
  expect(
    await page.evaluate(() => window.fireworkAudio.every((record) => record.scheduled === 0)),
  ).toBe(true);
  await page.waitForTimeout(OBSERVE_MS);
  expect(await starts(page)).toBe(paused);
  expect(
    await page.evaluate(() => window.fireworkAudio.some((record) => record.immediateStops > 0)),
  ).toBe(true);
  // Cross both launch and burst while paused: the seek must never replay crossed cues.
  await seek(page, 0);
  await seek(page, 3);
  await page.waitForTimeout(OBSERVE_MS);
  expect(await starts(page)).toBe(paused);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(paused);
  await seek(page, 3);
  const sought = await starts(page);
  expect(
    await page.evaluate(() => window.fireworkAudio.every((record) => record.scheduled === 0)),
  ).toBe(true);
  await page.waitForTimeout(OBSERVE_MS);
  expect(await starts(page)).toBe(sought);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
test('mute/volume persist but a reload requires another gesture before audio is created', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.getByRole('slider', { name: 'Sound volume' }).evaluate((element) => {
    if (!(element instanceof HTMLInputElement)) throw new Error('Expected native volume range');
    element.value = '0.2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('sc-viewer-settings') ?? '{}')),
  ).toMatchObject({ sound: true, volume: 0.2 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'GPU sprays' })).toBeEnabled();
  expect(await page.evaluate(() => window.fireworkAudio.length)).toBe(0);
  await expect(page.getByRole('slider', { name: 'Sound volume' })).toHaveValue('0.2');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  const muted = await starts(page);
  expect(
    await page.evaluate(() => window.fireworkAudio.every((record) => record.scheduled === 0)),
  ).toBe(true);
  await page.waitForTimeout(OBSERVE_MS);
  expect(await starts(page)).toBe(muted);
});
test('client navigation closes the owned AudioContext and removes audio gesture listeners', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => starts(page)).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Developer routes', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.fireworkAudio.every((record) => record.closed)))
    .toBe(true);
  const contexts = await page.evaluate(() => window.fireworkAudio.length);
  await page.keyboard.press('Space');
  await page.waitForTimeout(OBSERVE_MS);
  expect(await page.evaluate(() => window.fireworkAudio.length)).toBe(contexts);
});
