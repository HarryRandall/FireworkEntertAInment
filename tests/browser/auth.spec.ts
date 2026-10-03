/** Local Auth journeys exercise persona boundaries and identity-preserving email upgrades. */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const PASSWORD = 'LocalShowcrafter123!';
const API = 'http://127.0.0.1:55421';
const MAIL = 'http://127.0.0.1:55424';
const personas = [
  { email: 'admin', allowed: ['admin', 'retailer', 'supplier', 'account'], denied: [] },
  { email: 'owner', allowed: ['retailer', 'account'], denied: ['admin', 'supplier'] },
  { email: 'manager', allowed: ['retailer', 'account'], denied: ['admin', 'supplier'] },
  { email: 'other-owner', allowed: ['retailer', 'account'], denied: ['admin', 'supplier'] },
  { email: 'supplier', allowed: ['supplier', 'account'], denied: ['admin', 'retailer'] },
  { email: 'shopper', allowed: ['account'], denied: ['admin', 'retailer', 'supplier'] },
];
for (const persona of personas) {
  test(`${persona.email} reaches permitted areas and is refused unrelated areas`, async ({
    page,
  }) => {
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email', { exact: true }).fill(`${persona.email}@showcrafter.test`);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/auth\/sign-in/);
    for (const area of persona.allowed) {
      await page.goto(`/${area}`);
      await expect(page).toHaveURL(new RegExp(`/${area}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    for (const area of persona.denied) {
      await page.goto(`/${area}`);
      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    }
  });
}

function apiKey(): string {
  const env = readFileSync('apps/web/.env.local', 'utf8');
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.replaceAll('"', '');
  if (url !== API) throw new Error('Auth journeys require the local Supabase environment');
  const key = env
    .match(/^NEXT_PUBLIC_SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY|PUBLISHABLE_DEFAULT_KEY)=(.*)$/m)?.[1]
    ?.replaceAll('"', '');
  if (!key) throw new Error('Local publishable key is missing');
  return key;
}
async function accessToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const pieces = cookies
    .filter((cookie) => /sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const encoded = pieces.map((cookie) => cookie.value).join('');
  if (!encoded.startsWith('base64-')) throw new Error('Expected Supabase SSR session cookies');
  const session: unknown = JSON.parse(
    Buffer.from(encoded.slice('base64-'.length), 'base64url').toString(),
  );
  if (
    typeof session !== 'object' ||
    session === null ||
    !('access_token' in session) ||
    typeof session.access_token !== 'string'
  )
    throw new Error('Invalid Auth session');
  return session.access_token;
}
async function userId(page: Page): Promise<string> {
  const response = await page.request.get(`${API}/auth/v1/user`, {
    headers: { apikey: apiKey(), Authorization: `Bearer ${await accessToken(page)}` },
  });
  expect(response.ok()).toBe(true);
  const user: unknown = await response.json();
  if (typeof user !== 'object' || user === null || !('id' in user) || typeof user.id !== 'string')
    throw new Error('Invalid Auth user');
  return user.id;
}
/** Reads one string field from untrusted mail-catcher JSON. */
function stringField(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null || !(key in value)) return '';
  const field: unknown = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}
/** Waits for Mailpit's newest email to an address sent after the given time; returns its Auth link. */
async function magicLink(page: Page, address: string, sentAfter: Date): Promise<string> {
  let link = '';
  await expect
    .poll(async () => {
      const query = encodeURIComponent(`to:"${address}"`);
      const response = await page.request.get(`${MAIL}/api/v1/search?query=${query}`);
      if (!response.ok()) return false;
      const result: unknown = await response.json();
      const messages: unknown =
        typeof result === 'object' && result !== null && 'messages' in result
          ? result.messages
          : [];
      if (!Array.isArray(messages)) return false;
      // Mailpit lists newest first; earlier runs may have left used links for the same address.
      const latest: unknown = messages.find(
        (message: unknown) => new Date(stringField(message, 'Created')) >= sentAfter,
      );
      const id = stringField(latest, 'ID');
      if (id === '') return false;
      const detail = await page.request.get(`${MAIL}/api/v1/message/${id}`);
      const body = stringField(await detail.json(), 'HTML');
      const match = body.match(/https?:[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/);
      link = match?.[0]?.replaceAll('&amp;', '&') ?? '';
      return link.length > 0;
    })
    .toBe(true);
  const url = new URL(link);
  if (!['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Refusing a non-local Auth link');
  return link;
}

test('anonymous shopper upgrades by email link with the same UUID and saved profile data', async ({
  page,
}) => {
  await page.goto('/shopper');
  const originalId = await userId(page);
  const profileUrl = `${API}/rest/v1/profiles?id=eq.${originalId}`;
  const headers = { apikey: apiKey(), Authorization: `Bearer ${await accessToken(page)}` };
  const saved = await page.request.patch(profileUrl, {
    headers,
    data: { display_name: 'Saved shopper preference' },
  });
  expect(saved.ok()).toBe(true);
  for (const area of ['admin', 'retailer', 'supplier', 'account']) {
    await page.goto(`/${area}`);
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  }
  await page.goto('/shopper');
  const address = `upgrade-${randomUUID()}@showcrafter.test`;
  await page.getByLabel('Email', { exact: true }).fill(address);
  const upgradeSent = new Date();
  await page.getByRole('button', { name: 'Send account link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(await magicLink(page, address, upgradeSent));
  await expect(page).toHaveURL(/\/account$/);
  expect(await userId(page)).toBe(originalId);
  const profile = await page.request.get(`${profileUrl}&select=display_name,is_anonymous`, {
    headers: { ...headers, Authorization: `Bearer ${await accessToken(page)}` },
  });
  expect(profile.ok()).toBe(true);
  expect(await profile.json()).toEqual([
    { display_name: 'Saved shopper preference', is_anonymous: false },
  ]);
});

test('password errors preserve the supplied email', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email', { exact: true }).fill('owner@showcrafter.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('owner@showcrafter.test');
});

test('a permanent shopper can sign in by magic link and sign out', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email', { exact: true }).fill('shopper@showcrafter.test');
  const linkSent = new Date();
  await page.getByRole('button', { name: 'Send magic link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(await magicLink(page, 'shopper@showcrafter.test', linkSent));
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
