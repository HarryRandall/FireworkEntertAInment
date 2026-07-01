import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';
import { requirePermission } from '@/lib/admin/current-user.server';
import { getCurrentUserId } from '@/lib/current-user.server';
import { deleteCachedKeys, getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { AiUsageSummary } from '@/lib/show-summary';
import { getServerClient } from '@/utils/supabase/server-client';

type AppSupabase = SupabaseClient<Database>;

export const DEFAULT_INCLUDED_AI_CREDITS = 150;
export const DEFAULT_HOURLY_AI_CREDIT_LIMIT = 20;
export const DEFAULT_WEEKLY_AI_CREDIT_LIMIT = 150;
export const DEFAULT_SHOW_GENERATION_CREDITS = 3;
export const SHOW_REFINEMENT_CREDITS = 2;

export type AiCreditActionKey =
  | 'music_analysis'
  | 'show_generation_fast'
  | 'show_generation_gpt4o'
  | 'show_generation_sonnet'
  | 'show_generation_opus'
  | 'show_refinement'
  | 'import_video_reconstruction'
  | 'import_video_refinement';

export type AiCreditRpcResult = {
  ok: boolean;
  error?: string;
  transactionId?: string;
  alreadyApplied?: boolean;
  balance?: number;
  reserved?: number;
  available?: number;
  includedCredits?: number;
  hourlyLimit?: number;
  weeklyLimit?: number;
  hourlyUsed?: number;
  weeklyUsed?: number;
  hourlyRemaining?: number;
  weeklyRemaining?: number;
  hourlyResetAt?: string;
  weeklyResetAt?: string;
  totalGranted?: number;
  totalSpent?: number;
};

export type AiCreditTransactionSummary = {
  id: string;
  type: string;
  status: string;
  actionKey: string;
  label: string;
  amount: number;
  createdAt: string;
  referenceType: string | null;
  referenceId: string | null;
};

export type AiCreditCostSummary = {
  key: AiCreditActionKey;
  name: string;
  amount: number;
  description: string | null;
};

export type AiCreditSummary = {
  balance: number;
  reserved: number;
  available: number;
  includedCredits: number;
  hourlyLimit: number;
  weeklyLimit: number;
  hourlyUsed: number;
  weeklyUsed: number;
  hourlyRemaining: number;
  weeklyRemaining: number;
  hourlyResetAt: string | null;
  weeklyResetAt: string | null;
  totalGranted: number;
  totalSpent: number;
  costs: AiCreditCostSummary[];
  recentTransactions: AiCreditTransactionSummary[];
};

export type AdminAiCreditAccountSummary = {
  userId: string;
  email: string | null;
  fullName: string | null;
  balance: number;
  reserved: number;
  available: number;
  totalGranted: number;
  totalSpent: number;
  updatedAt: string;
};

const FALLBACK_COSTS: Record<AiCreditActionKey, AiCreditCostSummary> = {
  music_analysis: {
    key: 'music_analysis',
    name: 'Music analysis',
    amount: 1,
    description: 'Upload-scoped soundtrack analysis.',
  },
  show_generation_fast: {
    key: 'show_generation_fast',
    name: 'Fast show generation',
    amount: 1,
    description: 'Default deterministic cue planning.',
  },
  show_generation_gpt4o: {
    key: 'show_generation_gpt4o',
    name: 'GPT-4o show generation',
    amount: 1,
    description: 'Lower-cost OpenAI cue planning.',
  },
  show_generation_sonnet: {
    key: 'show_generation_sonnet',
    name: 'Claude Sonnet show generation',
    amount: DEFAULT_SHOW_GENERATION_CREDITS,
    description: 'Premium balanced cue planning.',
  },
  show_generation_opus: {
    key: 'show_generation_opus',
    name: 'Claude Opus 4 show generation',
    amount: 5,
    description: 'Highest-cost reasoning model cue planning.',
  },
  show_refinement: {
    key: 'show_refinement',
    name: 'Show refinement',
    amount: SHOW_REFINEMENT_CREDITS,
    description: 'Prompted changes to a show timeline.',
  },
  import_video_reconstruction: {
    key: 'import_video_reconstruction',
    name: 'Import video reconstruction',
    amount: 25,
    description: 'Admin product-video reconstruction.',
  },
  import_video_refinement: {
    key: 'import_video_refinement',
    name: 'Import video refinement',
    amount: 15,
    description: 'Admin prompted import refinement.',
  },
};

const ACTION_LABELS: Record<string, string> = {
  admin_credit_grant: 'Admin credit grant',
  default_preview_grant: 'Preview credit grant',
  import_video_reconstruction: 'Import video reconstruction',
  import_video_refinement: 'Import video refinement',
  music_analysis: 'Music analysis',
  show_generation_fast: 'Fast show generation',
  show_generation_gpt4o: 'GPT-4o show generation',
  show_generation_opus: 'Claude Opus show generation',
  show_generation_sonnet: 'Claude Sonnet show generation',
  show_refinement: 'Show refinement',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function parseRpcResult(value: Json | null): AiCreditRpcResult {
  if (!isRecord(value)) return { ok: false, error: 'Credit operation returned no result.' };
  return {
    ok: value.ok === true,
    error: stringValue(value.error),
    transactionId: stringValue(value.transactionId),
    alreadyApplied: booleanValue(value.alreadyApplied),
    balance: numberValue(value.balance),
    reserved: numberValue(value.reserved),
    available: numberValue(value.available),
    includedCredits: numberValue(value.includedCredits),
    hourlyLimit: numberValue(value.hourlyLimit),
    weeklyLimit: numberValue(value.weeklyLimit),
    hourlyUsed: numberValue(value.hourlyUsed),
    weeklyUsed: numberValue(value.weeklyUsed),
    hourlyRemaining: numberValue(value.hourlyRemaining),
    weeklyRemaining: numberValue(value.weeklyRemaining),
    hourlyResetAt: stringValue(value.hourlyResetAt),
    weeklyResetAt: stringValue(value.weeklyResetAt),
    totalGranted: numberValue(value.totalGranted),
    totalSpent: numberValue(value.totalSpent),
  };
}

function metadataJson(value: Record<string, Json | undefined>): Json {
  return value;
}

export function formatAiCreditAction(actionKey: string): string {
  return ACTION_LABELS[actionKey] ?? actionKey.replaceAll('_', ' ');
}

export function signedAiCreditAmount(
  transaction: Pick<AiCreditTransactionSummary, 'type' | 'amount'>,
) {
  if (transaction.type === 'grant' || transaction.type === 'refund') return transaction.amount;
  if (transaction.type === 'debit') return -transaction.amount;
  return 0;
}

function summaryFromUsage(
  usage: AiCreditRpcResult,
  costs: AiCreditCostSummary[],
  recentTransactions: AiCreditTransactionSummary[],
): AiCreditSummary {
  const fallbackBalance = DEFAULT_INCLUDED_AI_CREDITS;
  const balance = usage.ok ? (usage.balance ?? fallbackBalance) : fallbackBalance;
  const reserved = usage.ok ? (usage.reserved ?? 0) : 0;
  const totalGranted = usage.ok
    ? (usage.totalGranted ?? Math.max(balance, DEFAULT_INCLUDED_AI_CREDITS))
    : DEFAULT_INCLUDED_AI_CREDITS;
  const totalSpent = usage.ok ? (usage.totalSpent ?? Math.max(totalGranted - balance, 0)) : 0;
  const hourlyLimit = usage.hourlyLimit ?? DEFAULT_HOURLY_AI_CREDIT_LIMIT;
  const weeklyLimit = usage.weeklyLimit ?? DEFAULT_WEEKLY_AI_CREDIT_LIMIT;
  const hourlyUsed = usage.ok ? (usage.hourlyUsed ?? 0) : 0;
  const weeklyUsed = usage.ok ? (usage.weeklyUsed ?? 0) : 0;
  const hourlyRemaining = usage.ok
    ? (usage.hourlyRemaining ?? Math.max(hourlyLimit - hourlyUsed - reserved, 0))
    : hourlyLimit;
  const weeklyRemaining = usage.ok
    ? (usage.weeklyRemaining ?? Math.max(weeklyLimit - weeklyUsed - reserved, 0))
    : weeklyLimit;

  return {
    balance,
    reserved,
    available: usage.ok
      ? (usage.available ??
        Math.min(Math.max(balance - reserved, 0), hourlyRemaining, weeklyRemaining))
      : Math.min(fallbackBalance, hourlyRemaining, weeklyRemaining),
    includedCredits: usage.includedCredits ?? DEFAULT_INCLUDED_AI_CREDITS,
    hourlyLimit,
    weeklyLimit,
    hourlyUsed,
    weeklyUsed,
    hourlyRemaining,
    weeklyRemaining,
    hourlyResetAt: usage.hourlyResetAt ?? null,
    weeklyResetAt: usage.weeklyResetAt ?? null,
    totalGranted,
    totalSpent,
    costs,
    recentTransactions,
  };
}

export function showGenerationReservationKey(showId: string): string {
  return `show-generation:${showId}:reserve`;
}

const AI_USAGE_CACHE_PREFIX = 'showcrafter:ai-usage:v1';
const AI_USAGE_CACHE_TTL_SECONDS = 30;

function aiUsageCacheKey(userId: string): string {
  return `${AI_USAGE_CACHE_PREFIX}:${userId}`;
}

/** Drop the cached sidebar AI usage for a user (after a credit mutation). */
export async function invalidateSidebarAiUsageCache(userId: string): Promise<void> {
  await deleteCachedKeys([aiUsageCacheKey(userId)]);
}

/** Map the account RPC result to the sidebar usage shape with safe fallbacks. */
function sidebarUsageFromRpc(usage: AiCreditRpcResult): AiUsageSummary {
  const fallbackBalance = DEFAULT_INCLUDED_AI_CREDITS;
  const balance = usage.ok ? (usage.balance ?? fallbackBalance) : fallbackBalance;
  const reserved = usage.ok ? (usage.reserved ?? 0) : 0;
  const totalGranted = usage.ok
    ? (usage.totalGranted ?? Math.max(balance, DEFAULT_INCLUDED_AI_CREDITS))
    : DEFAULT_INCLUDED_AI_CREDITS;
  const totalSpent = usage.ok ? (usage.totalSpent ?? Math.max(totalGranted - balance, 0)) : 0;
  const hourlyLimit = usage.hourlyLimit ?? DEFAULT_HOURLY_AI_CREDIT_LIMIT;
  const weeklyLimit = usage.weeklyLimit ?? DEFAULT_WEEKLY_AI_CREDIT_LIMIT;
  const hourlyUsed = usage.ok ? (usage.hourlyUsed ?? 0) : 0;
  const weeklyUsed = usage.ok ? (usage.weeklyUsed ?? 0) : 0;
  const hourlyRemaining = usage.ok
    ? (usage.hourlyRemaining ?? Math.max(hourlyLimit - hourlyUsed - reserved, 0))
    : hourlyLimit;
  const weeklyRemaining = usage.ok
    ? (usage.weeklyRemaining ?? Math.max(weeklyLimit - weeklyUsed - reserved, 0))
    : weeklyLimit;
  return {
    balance,
    reserved,
    available: usage.ok
      ? (usage.available ??
        Math.min(Math.max(balance - reserved, 0), hourlyRemaining, weeklyRemaining))
      : Math.min(fallbackBalance, hourlyRemaining, weeklyRemaining),
    includedCredits: usage.includedCredits ?? DEFAULT_INCLUDED_AI_CREDITS,
    hourlyLimit,
    weeklyLimit,
    hourlyUsed,
    weeklyUsed,
    hourlyRemaining,
    weeklyRemaining,
    totalGranted,
    totalSpent,
  };
}

export function musicAnalysisReservationKey(analysisId: string): string {
  return `music-analysis:${analysisId}:reserve`;
}

export function showRefinementReservationKey(refinementId: string): string {
  return `show-refinement:${refinementId}:reserve`;
}

export function creditActionForGenerationMode(
  mode: 'beat' | 'fast' | 'llm',
  model?: string,
): AiCreditActionKey {
  if (mode !== 'llm') return 'show_generation_fast';

  const normalised = model?.toLowerCase() ?? '';
  if (normalised.includes('opus')) return 'show_generation_opus';
  if (
    normalised.includes('gpt-4o') ||
    normalised.includes('gpt-4.1') ||
    normalised.includes('gemini') ||
    normalised.includes('google/')
  ) {
    return 'show_generation_gpt4o';
  }
  return 'show_generation_sonnet';
}

async function getSupabase() {
  return getServerClient();
}

export async function getAiCreditCost(
  supabase: AppSupabase,
  actionKey: AiCreditActionKey,
): Promise<AiCreditCostSummary> {
  const { data, error } = await supabase
    .from('ai_credit_costs')
    .select('key, name, amount, description')
    .eq('key', actionKey)
    .maybeSingle();

  if (error || !data) return FALLBACK_COSTS[actionKey];
  return {
    key: data.key as AiCreditActionKey,
    name: data.name,
    amount: data.amount,
    description: data.description,
  };
}

export async function ensureAiCreditAccount(
  supabase: AppSupabase,
  userId: string,
): Promise<AiCreditRpcResult> {
  const { data, error } = await supabase.rpc('ensure_ai_credit_account', {
    p_user_id: userId,
  });
  if (error) return { ok: false, error: error.message };
  return parseRpcResult(data);
}

export async function reserveAiCredits(
  supabase: AppSupabase,
  params: {
    userId: string;
    actionKey: AiCreditActionKey;
    referenceType: string;
    referenceId: string;
    reservationKey: string;
    metadata?: Record<string, Json | undefined>;
  },
): Promise<AiCreditRpcResult & { reservationKey: string; amount: number }> {
  const cost = await getAiCreditCost(supabase, params.actionKey);
  if (cost.amount <= 0) {
    return {
      ok: true,
      reservationKey: params.reservationKey,
      amount: 0,
    };
  }

  const { data, error } = await supabase.rpc('reserve_ai_credits', {
    p_action_key: params.actionKey,
    p_amount: cost.amount,
    p_idempotency_key: params.reservationKey,
    p_metadata: metadataJson(params.metadata ?? {}),
    p_reference_id: params.referenceId,
    p_reference_type: params.referenceType,
    p_user_id: params.userId,
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
      reservationKey: params.reservationKey,
      amount: cost.amount,
    };
  }

  await invalidateSidebarAiUsageCache(params.userId);
  return {
    ...parseRpcResult(data),
    reservationKey: params.reservationKey,
    amount: cost.amount,
  };
}

export async function settleAiCreditReservation(
  supabase: AppSupabase,
  params: {
    userId: string;
    reservationKey: string;
    metadata?: Record<string, Json | undefined>;
  },
): Promise<AiCreditRpcResult> {
  const { data, error } = await supabase.rpc('settle_ai_credit_reservation', {
    p_idempotency_key: `${params.reservationKey}:debit`,
    p_metadata: metadataJson(params.metadata ?? {}),
    p_reservation_key: params.reservationKey,
    p_user_id: params.userId,
  });
  if (error) return { ok: false, error: error.message };
  await invalidateSidebarAiUsageCache(params.userId);
  return parseRpcResult(data);
}

export async function refundAiCreditReservation(
  supabase: AppSupabase,
  params: {
    userId: string;
    reservationKey: string;
    metadata?: Record<string, Json | undefined>;
  },
): Promise<AiCreditRpcResult> {
  const { data, error } = await supabase.rpc('refund_ai_credit_reservation', {
    p_idempotency_key: `${params.reservationKey}:refund`,
    p_metadata: metadataJson(params.metadata ?? {}),
    p_reservation_key: params.reservationKey,
    p_user_id: params.userId,
  });
  if (error) return { ok: false, error: error.message };
  await invalidateSidebarAiUsageCache(params.userId);
  return parseRpcResult(data);
}

export async function grantAiCredits(params: {
  userId: string;
  amount: number;
  note: string;
}): Promise<AiCreditRpcResult> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('grant_ai_credits', {
    p_amount: params.amount,
    p_note: params.note,
    p_idempotency_key: `admin-credit-grant:${params.userId}:${crypto.randomUUID()}`,
    p_user_id: params.userId,
  });
  if (error) return { ok: false, error: error.message };
  await invalidateSidebarAiUsageCache(params.userId);
  return parseRpcResult(data);
}

export async function getAiCreditSummaryForUser(userId: string): Promise<AiCreditSummary> {
  const supabase = await getSupabase();
  const usage = await ensureAiCreditAccount(supabase, userId);

  const [costsResult, transactionsResult] = await Promise.all([
    supabase
      .from('ai_credit_costs')
      .select('key, name, amount, description, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('ai_credit_transactions')
      .select(
        'id, transaction_type, status, action_key, amount, reference_type, reference_id, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const costs = (costsResult.data ?? []).map((cost) => ({
    key: cost.key as AiCreditActionKey,
    name: cost.name,
    amount: cost.amount,
    description: cost.description,
  }));
  const recentTransactions = (transactionsResult.data ?? []).map((transaction) => ({
    id: transaction.id,
    type: transaction.transaction_type,
    status: transaction.status,
    actionKey: transaction.action_key,
    label: formatAiCreditAction(transaction.action_key),
    amount: transaction.amount,
    createdAt: transaction.created_at,
    referenceType: transaction.reference_type,
    referenceId: transaction.reference_id,
  }));

  return summaryFromUsage(
    usage,
    costs.length ? costs : Object.values(FALLBACK_COSTS),
    recentTransactions,
  );
}

export async function getCurrentUserAiCreditSummary(): Promise<AiCreditSummary | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return getAiCreditSummaryForUser(userId);
}

/** Sidebar-sized usage for the `/api/me/summary` payload. Drops the cost
 * definitions and recent transactions that the shell meter does not render. */
export async function getSidebarAiUsageSummary(): Promise<AiUsageSummary | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const cacheKey = aiUsageCacheKey(userId);
  const cached = await getCachedJson<AiUsageSummary>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  // The sidebar only needs the usage fields from the account RPC; skip the
  // ai_credit_costs and ai_credit_transactions selects the full summary makes.
  const usage = await ensureAiCreditAccount(supabase, userId);
  const summary = sidebarUsageFromRpc(usage);
  await setCachedJson(cacheKey, summary, AI_USAGE_CACHE_TTL_SECONDS);
  return summary;
}

