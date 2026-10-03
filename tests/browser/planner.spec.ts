/** Local planner journeys and pending composer visual/accessibility review. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const API = 'http://127.0.0.1:55421';
const ORGANISATION = '30000000-0000-4000-8000-000000000001';
const HOLD = 'c9000000-0000-4000-8000-000000000001';
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 1000 } };
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
test.beforeAll(() => {
  const env = readFileSync('apps/web/.env.local', 'utf8');
  if (
    !env.includes(`NEXT_PUBLIC_SUPABASE_URL=${API}`) &&
    !env.includes(`NEXT_PUBLIC_SUPABASE_URL="${API}"`)
  )
    throw new Error('Planner tests require local Supabase');
  sql(
    `insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key) values ('${ORGANISATION}',10000,'grant','browser:planner') on conflict (idempotency_key) do nothing;`,
  );
});
async function enter(page: Page) {
  await page.goto('/shopper/stores/leeds/plan');
  await expect(page.getByRole('heading', { name: 'Before we plan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: "I'm 18 or over" }).click();
  await page.getByRole('button', { name: "Let's plan" }).click();
}
async function questions(page: Page, visit?: (index: number) => Promise<void>) {
  const headings = [
    "What's the occasion?",
    'How much space do you have?',
    "What's your budget?",
    'How loud?',
    'What do you love?',
  ];
  for (const [index, heading] of headings.entries()) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (index === 0) await page.getByRole('radio', { name: 'Birthday' }).click();
    if (index === 1) await page.getByRole('radio', { name: 'Medium garden', exact: false }).click();
    if (index === 2) {
      const budget = page.getByRole('slider', { name: 'Up to' });
      await budget.focus();
      const previous = Number(await budget.getAttribute('aria-valuenow'));
      await page.keyboard.down('ArrowRight');
      await expect(budget).toBeFocused();
      await expect
        .poll(async () => Number(await budget.getAttribute('aria-valuenow')))
        .toBeGreaterThan(previous);
      await page.keyboard.up('ArrowRight');
    }
    if (index === 3) await page.getByRole('radio', { name: 'Normal', exact: false }).click();
    if (visit) await visit(index);
    if (index < headings.length - 1)
      await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
}
async function plan(page: Page) {
  await page.getByRole('button', { name: 'Plan my show' }).click();
  await expect(page).toHaveURL(/session=[a-f0-9-]+/);
  await expect(page.getByRole('heading', { name: 'Your planned show', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show me something different' })).toBeEnabled();
}
async function capture(page: Page, info: TestInfo, label: string) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const section of await page.locator('[data-section]').all()) {
    const name = await section.getAttribute('data-section');
    const screenshot = await section.screenshot({
      path: `output/playwright/planner-${label}-${name}.png`,
    });
    await info.attach(`${label}-${name}`, { body: screenshot, contentType: 'image/png' });
  }
}
for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`planner age, five questions and one show at ${viewportName} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto('/shopper/stores/leeds/plan');
      await expect(page.getByRole('heading', { name: 'Before we plan' })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await capture(page, info, `${viewportName}-${theme}-age`);
      await page.getByRole('button', { name: "I'm 18 or over" }).click();
      await capture(page, info, `${viewportName}-${theme}-context`);
      await page.getByRole('button', { name: "Let's plan" }).click();
      await questions(page, async (index) =>
        capture(page, info, `${viewportName}-${theme}-question-${index + 1}`),
      );
      await plan(page);
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
      await expect(page.getByText('Preparing 3D poster', { exact: true })).toHaveCount(0);
      await capture(page, info, `${viewportName}-${theme}-show`);
      await expect(page.getByRole('button', { name: 'Change it', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Pick music' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Save to list' })).toBeDisabled();
    });
  }
}
test('reload preserves question progress and a completed plan, alternatives add no credit charge', async ({
  page,
}) => {
  await enter(page);
  await page.getByRole('radio', { name: 'Wedding' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'How much space do you have?' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous question' }).click();
  await expect(page.getByRole('radio', { name: 'Wedding' })).toHaveAttribute(
    'data-state',
    'checked',
  );
  await questions(page);
  await plan(page);
  const session = new URL(page.url()).searchParams.get('session');
  if (!session || !/^[a-f0-9-]+$/.test(session)) throw new Error('Missing session');
  const original = sql(
    `select cues from public.plan_candidates where session_id = '${session}' and rank = 1;`,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your planned show', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show me something different' }).click();
  await expect
    .poll(() => sql(`select count(*) from public.plan_candidates where session_id = '${session}';`))
    .toBe('2');
  expect(
    sql(`select cues from public.plan_candidates where session_id = '${session}' and rank = 2;`),
  ).not.toBe(original);
  expect(sql(`select count(*) from public.credit_ledger where ref_id = '${session}';`)).toBe('1');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your planned show', exact: true })).toBeVisible();
  expect(sql(`select max(rank) from public.plan_candidates where session_id = '${session}';`)).toBe(
    '2',
  );
});
test('no credits shows the unavailable state and keeps the store recovery link', async ({
  page,
}) => {
  await enter(page);
  await questions(page);
  sql(
    `insert into public.credit_reservations(id,organisation_id,credits,action,status,expires_at) values ('${HOLD}','${ORGANISATION}',1000000,'plan_session','held',now() + interval '1 hour') on conflict (id) do update set status = 'held';`,
  );
  try {
    await page.getByRole('button', { name: 'Plan my show' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      "This shop's planner is unavailable",
    );
    await expect(page.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute(
      'href',
      '/shopper/stores/leeds',
    );
  } finally {
    sql(`update public.credit_reservations set status = 'released' where id = '${HOLD}';`);
  }
});
test('alternative rate limit keeps the existing show and does not charge again', async ({
  page,
}) => {
  await enter(page);
  await questions(page);
  await plan(page);
  const session = new URL(page.url()).searchParams.get('session');
  if (!session || !/^[a-f0-9-]+$/.test(session)) throw new Error('Missing session');
  sql(
    `insert into public.rate_limit_buckets(key,tokens,refilled_at) select 'planner:alternative:' || shopper_id,0,clock_timestamp() from public.plan_sessions where id = '${session}' on conflict (key) do update set tokens = 0,refilled_at = clock_timestamp();`,
  );
  await page.getByRole('button', { name: 'Show me something different' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Please try again later');
  await expect(page.getByRole('heading', { name: 'Your planned show', exact: true })).toBeVisible();
  expect(sql(`select count(*) from public.credit_ledger where ref_id = '${session}';`)).toBe('1');
});

test('planning shows real pending work until the server result arrives', async ({ page }, info) => {
  await page.setViewportSize(viewports.phone);
  await enter(page);
  await questions(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/shopper/stores/leeds/plan', async (route) => {
    if (route.request().headers()['next-action'] === undefined) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: 'Plan my show' }).click();
    await expect(
      page.getByRole('heading', { name: 'Planning your show', exact: true }),
    ).toBeVisible();
    await capture(page, info, 'phone-pending');
  } finally {
    release();
  }
  await expect(page).toHaveURL(/session=[a-f0-9-]+/);
  await expect(page.getByRole('heading', { name: 'Your planned show', exact: true })).toBeVisible();
});
