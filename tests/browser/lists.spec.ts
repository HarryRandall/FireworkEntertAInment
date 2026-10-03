/** Local list, till, identity upgrade and account journeys for composer execution. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { signInAs, userId, magicLink } from './auth-helpers';

const ORGANISATION = '30000000-0000-4000-8000-000000000001';
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
    !env.includes('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421') &&
    !env.includes('NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:55421"')
  )
    throw new Error('List tests require local Supabase');
  // Load shared shopper fixtures so this spec does not depend on another spec running first.
  sql(readFileSync('tests/browser/shopper-fixtures.sql', 'utf8'));
  sql(
    `insert into public.credit_ledger(organisation_id,delta,reason,idempotency_key) values ('${ORGANISATION}',10000,'grant','browser:lists') on conflict (idempotency_key) do nothing;`,
  );
});
async function addProduct(page: Page, shop = 'leeds') {
  await page.goto(`/shopper/stores/${shop}`);
  await page
    .locator('[data-section=products]')
    .getByRole('link')
    .filter({ hasText: 'Heart Burst' })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Heart Burst', exact: true })).toBeVisible();
  await expect(async () => {
    await page.getByRole('button', { name: 'Add to my list', exact: true }).click();
    await expect(page).toHaveURL(/\/list\?id=[a-f0-9-]+$/);
  }).toPass();
  await expect(page.getByRole('heading', { name: 'My list', exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('id');
  if (!id || !/^[a-f0-9-]+$/.test(id)) throw new Error('Invalid saved list id');
  await expect(
    page
      .getByRole('img', { name: /Till barcode/ })
      .locator('rect')
      .first(),
  ).toBeVisible();
  return id;
}
async function capture(page: Page, info: TestInfo, label: string) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(label, { path, contentType: 'image/png' });
  for (const section of await page.locator('[data-section]').all()) {
    const name = await section.getAttribute('data-section');
    const sectionPath = info.outputPath(`${label}-${name}.png`);
    await section.screenshot({ path: sectionPath });
    await info.attach(`${label}-${name}`, { path: sectionPath, contentType: 'image/png' });
  }
}
async function consent(page: Page, activity: boolean, marketing: boolean) {
  const choices = page.locator('[data-section=shop-consent]');
  await choices.getByRole('checkbox', { name: /see my activity/ }).setChecked(activity);
  await choices.getByRole('checkbox', { name: /Marketing offers/ }).setChecked(marketing);
  await choices.getByRole('button', { name: 'Save shop choices' }).click();
  await expect(choices.getByRole('status')).toHaveText('Shop choices saved.');
}
test('saving a plan retains quantity, show cues and planning history without an extra charge', async ({
  page,
}) => {
  await signInAs(page, 'shopper');
  await page.goto('/shopper/stores/leeds/plan');
  await expect(async () => {
    await page.getByRole('button', { name: "I'm 18 or over" }).click();
    await expect(page.getByRole('button', { name: "Let's plan" })).toBeVisible();
  }).toPass();
  await page.getByRole('button', { name: "Let's plan" }).click();
  for (const [index, heading] of [
    "What's the occasion?",
    'How much space do you have?',
    "What's your budget?",
    'How loud?',
    'What do you love?',
  ].entries()) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (index === 0) await page.getByRole('radio', { name: 'Birthday', exact: false }).click();
    if (index === 1) await page.getByRole('radio', { name: 'Medium garden', exact: false }).click();
    if (index === 3) await page.getByRole('radio', { name: 'Normal', exact: false }).click();
    if (index < 4) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Plan my show', exact: true }).click();
  await expect(page).toHaveURL(/session=[a-f0-9-]+/);
  const session = new URL(page.url()).searchParams.get('session');
  if (!session || !/^[a-f0-9-]+$/.test(session)) throw new Error('Invalid session');
  const ledger = sql(
    `select count(*) from public.credit_ledger where organisation_id='${ORGANISATION}';`,
  );
  await page.getByRole('button', { name: 'Save to list', exact: true }).click();
  await expect(page).toHaveURL(/\/list\?id=[a-f0-9-]+$/);
  const id = new URL(page.url()).searchParams.get('id');
  if (!id || !/^[a-f0-9-]+$/.test(id)) throw new Error('Invalid list');
  expect(
    sql(
      `select sum(quantity)=(select jsonb_array_length(cues) from public.plan_candidates where id=(select plan_candidate_id from public.lists where id='${id}')) from public.list_items where list_id='${id}';`,
    ),
  ).toBe('t');
  expect(
    sql(`select count(*) from public.credit_ledger where organisation_id='${ORGANISATION}';`),
  ).toBe(ledger);
  const show = sql(`select show_id from public.show_versions where plan_session_id='${session}';`);
  await page.goto(`/account/shows/${show}`);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.goto('/account/planned');
  await expect(page.locator(`a[href$="session=${session}"]`)).toBeVisible();
});

for (const [viewportName, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark'] as const) {
    test(`list and account sections at ${viewportName} in ${theme}`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'shopper');
      const id = await addProduct(page);
      await capture(page, info, `${viewportName}-${theme}-till`);
      for (const route of [
        '/account',
        '/account/shows',
        '/account/planned',
        '/account/lists',
        `/account/lists/${id}`,
        '/account/shops',
        '/account/settings',
      ]) {
        await page.goto(route);
        await expect(page.locator('.sc-shell')).toHaveAttribute('data-hydrated', 'true');
        await capture(page, info, `${viewportName}-${theme}-${route.replaceAll('/', '-')}`);
      }
    });
  }
}
test('product quantities keep first-add prices, consent stays per shop and email keeps identity', async ({
  page,
}, info) => {
  const id = await addProduct(page);
  const shopper = await userId(page);
  const product = sql(`select product_id from public.list_items where list_id='${id}';`);
  const originalPrice = sql(
    `select unit_price_minor from public.list_items where list_id='${id}';`,
  );
  const originalCode = await page.locator('[data-till-code]').getAttribute('data-till-code');
  expect(originalCode).toMatch(/^\d{16}$/);
  const originalRangePrice = sql(
    `select price_minor from public.range_items where organisation_id='${ORGANISATION}' and product_id='${product}';`,
  );
  const otherRange = randomUUID();
  try {
    // Reuse the published product and its Leeds price; the other shop stays empty outside this test.
    sql(`
      begin;
      insert into public.range_items(id,organisation_id,product_id,price_minor,currency)
        select '${otherRange}',store.organisation_id,range.product_id,range.price_minor,range.currency
        from public.stores as store cross join public.range_items as range
        where store.slug='other-store' and range.organisation_id='${ORGANISATION}'
          and range.product_id='${product}';
      insert into public.store_items(organisation_id,store_id,range_item_id)
        select store.organisation_id,store.id,range.id
        from public.stores as store join public.range_items as range
          on range.organisation_id=store.organisation_id
        where store.slug='other-store' and range.id='${otherRange}';
      insert into public.stock_movements(organisation_id,store_id,range_item_id,delta,qty_after,source)
        select organisation_id,store_id,range_item_id,1,0,'manual'
        from public.store_items where range_item_id='${otherRange}';
      commit;
    `);
    sql(
      `update public.range_items set price_minor=price_minor+100 where organisation_id='${ORGANISATION}' and product_id='${product}';`,
    );
    await page.getByRole('button', { name: 'Increase Heart Burst quantity' }).click();
    await expect(
      page.getByRole('group', { name: 'Heart Burst quantity' }).locator('output'),
    ).toHaveText('2');
    expect(sql(`select unit_price_minor from public.list_items where list_id='${id}';`)).toBe(
      originalPrice,
    );
    await page.reload();
    await expect(
      page.getByRole('group', { name: 'Heart Burst quantity' }).locator('output'),
    ).toHaveText('2');
    expect(await page.locator('[data-till-code]').getAttribute('data-till-code')).toBe(
      originalCode,
    );
    await expect(page.getByRole('checkbox', { name: /see my activity/ })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Marketing offers/ })).not.toBeChecked();
    await consent(page, true, false);
    expect(
      sql(
        `select visible_to_shop||','||marketing_opt_in||','||consent_text_version from public.follows where shopper_id='${shopper}' and organisation_id='${ORGANISATION}';`,
      ),
    ).toBe('true,false,shopper-consent-1');
    const otherList = await addProduct(page, 'other-store');
    await consent(page, false, true);
    await page.goto(`/shopper/stores/leeds/list?id=${id}`);
    await expect(page.getByRole('checkbox', { name: /see my activity/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Marketing offers/ })).not.toBeChecked();
    const email = `lists-${randomUUID()}@example.invalid`;
    const sentAfter = new Date();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await expect(async () => {
      await page.getByRole('button', { name: 'Send account link' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Check your email' })).toBeVisible();
    }).toPass();
    await page.goto(await magicLink(page, email, sentAfter));
    await expect(page).toHaveURL(new RegExp(`/account/lists/${id}$`));
    expect(await userId(page)).toBe(shopper);
    await expect(
      page.getByRole('group', { name: 'Heart Burst quantity' }).locator('output'),
    ).toHaveText('2');
    await page.goto(`/account/lists/${otherList}`);
    await expect(page.getByRole('heading', { name: 'My list', exact: true })).toBeVisible();
    await page.goto('/account/settings');
    await page.getByRole('button', { name: 'Request data export' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Export request submitted' }),
    ).toBeVisible();
    await expect(page.getByText('Data export: pending', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Request account deletion' }).click();
    await expect(page.getByRole('group', { name: 'Confirm deletion request' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      sql(
        `select count(*) from public.privacy_requests where shopper_id='${shopper}' and kind='delete';`,
      ),
    ).toBe('0');
    await page.getByRole('button', { name: 'Request account deletion' }).click();
    await page.getByRole('button', { name: 'Confirm deletion request', exact: true }).click();
    await expect(page.getByText('Account deletion: pending', { exact: true })).toBeVisible();
    await capture(page, info, 'privacy-requests-pending');
  } finally {
    // Only temporary stock needs the append-only guard lifted, transactionally restored on failure.
    sql(`
      begin;
      alter table public.stock_movements disable trigger check_stock_movement;
      delete from public.stock_movements where range_item_id='${otherRange}';
      alter table public.stock_movements enable trigger check_stock_movement;
      delete from public.store_items where range_item_id='${otherRange}';
      delete from public.range_items where id='${otherRange}';
      update public.range_items set price_minor=${originalRangePrice}
        where organisation_id='${ORGANISATION}' and product_id='${product}';
      commit;
    `);
  }
});