export async function listAdminAiCreditAccounts(): Promise<AdminAiCreditAccountSummary[]> {
  if (!(await requirePermission('admin.manage_billing'))) return [];
  const supabase = await getSupabase();
  const { data: accounts, error } = await supabase
    .from('ai_credit_accounts')
    .select('user_id, balance, reserved, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[ai-credits] list accounts failed:', error);
    return [];
  }

  const userIds = (accounts ?? []).map((account) => account.user_id);
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, email, full_name').in('id', userIds)
    : { data: [] };
  const usersById = new Map((users ?? []).map((user) => [user.id, user]));
  const usages = await Promise.all(
    (accounts ?? []).map((account) => ensureAiCreditAccount(supabase, account.user_id)),
  );
  const usageByUserId = new Map(
    (accounts ?? []).map((account, index) => [account.user_id, usages[index]] as const),
  );

  return (accounts ?? []).map((account) => {
    const user = usersById.get(account.user_id);
    const usage = usageByUserId.get(account.user_id);
    const balance = usage?.balance ?? account.balance;
    const reserved = usage?.reserved ?? account.reserved;
    return {
      userId: account.user_id,
      email: user?.email ?? null,
      fullName: user?.full_name ?? null,
      balance,
      reserved,
      available: usage?.available ?? Math.max(balance - reserved, 0),
      totalGranted: usage?.totalGranted ?? balance,
      totalSpent: usage?.totalSpent ?? 0,
      updatedAt: account.updated_at,
    };
  });
}
