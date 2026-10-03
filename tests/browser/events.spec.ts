/** Composer-run shopper journey verifies raw local analytics, not browser dispatch alone. */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { signInAs, userId, magicLink } from './auth-helpers';
const ORGANISATION = '30000000-0000-4000-8000-000000000001';
const STORE = '40000000-0000-4000-8000-000000000001';
const expectedTypes = [
  'scan',
  'store_view',
  'product_view',
  'play',
  'plan_start',
  'plan_pick',
  'edit',
  'something_different',
  'list_add',
  'list_saved',
  'till_code_shown',
].sort();
function sql(command: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_showcrafter',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input: command, encoding: 'utf8' },
  ).trim();
}
function uuid(value: string | null): string {
  if (value === null || !/^[a-f0-9-]{36}$/.test(value)) throw new Error('Missing UUID');
  return value;
}
async function clickUntil(page: Page, name: string, condition: () => Promise<void>) {
  await expect(async () => {
    await page.getByRole('button', { name, exact: true }).click();
    await condition();
  }).toPass();
}
test.beforeAll(() => {
  if (
    !/^NEXT_PUBLIC_SUPABASE_URL="?http:\/\/127\.0\.0\.1:55421"?$/m.test(
      readFileSync('apps/web/.env.local', 'utf8'),
    )
  )
    throw new Error('Event journeys require local Supabase');
  sql(readFileSync('tests/browser/shopper-fixtures.sql', 'utf8'));
  sql(`insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key)
    values ('${ORGANISATION}',10000,'grant','browser:events') on conflict (idempotency_key) do nothing;`);
});
async function makePlan(page: Page) {
  await page.goto('/shopper/stores/leeds/plan');
  await clickUntil(page, "I'm 18 or over", () =>
    expect(page.getByRole('button', { name: "Let's plan" })).toBeVisible(),
  );
  await clickUntil(page, "Let's plan", () =>
    expect(page.getByRole('heading', { name: "What's the occasion?" })).toBeVisible(),
  );
  const headings = [
    "What's the occasion?",
    'How much space do you have?',
    "What's your budget?",
    'How loud?',
    'What do you love?',
  ];
  for (const [index, heading] of headings.entries()) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (index < headings.length - 1)
      await clickUntil(page, 'Next', () =>
        expect(page.getByRole('heading', { name: headings[index + 1], exact: true })).toBeVisible(),
      );
  }
  await clickUntil(page, 'Plan my show', () => expect(page).toHaveURL(/session=[a-f0-9-]+/));
  return uuid(new URL(page.url()).searchParams.get('session'));
}
test('phone shopper journey appends the eleven expected event kinds and respects opt-out', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, 'shopper');
  const shopper = uuid(await userId(page));
  sql(`insert into public.follows(shopper_id,organisation_id,visible_to_shop,marketing_opt_in,consent_text_version)
    values ('${shopper}','${ORGANISATION}',true,false,'shopper-consent-1')
    on conflict (shopper_id,organisation_id) do update set visible_to_shop=true,marketing_opt_in=false;`);
  const after = sql('select coalesce(max(id),0) from public.events;');
  await page.goto('/q/browser-product');
  await expect(page.getByRole('heading', { name: 'Heart Burst', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      sql(
        `select count(*) from public.events where id>${after} and shopper_id='${shopper}' and type='scan';`,
      ),
    )
    .toBe('1');
  await page.goto('/shopper/stores/leeds');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const session = await makePlan(page);
  await clickUntil(page, 'Play', () =>
    expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible(),
  );
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await clickUntil(page, 'Change it', () =>
    expect(page.getByRole('heading', { name: 'Change your show' })).toBeVisible(),
  );
  await clickUntil(page, 'Cheaper', async () => {
    await expect
      .poll(() =>
        sql(`select outcome from public.plan_edits where session_id='${session}' and seq=1;`),
      )
      .toBe('applied');
  });
  await expect(page.getByRole('button', { name: 'Show me something different' })).toBeEnabled();
  await clickUntil(page, 'Show me something different', async () => {
    await expect
      .poll(() => sql(`select count(*) from public.plan_candidates where session_id='${session}';`))
      .toBe('2');
  });
  await expect(page.getByRole('button', { name: 'Save to list' })).toBeEnabled();
  await clickUntil(page, 'Save to list', () => expect(page).toHaveURL(/\/list\?id=[a-f0-9-]+$/));
  const list = uuid(new URL(page.url()).searchParams.get('id'));
  await expect(page.locator('[data-till-code]')).toBeVisible();
  await expect
    .poll(() =>
      sql(
        `select distinct type from public.events where id>${after} and shopper_id='${shopper}' order by type;`,
      ).split('\n'),
    )
    .toEqual(expectedTypes);
  expect(
    sql(
      `select count(*) from public.events where id>${after} and shopper_id='${shopper}' and type='edit' and plan_session_id='${session}';`,
    ),
  ).toBe('1');
  expect(
    sql(
      `select count(*) from public.events where id>${after} and shopper_id='${shopper}' and type='list_saved' and props->>'list_id'='${list}';`,
    ),
  ).toBe('1');
  expect(
    sql(
      `select count(distinct session_key) from public.events where id>${after} and shopper_id='${shopper}' and type in ('plan_start','edit','something_different','list_add');`,
    ),
  ).toBe('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const consent = page.locator('[data-section=shop-consent]');
  await consent.getByRole('checkbox', { name: /see my activity/ }).setChecked(false);
  await consent.getByRole('button', { name: 'Save shop choices' }).click();
  await expect(consent.getByRole('status')).toHaveText('Shop choices saved.');
  const optedOutKey = randomUUID();
  // Direct transport verifies the database refusal even when client suppression is bypassed.
  const response = await page.request.post('/api/shopper/events', {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      session_key: optedOutKey,
      events: [{ type: 'store_view', store: STORE, context: {}, props: {} }],
    },
  });
  expect(response.ok()).toBe(true);
  expect(sql(`select count(*) from public.events where session_key='${optedOutKey}';`)).toBe('0');
});

test('anonymous list saving survives email upgrade without recording personal data', async ({
  page,
}) => {
  await page.goto('/q/browser-product');
  const shopper = uuid(await userId(page));
  await clickUntil(page, 'Add to my list', () => expect(page).toHaveURL(/\/list\?id=[a-f0-9-]+$/));
  const list = uuid(new URL(page.url()).searchParams.get('id'));
  await expect
    .poll(() =>
      sql(
        `select count(*) from public.events where shopper_id='${shopper}' and type='list_saved' and props->>'list_id'='${list}';`,
      ),
    )
    .toBe('1');
  const email = `events-${randomUUID()}@example.invalid`;
  const sentAfter = new Date();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await clickUntil(page, 'Send account link', () =>
    expect(page.getByRole('status').filter({ hasText: 'Check your email' })).toBeVisible(),
  );
  await page.goto(await magicLink(page, email, sentAfter));
  await expect(page).toHaveURL(new RegExp(`/account/lists/${list}$`));
  expect(await userId(page)).toBe(shopper);
  expect(
    sql(
      `select count(*) from public.events where shopper_id='${shopper}' and props::text like '%${email}%';`,
    ),
  ).toBe('0');
});
