/** Optional music states, mocked provider journeys and composer visual evidence. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { musicSetup, musicPlan, musicCapture, musicalResponse } from './music-helpers';
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 1000 } };
const track = {
  provider_track_id: '123',
  title: 'Synthetic sky',
  artist: 'Test artist',
  duration_ms: 120000,
  audio_url: 'https://prod-1.storage.jamendo.com/audio',
  licence_code: 'CC-BY-4.0',
  licence_url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Synthetic sky by Test artist · Jamendo · CC-BY-4.0',
};
test.beforeAll(musicSetup);
for (const [name, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`missing key keeps the silent plan usable at ${name} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await musicPlan(page);
      await expect(async () => {
        await page.getByRole('button', { name: 'Pick music', exact: true }).click();
        await expect(
          page.getByText('Music search is not configured. You can keep planning without music.'),
        ).toBeVisible();
      }).toPass();
      await expect(page.getByRole('button', { name: 'Show me something different' })).toBeEnabled();
      await expect(page.locator('input[type=file]')).toHaveCount(0);
      await musicCapture(page, info, `${name}-${theme}-not-configured`);
    });
    test(`search, choose, analyse, attribute and remove music at ${name} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      let ready = false;
      let session = '';
      await page.route('**/api/shopper/music**', async (route) => {
        if (route.request().method() === 'POST') {
          const body: unknown = route.request().postDataJSON();
          if (
            typeof body !== 'object' ||
            body === null ||
            !('session' in body) ||
            typeof body.session !== 'string'
          )
            throw new Error('Missing request session');
          session = body.session;
          const refreshed = 'refresh' in body && body.refresh === true;
          const removed = 'track' in body && body.track === null;
          await route.fulfill({ json: musicalResponse(session, refreshed, removed) });
        } else if (new URL(route.request().url()).searchParams.has('session'))
          await route.fulfill({ json: { ready } });
        else
          await route.fulfill({
            json: {
              status: 'ok',
              tracks: new URL(route.request().url()).searchParams.get('q') ? [track] : [],
            },
          });
      });
      await page.route('https://prod-1.storage.jamendo.com/**', (route) =>
        route.fulfill({
          body: readFileSync('services/music-analyser/tests/fixtures/clicks.wav'),
          contentType: 'audio/wav',
        }),
      );
      await musicPlan(page);
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await page.getByRole('button', { name: 'Pick music', exact: true }).click();
      await page.getByRole('textbox', { name: 'Track or artist' }).fill('sky');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Choose Synthetic sky' })).toBeVisible();
      await musicCapture(page, info, `${name}-${theme}-search`);
      await page.getByRole('button', { name: 'Choose Synthetic sky' }).click();
      await expect(
        page.getByText('Analysing this track. Your show is planned without beats for now.'),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Licence: CC-BY-4.0' })).toHaveAttribute(
        'href',
        track.licence_url,
      );
      await expect(
        page.getByText(
          'Commercial use is not licensed. Check permission before public performance.',
        ),
      ).toBeVisible();
      await musicCapture(page, info, `${name}-${theme}-analysing`);
      ready = true;
      await expect(
        page.getByText('Timed to this track. Its analysis is saved with your plan.'),
      ).toBeVisible();
      await musicCapture(page, info, `${name}-${theme}-timed`);
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
      await page.getByRole('slider', { name: 'Show time' }).focus();
      await page.keyboard.press('Home');
      await expect(page.getByRole('slider', { name: 'Show time' })).toHaveValue('0');
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Remove music' }).click();
      await expect(
        page.getByText('Music is optional. Your show works without a soundtrack.'),
      ).toBeVisible();
      await musicCapture(page, info, `${name}-${theme}-removed`);
    });
  }
}
test('empty and failed search retain the query and recover on a real response', async ({
  page,
}) => {
  let failure = false;
  await page.route('**/api/shopper/music**', (route) =>
    route.fulfill({
      json: failure
        ? { status: 'error', message: 'Music search could not load. Please try again.' }
        : { status: 'ok', tracks: [] },
    }),
  );
  await musicPlan(page);
  await page.getByRole('button', { name: 'Pick music', exact: true }).click();
  await page.getByRole('textbox', { name: 'Track or artist' }).fill('unknown');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No tracks found. Try another track or artist.')).toBeVisible();
  failure = true;
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Music search could not load',
  );
  await expect(page.getByRole('textbox', { name: 'Track or artist' })).toHaveValue('unknown');
  failure = false;
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No tracks found. Try another track or artist.')).toBeVisible();
});
test('long provider text stays within the phone viewport with keyboard selection available', async ({
  page,
}, info) => {
  await page.setViewportSize(viewports.phone);
  const longTrack = { ...track, title: 'Sky'.repeat(100), artist: 'Artist'.repeat(60) };
  await page.route('**/api/shopper/music**', (route) =>
    route.fulfill({
      json: {
        status: 'ok',
        tracks: new URL(route.request().url()).searchParams.get('q') ? [longTrack] : [],
      },
    }),
  );
  await musicPlan(page);
  await page.getByRole('button', { name: 'Pick music', exact: true }).click();
  await page.getByRole('textbox', { name: 'Track or artist' }).fill('sky');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const choose = page.getByRole('button', { name: `Choose ${longTrack.title}` });
  await expect(choose).toBeVisible();
  await choose.focus();
  await expect(choose).toBeFocused();
  await musicCapture(page, info, 'phone-long-metadata');
});
