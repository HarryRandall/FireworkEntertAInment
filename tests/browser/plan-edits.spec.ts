/** Composer-run local chip, rule, persistence, layout and accessibility journeys. */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
  if (!/^NEXT_PUBLIC_SUPABASE_URL="?http:\/\/127\.0\.0\.1:55421"?$/m.test(env))
    throw new Error('Edit journeys require local Supabase');
  sql(
    "insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key) values ('30000000-0000-4000-8000-000000000001',10000,'grant','browser:plan-edits') on conflict (idempotency_key) do nothing;",
  );
});
async function clickUntil(page: Page, name: string, condition: () => Promise<void>) {
  await expect(async () => {
    await page.getByRole('button', { name, exact: true }).click();
    await condition();
  }).toPass();
}
async function start(page: Page) {
  await page.goto('/shopper/stores/leeds/plan');
  await expect(page.getByRole('heading', { name: 'Before we plan' })).toBeVisible();
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
  await expect(
    page.locator('[data-section=plan-products]').getByRole('heading', { level: 2 }),
  ).toBeVisible();
  await clickUntil(page, 'Change it', () =>
    expect(page.getByRole('heading', { name: 'Change your show' })).toBeVisible(),
  );
  return sessionId(page);
}
function sessionId(page: Page) {
  const session = new URL(page.url()).searchParams.get('session');
  if (!session || !/^[a-f0-9-]+$/.test(session)) throw new Error('Missing session UUID');
  return session;
}
function editRow(
  session: string,
  seq = 1,
): { source: string; ops: { op: string }[]; outcome: string; diff: unknown } | null {
  const result = sql(
    `select row_to_json(edit) from public.plan_edits as edit where session_id = '${session}' and seq = ${seq};`,
  );
  return result ? JSON.parse(result) : null;
}
async function applyChip(page: Page, session: string, chip: string) {
  await clickUntil(page, chip, async () => {
    await expect.poll(() => editRow(session)).not.toBeNull();
  });
  await expect(page.getByRole('button', { name: chip, exact: true })).toBeEnabled();
  const edit = editRow(session);
  expect(edit?.source).toBe('chip');
  expect(edit?.ops).toHaveLength(1);
  expect(['applied', 'infeasible']).toContain(edit?.outcome);
  if (edit?.outcome === 'applied')
    await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
  else await expect(page.locator('[data-section=plan-diff]')).toContainText('Your show is kept');
  return edit;
}
for (const chip of [
  'Longer',
  'Cheaper',
  'More crackle',
  'Bigger finale',
  'Quieter',
  'Swap this firework',
]) {
  test(`chip ${chip} persists a structured operation and an honest outcome`, async ({ page }) => {
    const session = await start(page);
    const original = sql(
      `select cues from public.plan_candidates where session_id = '${session}';`,
    );
    const edit = await applyChip(page, session, chip);
    if (edit?.outcome === 'infeasible')
      expect(sql(`select cues from public.plan_candidates where session_id = '${session}';`)).toBe(
        original,
      );
    expect(sql(`select count(*) from public.credit_ledger where ref_id = '${session}';`)).toBe('1');
  });
}
for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`edited plan diff and reload at ${viewportName} in ${theme}`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      const session = await start(page);
      expect((await applyChip(page, session, 'Cheaper'))?.outcome).toBe('applied');
      await expect(page.locator('html')).toHaveClass(new RegExp(theme));
      await expect(page.locator('[data-section=plan-diff]')).toContainText('Total before:');
      await expect(page.locator('[data-section=plan-diff]')).toContainText('Total after:');
      await expect(page.locator('[data-section=plan-diff]')).toContainText(/Added:|Removed:/);
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
      await expect(page.getByText('Preparing 3D poster', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const section of await page.locator('[data-section]').all()) {
        const name = await section.getAttribute('data-section');
        const body = await section.screenshot({
          path: `output/playwright/plan-edits-${viewportName}-${theme}-${name}.png`,
        });
        await info.attach(`${viewportName}-${theme}-${name}`, { body, contentType: 'image/png' });
      }
      const saved = sql(
        `select row_to_json(candidate) from public.plan_candidates as candidate where session_id = '${session}';`,
      );
      const title = await page
        .locator('[data-section=plan-products]')
        .getByRole('heading', { level: 2 })
        .textContent();
      await page.reload();
      await expect(
        page.locator('[data-section=plan-products]').getByRole('heading', { level: 2 }),
      ).toHaveText(title ?? '');
      await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
      expect(
        sql(
          `select row_to_json(candidate) from public.plan_candidates as candidate where session_id = '${session}';`,
        ),
      ).toBe(saved);
      expect(sql(`select count(*) from public.credit_ledger where ref_id = '${session}';`)).toBe(
        '1',
      );
    });
  }
}
test('a recognised rule is infeasible under one pound and an unknown phrase asks for clarification', async ({
  page,
}) => {
  const session = await start(page);
  const original = sql(`select cues from public.plan_candidates where session_id = '${session}';`);
  await page.getByRole('textbox', { name: 'Ask for a change' }).fill('under £1');
  await clickUntil(page, 'Send change request', async () => {
    await expect.poll(() => editRow(session)?.outcome).toBe('infeasible');
  });
  await expect(page.locator('[data-section=plan-diff]')).toContainText('Your show is kept');
  expect(editRow(session)?.source).toBe('rule');
  expect(editRow(session)?.ops).toEqual([{ op: 'set_budget', max_minor: 100 }]);
  expect(sql(`select cues from public.plan_candidates where session_id = '${session}';`)).toBe(
    original,
  );
  await expect(page.getByRole('textbox', { name: 'Ask for a change' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Ask for a change' }).fill('longer and quieter');
  await clickUntil(page, 'Send change request', async () => {
    await expect.poll(() => editRow(session, 2)?.outcome).toBe('clarify');
  });
  await expect(page.locator('[data-section=plan-diff]')).toContainText(
    'Ask for one change at a time',
  );
  expect(sql(`select cues from public.plan_candidates where session_id = '${session}';`)).toBe(
    original,
  );
});

test('a rule edit re-solves and a stale tab cannot overwrite the edited plan', async ({
  page,
  context,
}) => {
  const session = await start(page);
  const stale = await context.newPage();
  await stale.goto(`/shopper/stores/leeds/plan?session=${session}`);
  await clickUntil(stale, 'Change it', () =>
    expect(stale.getByRole('heading', { name: 'Change your show' })).toBeVisible(),
  );
  await page.getByRole('textbox', { name: 'Ask for a change' }).fill('make it cheaper');
  await clickUntil(page, 'Send change request', async () => {
    await expect.poll(() => editRow(session)?.outcome).toBe('applied');
  });
  expect(editRow(session)?.source).toBe('rule');
  await expect(page.getByRole('button', { name: 'Send change request' })).toBeEnabled();
  await clickUntil(stale, 'Longer', () =>
    expect(stale.getByRole('main').getByRole('alert')).toContainText('Reload before editing'),
  );
  expect(sql(`select count(*) from public.plan_edits where session_id = '${session}';`)).toBe('1');
  await stale.reload();
  await expect(stale.getByRole('heading', { name: 'What changed' })).toBeVisible();
  await stale.close();
});
