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
  assert.match(page, /Billing status/);
  assert.match(page, /BILLING_PLANS/);
  assert.match(page, /name: 'Free'/);
  assert.match(page, /name: 'Pro'/);
  assert.match(page, /name: 'Ultra'/);
  assert.match(page, /150 starter AI credits/);
  assert.match(page, /Free is the only plan available today/);
  assert.match(page, /No purchase or upgrade flow is available/);
  assert.match(page, /There are no invoices for this account/);
  assert.ok((page.match(/price: 'Unavailable'/g) ?? []).length >= 2);
  assert.doesNotMatch(
    page,
    /3 starter show generations|20 flexible AI credits|30 show generations|100 show generations|3D site maps|Real location planning|Priority support/,
  );
  assert.doesNotMatch(page, /Next invoice|INVOICE_ROWS/);
  assert.doesNotMatch(page, /getCurrentUserAiCreditSummary/);
  assert.doesNotMatch(page, /What AI work costs/);
  assert.doesNotMatch(page, /show_generation_gpt4o/);
  assert.doesNotMatch(page, /credits\.available/);
  assert.doesNotMatch(page, /0\s*\/\s*0/);
  assert.doesNotMatch(page, /dailyRemaining/);
  assert.doesNotMatch(page, /weeklyRemaining/);
});

test('customer usage page shows the live wallet, spend limits, and recent usage', () => {
  const page = read('app/(app)/settings/usage/page.tsx');
  const loading = read('app/(app)/settings/usage/loading.tsx');
  assert.match(page, /getCurrentUserAiCreditSummary/);
  assert.match(page, /AI credit balance/);
  assert.match(page, /credits\.includedCredits/);
  assert.match(page, /credits\.balance/);
  assert.match(page, /credits\.available/);
  assert.match(page, /credits\.reserved/);
  assert.match(page, /credits\.hourlyRemaining/);
  assert.match(page, /credits\.hourlyLimit/);
  assert.match(page, /credits\.weeklyRemaining/);
  assert.match(page, /credits\.weeklyLimit/);
  assert.match(page, /The hourly limit is not an extra credit allowance/);
  assert.match(page, /RECENT_USAGE_PAGE_SIZE = 5/);
  assert.match(page, /TablePagination/);
  assert.match(page, /pageKey="usagePage"/);
  assert.match(page, /Recent usage/);
  assert.match(page, /View billing details/);
  assert.match(page, /You cannot change/);
  assert.doesNotMatch(
    page,
    /FREE_SHOWS_INCLUDED|FREE_AI_CREDITS_INCLUDED|PLAN_TIERS|Upgrade plan|Refill|Top-up credits/,
  );
  assert.doesNotMatch(page, /Credit costs/);
  assert.doesNotMatch(page, /Paid weekly plan/);
  assert.doesNotMatch(page, /Starter pack/);
  assert.doesNotMatch(page, /You are currently on Free/);
  assert.doesNotMatch(page, /show_generation_gpt4o/);
  assert.doesNotMatch(page, /show_generation_opus/);
  assert.match(loading, /AI credit balance/);
  assert.match(loading, /Usage limits/);
  assert.match(loading, /Loading current plan details/);
  assert.doesNotMatch(loading, /Free allowance|free shows|plan allowance/);
});

test('app shell renders a compact bottom-left AI credit meter', () => {
  const summaryRoute = read('app/api/me/summary/route.ts');
  const appShell = read('app/components/app/AppShell.tsx');
  const meterStart = appShell.indexOf('function SidebarAiUsageMeter');
  const meterEnd = appShell.indexOf('function AppSidebarFooter');
  assert.ok(meterStart >= 0 && meterEnd > meterStart);
  const meterBlock = appShell.slice(meterStart, meterEnd);
  // AI usage ships via /api/me/summary (not the (app) layout) so the layout
  // drops a Supabase round-trip per render; the shell fills it client-side and
  // skeletons the meter until it lands.
  assert.match(summaryRoute, /getSidebarAiUsageSummary/);
  assert.match(appShell, /nextSummary\.aiUsage/);
  assert.match(appShell, /aiUsageLoading/);
  assert.match(appShell, /Skeleton/);
  assert.match(appShell, /SidebarAiUsageMeter/);
  assert.match(meterBlock, /href="\/settings\/usage"/);
  assert.match(meterBlock, /aria-label="View AI credit usage"/);
  assert.match(meterBlock, /credits available/);
  assert.match(meterBlock, /balancePercentage/);
  assert.match(meterBlock, /Usage/);
  assert.doesNotMatch(meterBlock, /shows left|Upgrade/);
  assert.doesNotMatch(appShell, /SIDEBAR_FREE_SHOWS_INCLUDED/);
  assert.doesNotMatch(meterBlock, /Hourly/);
  assert.doesNotMatch(meterBlock, /Weekly/);
  assert.match(meterBlock, /border-sidebar-border\/75/);
  assert.doesNotMatch(meterBlock, /bg-sidebar-accent\/20/);
  assert.match(meterBlock, /usage\?\.balance/);
  assert.match(meterBlock, /usage\?\.totalGranted/);
  assert.doesNotMatch(meterBlock, /Preview balance/);
  assert.match(meterBlock, /group-data-\[collapsible=icon\]:hidden/);
  assert.match(appShell, /clearCachedAiUsage\(profileId\)/);
  assert.match(appShell, /setAiUsage\(null\)/);
});

