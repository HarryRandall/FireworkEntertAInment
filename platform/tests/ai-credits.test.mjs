/** Static guards for the AI credit ledger, billing UI, and generation caps. */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('AI credit ledger migration creates a seeded wallet, costs, transactions, and admin grant RPC', () => {
  const migration = read('supabase/migrations/20260629102243_ai_credit_ledger.sql');
  assert.match(migration, /create table if not exists public\.ai_credit_accounts/);
  assert.match(migration, /balance integer not null default 0/);
  assert.match(migration, /reserved integer not null default 0/);
  assert.match(migration, /v_grant_amount integer := 150/);
  assert.match(migration, /'default_preview_grant'/);
  assert.match(migration, /create table if not exists public\.ai_credit_costs/);
  assert.match(migration, /'show_generation_gpt4o'/);
  assert.match(migration, /'show_generation_sonnet'/);
  assert.match(migration, /'show_generation_opus'/);
  assert.match(migration, /'show_refinement'/);
  assert.match(migration, /create table if not exists public\.ai_credit_transactions/);
  assert.match(migration, /transaction_type in \('grant', 'reserve', 'debit', 'refund'\)/);
  assert.match(migration, /'admin\.manage_billing'/);
  assert.match(migration, /create policy ai_credit_accounts_select_own_or_billing_admin/);
  assert.match(migration, /create or replace function public\.reserve_ai_credits/);
  assert.match(migration, /select amount into v_amount/);
  assert.match(migration, /v_hourly_limit integer := 20/);
  assert.match(migration, /v_weekly_limit integer := 150/);
  assert.match(migration, /'hourlyRemaining'/);
  assert.match(migration, /'weeklyRemaining'/);
  assert.match(migration, /create or replace function public\.settle_ai_credit_reservation/);
  assert.match(migration, /create or replace function public\.grant_ai_credits/);
  assert.doesNotMatch(migration, /daily_limit/);
  assert.doesNotMatch(migration, /update_ai_credit_limits/);
});

test('customer billing page stays billing-only without AI credit usage', () => {
  const page = read('app/(app)/settings/billing/page.tsx');
  assert.match(page, /Billing/);
  assert.match(page, /Invoices/);
  assert.match(page, /Next invoice/);
  assert.doesNotMatch(page, /getCurrentUserAiCreditSummary/);
  assert.doesNotMatch(page, /150 preview AI credits included/);
  assert.doesNotMatch(page, /What AI work costs/);
  assert.doesNotMatch(page, /show_generation_gpt4o/);
  assert.doesNotMatch(page, /credits\.available/);
  assert.doesNotMatch(page, /0\s*\/\s*0/);
  assert.doesNotMatch(page, /dailyRemaining/);
  assert.doesNotMatch(page, /weeklyRemaining/);
});

test('customer usage page shows hourly and weekly limits, recent spend, and coming-soon top-up', () => {
  const page = read('app/(app)/settings/usage/page.tsx');
  assert.match(page, /getCurrentUserAiCreditSummary/);
  assert.match(page, /AI usage/);
  assert.match(page, /Hourly limit/);
  assert.match(page, /Weekly limit/);
  assert.match(page, /Recent usage/);
  assert.doesNotMatch(page, /Credit costs/);
  assert.doesNotMatch(page, /show_generation_gpt4o/);
  assert.doesNotMatch(page, /show_generation_opus/);
  assert.match(page, /Add credits/);
  assert.match(page, /Coming soon/);
});

test('app shell renders a compact bottom-left AI credits meter', () => {
  const layout = read('app/(app)/layout.tsx');
  const appShell = read('app/components/app/AppShell.tsx');
  const meterStart = appShell.indexOf('function SidebarAiUsageMeter');
  const meterEnd = appShell.indexOf('function SidebarLimitProgress');
  const meterBlock = appShell.slice(meterStart, meterEnd);
  assert.match(layout, /getAiCreditSummaryForUser/);
  assert.match(layout, /aiUsage=/);
  assert.match(layout, /hourlyLimit: aiUsage\.hourlyLimit/);
  assert.match(appShell, /SidebarAiUsageMeter/);
  assert.match(meterBlock, /href="\/settings\/usage"/);
  assert.match(meterBlock, /AI usage/);
  assert.match(meterBlock, /Hourly/);
  assert.match(meterBlock, /Weekly/);
  assert.match(meterBlock, /border-sidebar-border\/75/);
  assert.doesNotMatch(meterBlock, /bg-sidebar-accent\/20/);
  assert.doesNotMatch(meterBlock, /usage\.available/);
  assert.doesNotMatch(meterBlock, /Preview balance/);
  assert.match(meterBlock, /group-data-\[collapsible=icon\]:hidden/);
});

