/** Composer-run Studio setup and local persisted-state evidence use synthetic admin sessions. */
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openCatalogueEffect } from './catalogue-helpers';
const API = 'http://127.0.0.1:55421';
/** Opens an isolated unpublished copy so publishing journeys do not change seeded templates. */
export async function openStudioCopy(page: Page): Promise<string> {
  await page.goto('/admin/catalogue');
  await expect(page.locator('[data-catalogue-grid]')).toHaveAttribute('data-hydrated', 'true');
  await openCatalogueEffect(page, 'Peony');
  await expect(page.locator('[data-catalogue-controls]')).toHaveAttribute('data-hydrated', 'true');
  const original = page.url();
  await expect(async () => {
    if (page.url() === original)
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(page).not.toHaveURL(original);
  }).toPass();
  const id = page.url().split('/').at(-1);
  if (!id) throw new Error('Copied firework address is missing');
  await expect(async () => {
    if (!page.url().includes('/studio/'))
      await page.getByRole('link', { name: 'Open in Studio', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/studio\/[\da-f-]+$/);
  }).toPass();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
  return id;
}
/** Waits for acknowledged persistence rather than assuming debounce duration. */
export async function studioSaved(page: Page): Promise<void> {
  await expect(page.locator('.sc-studio-toolbar').getByRole('status')).toHaveText('Saved');
}
/** Opens the frame's history action, retrying menu activation if it races hydration. */
export async function openStudioHistory(page: Page): Promise<void> {
  await expect(async () => {
    if (await page.getByRole('dialog', { name: 'Version history' }).isVisible()) return;
    if (!(await page.getByRole('menuitem', { name: 'Version history', exact: true }).isVisible()))
      await page.getByRole('button', { name: 'Editor actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Version history', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Version history' })).toBeVisible();
  }).toPass();
}
/** Reads local PostgREST with the browser's verified Auth session, never a service-role bypass. */
export async function studioRows(
  page: Page,
  table: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const env = readFileSync('apps/web/.env.local', 'utf8');
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.replaceAll('"', '');
  const key = env
    .match(/^NEXT_PUBLIC_SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY|PUBLISHABLE_DEFAULT_KEY)=(.*)$/m)?.[1]
    ?.replaceAll('"', '');
  if (url !== API || !key)
    throw new Error('Studio browser journeys require the local Supabase environment');
  const cookies = (await page.context().cookies())
    .filter((cookie) => /sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const encoded = cookies.map((cookie) => cookie.value).join('');
  if (!encoded.startsWith('base64-')) throw new Error('Expected SSR Auth cookies');
  const session: unknown = JSON.parse(
    Buffer.from(encoded.slice('base64-'.length), 'base64url').toString(),
  );
  if (
    typeof session !== 'object' ||
    session === null ||
    !('access_token' in session) ||
    typeof session.access_token !== 'string'
  )
    throw new Error('Expected verified Auth session');
  const response = await page.request.get(`${API}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
  });
  expect(response.ok()).toBe(true);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Expected catalogue rows');
  return rows.map((row: unknown) => {
    if (typeof row !== 'object' || row === null) throw new Error('Invalid catalogue row');
    return Object.fromEntries(Object.entries(row));
  });
}
