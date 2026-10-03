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
function messageDate(message: unknown): string {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('date' in message) ||
    typeof message.date !== 'string'
  )
    return '';
  return message.date;
}
async function magicLink(page: Page, mailbox: string): Promise<string> {
  let link = '';
  await expect
    .poll(async () => {
      const response = await page.request.get(`${MAIL}/api/v1/mailbox/${mailbox}`);
      if (!response.ok()) return false;
      const messages: unknown = await response.json();
      if (!Array.isArray(messages) || messages.length === 0) return false;
      const ordered = [...messages].sort((left: unknown, right: unknown) =>
        messageDate(right).localeCompare(messageDate(left)),
      );
      const latest: unknown = ordered[0];
      if (
        typeof latest !== 'object' ||
        latest === null ||
        !('id' in latest) ||
        typeof latest.id !== 'string'
      )
        return false;
      const detail = await page.request.get(`${MAIL}/api/v1/mailbox/${mailbox}/${latest.id}`);
      const message: unknown = await detail.json();
      if (typeof message !== 'object' || message === null || !('body' in message)) return false;
      const content = message.body;
      if (
        typeof content !== 'object' ||
        content === null ||
        !('html' in content) ||
        typeof content.html !== 'string'
      )
        return false;
      const body = content.html;
      const match = body
        .replaceAll('\\u0026', '&')
        .match(/https?:[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/);
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
  const mailbox = `upgrade-${randomUUID()}`;
  await page.getByLabel('Email', { exact: true }).fill(`${mailbox}@showcrafter.test`);
  await page.getByRole('button', { name: 'Send account link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(await magicLink(page, mailbox));
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
  await page.getByRole('button', { name: 'Send magic link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(await magicLink(page, 'shopper'));
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