test('settings links keep usage after billing', () => {
  const appShell = read('app/components/app/AppShell.tsx');
  const profileIndex = appShell.indexOf("href: '/settings/profile'");
  const notificationsIndex = appShell.indexOf("href: '/settings/notifications'");
  const billingIndex = appShell.indexOf("href: '/settings/billing'");
  const usageIndex = appShell.indexOf("href: '/settings/usage'");
  const securityIndex = appShell.indexOf("href: '/settings/security'");
  assert.ok(profileIndex < notificationsIndex);
  assert.ok(notificationsIndex < billingIndex);
  assert.ok(billingIndex < usageIndex);
  assert.ok(usageIndex < securityIndex);
});

test('show and music generation reserve, settle, and refund credits', () => {
  const newShowAction = read('app/(app)/shows/new/actions.ts');
  const newShowPage = read('app/(app)/shows/new/page.tsx');
  const runner = read('lib/cue-generation/runner.server.ts');
  const musicRoute = read('app/api/music-analysis/route.ts');
  const credits = read('lib/ai-credits.server.ts');
  assert.match(credits, /DEFAULT_INCLUDED_AI_CREDITS = 150/);
  assert.match(credits, /creditActionForGenerationMode/);
  assert.match(credits, /normalised\.includes\('gemini'\)/);
  assert.match(credits, /show_generation_opus/);
  assert.match(newShowAction, /reserveAiCredits/);
  assert.match(newShowAction, /selectedCueModel/);
  assert.match(newShowAction, /creditActionForGenerationMode\(generationMode, selectedCueModel\)/);
  assert.match(newShowAction, /showGenerationReservationKey\(show\.id\)/);
  assert.match(newShowPage, /selectedCueModelCost/);
  assert.match(newShowPage, /selectedCueModelLabel/);
  assert.match(runner, /settleAiCreditReservation/);
  assert.match(runner, /refundAiCreditReservation/);
  assert.match(musicRoute, /musicAnalysisReservationKey/);
  assert.match(musicRoute, /settleAiCreditReservation/);
  assert.match(musicRoute, /refundAiCreditReservation/);
});

test('show refinements reserve, settle, refund, and disclose credits', () => {
  const previewCues = read('app/actions/preview-cues.ts');
  const replayViewer = read('app/components/app/FireworkReplayViewer.tsx');
  const credits = read('lib/ai-credits.server.ts');
  assert.match(credits, /showRefinementReservationKey/);
  assert.match(previewCues, /aiCreditAction: z\.enum\(\['show_refinement'\]\)\.optional\(\)/);
  assert.match(previewCues, /reserveAiCredits/);
  assert.match(previewCues, /settleAiCreditReservation/);
  assert.match(previewCues, /refundAiCreditReservation/);
  assert.match(previewCues, /showRefinementReservationKey\(parsed\.data\.aiCreditReferenceId\)/);
  assert.match(replayViewer, /formData\.set\('aiCreditAction', 'show_refinement'\)/);
  assert.match(replayViewer, /formData\.set\('aiCreditReferenceId', crypto\.randomUUID\(\)\)/);
  assert.match(replayViewer, /This will use \{REFINEMENT_CREDIT_COST\} AI credits/);
});

test('admin user detail exposes credit balance, recent spend, and grant controls', () => {
  const shell = read('app/components/admin/AdminShell.tsx');
  const userDetail = read('app/(admin)/admin/users/[id]/page.tsx');
  const grantForm = read('app/(admin)/admin/users/[id]/GrantAiCreditsForm.tsx');
  const actions = read('app/actions/admin-users.ts');
  assert.doesNotMatch(shell, /\/admin\/billing/);
  assert.equal(existsSync(join(root, 'app/(admin)/admin/billing/page.tsx')), false);
  assert.match(userDetail, /AdminUserAiCreditsCard/);
  assert.match(userDetail, /GrantAiCreditsForm/);
  assert.match(userDetail, /Recent spend/);
  assert.match(grantForm, /grantUserAiCreditsAction/);
  assert.match(grantForm, /Grant/);
  assert.match(actions, /grantAiCredits/);
  assert.doesNotMatch(actions, /updateAiCreditLimits/);
});