test('AI credit reads fail closed instead of fabricating balances or history', () => {
  const credits = read('lib/ai-credits.server.ts');
  const summaryRoute = read('app/api/me/summary/route.ts');

  assert.match(credits, /export class AiCreditReadError extends Error/);
  assert.match(credits, /if \(!usage\.ok\)[\s\S]*throw new AiCreditReadError/);
  assert.match(credits, /if \(costsResult\.error\) throw new AiCreditReadError/);
  assert.match(credits, /if \(transactionsResult\.error\) throw new AiCreditReadError/);
  assert.match(credits, /if \(error\) throw new AiCreditReadError\(error\.message\)/);
  assert.doesNotMatch(credits, /fallbackBalance|FALLBACK_COSTS/);
  assert.match(summaryRoute, /error instanceof AiCreditReadError/);
  assert.match(
    credits,
    /reserveAiCredits[\s\S]*try \{[\s\S]*getAiCreditCost[\s\S]*catch \(error\)[\s\S]*ok: false/,
  );
  assert.match(credits, /\.or\('transaction_type\.neq\.reserve,status\.eq\.reserved'\)/);
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
  assert.match(
    newShowAction,
    /creditActionForGenerationMode\(generationMode, selectedCueModel \?\? undefined\)/,
  );
  assert.match(newShowAction, /showGenerationReservationKey\(show\.id\)/);
  assert.match(newShowAction, /if \(!reservation\.ok\)[\s\S]*\.from\('shows'\)[\s\S]*\.delete\(\)/);
  assert.match(newShowAction, /getShowGenerationPresentationAction/);
  assert.match(newShowAction, /getAiCreditCost/);
  assert.match(newShowAction, /generationMode === 'llm' \? requestedCueModel : null/);
  assert.match(newShowPage, /selectedCueModelCost/);
  assert.match(newShowPage, /selectedCueModelLabel/);
  assert.match(newShowPage, /generationPresentation\.fastCreditCost/);
  assert.match(newShowPage, /expectedGenerationMode/);
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
  const databaseTypes = read('lib/database.types.ts');
  const refinementMigration = read(
    'supabase/migrations/20260715091500_add_refinement_cues_atomically.sql',
  );
  assert.match(credits, /showRefinementReservationKey/);
  assert.match(previewCues, /aiCreditAction: z\.enum\(\['show_refinement'\]\)\.optional\(\)/);
  assert.match(previewCues, /reserveAiCredits/);
  assert.match(previewCues, /add_refinement_cue_and_settle_credits/);
  assert.match(previewCues, /refundAiCreditReservation/);
  assert.match(previewCues, /showRefinementReservationKey\(parsed\.data\.aiCreditReferenceId\)/);
  assert.match(previewCues, /const refinementCommitted =/);
  assert.match(previewCues, /invalidateSidebarAiUsageCache/);
  assert.match(replayViewer, /formData\.set\('aiCreditAction', 'show_refinement'\)/);
  assert.match(replayViewer, /formData\.set\('aiCreditReferenceId', crypto\.randomUUID\(\)\)/);
  assert.doesNotMatch(replayViewer, /toast\.success\(`Adding /);
  assert.match(
    replayViewer,
    /const result = await addPreviewCueAction\(formData\)[\s\S]*?toast\.success\(`Added /,
  );
  assert.match(replayViewer, /This will use \{REFINEMENT_CREDIT_COST\} AI credits/);
  assert.match(
    refinementMigration,
    /create or replace function public\.add_refinement_cue_and_settle_credits\([\s\S]*?security definer[\s\S]*?set search_path = ''/,
  );
  assert.match(
    refinementMigration,
    /insert into public\.show_timeline_items \([\s\S]*?p_refinement_id[\s\S]*?settlement := public\.settle_ai_credit_reservation/,
  );
  assert.match(
    refinementMigration,
    /if not coalesce\(\(settlement ->> 'ok'\)::boolean, false\) then[\s\S]*?raise exception/,
  );
  assert.match(
    refinementMigration,
    /revoke execute on function public\.add_refinement_cue_and_settle_credits\([\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?grant execute on function public\.add_refinement_cue_and_settle_credits\([\s\S]*?to authenticated;/,
  );
  assert.match(
    databaseTypes,
    /add_refinement_cue_and_settle_credits: \{[\s\S]*?p_refinement_id: string[\s\S]*?Returns: string/,
  );
});

test('admin billing overview and user detail expose credit balances and grant controls', () => {
  const shell = read('app/components/admin/AdminShell.tsx');
  const userDetail = read('app/(admin)/admin/users/[id]/page.tsx');
  const userHeaderActions = read('app/(admin)/admin/users/[id]/UserHeaderActions.tsx');
  const grantDialog = read('app/(admin)/admin/users/[id]/GrantAiCreditsDialog.tsx');
  const actions = read('app/actions/admin-users.ts');
  assert.match(shell, /\/admin\/billing/);
  assert.equal(existsSync(join(root, 'app/(admin)/admin/billing/page.tsx')), true);
  assert.match(userDetail, /AdminUserAiCreditsCard/);
  assert.match(userDetail, /Recent spend/);
  assert.match(userHeaderActions, /GrantAiCreditsDialog/);
  assert.match(userHeaderActions, /canManageBilling/);
  assert.match(grantDialog, /grantUserAiCreditsAction/);
  assert.match(grantDialog, /Grant AI credits/);
  assert.match(actions, /grantAiCredits/);
  assert.doesNotMatch(actions, /updateAiCreditLimits/);
});
