import 'server-only';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { consumeFixedWindowRateLimits, hasRedisCache } from '@/lib/server-cache';

type RecoveryAllowance = { ok: true } | { ok: false; reason: 'rate_limited' | 'unavailable' };

function signingSecret() {
  const value = process.env.PASSWORD_RECOVERY_SIGNING_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function privateKeyPart(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

async function clientAddress() {
  const requestHeaders = await headers();
  const forwarded = process.env.VERCEL
    ? requestHeaders.get('x-vercel-forwarded-for')
    : requestHeaders.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

async function protectionContext() {
  const secret = signingSecret();
  if (!secret) return null;
  if (process.env.NODE_ENV === 'production' && !hasRedisCache()) {
    console.error('[password-recovery] shared recovery rate limits are not configured.');
    return null;
  }

  const address = await clientAddress();
  if (!address && process.env.NODE_ENV === 'production') {
    console.error('[password-recovery] verified client address is unavailable.');
    return null;
  }

  return {
    secret,
    clientKey: privateKeyPart(secret, address ?? 'local-development'),
    namespace: `showcrafter:password-recovery:v1:${privateKeyPart(
      secret,
      'rate-limit-namespace',
    ).slice(0, 24)}`,
  };
}

async function reserveLimits(limits: Parameters<typeof consumeFixedWindowRateLimits>[0]) {
  const result = await consumeFixedWindowRateLimits(limits);
  if (!result.available || (process.env.NODE_ENV === 'production' && !result.durable)) {
    return { ok: false, reason: 'unavailable' } as const;
  }
  if (!result.allowed) return { ok: false, reason: 'rate_limited' } as const;
  return { ok: true } as const;
}

/** Protect the public email request endpoint without revealing whether mail was sent. */
export async function reservePasswordRecoveryEmailRequest(
  email: string,
): Promise<RecoveryAllowance> {
  const context = await protectionContext();
  if (!context) return { ok: false, reason: 'unavailable' };

  const addressKey = privateKeyPart(context.secret, email.trim().toLowerCase());
  return reserveLimits([
    {
      key: `${context.namespace}:request:client:${context.clientKey}`,
      limit: 3,
      windowSeconds: 15 * 60,
    },
    {
      key: `${context.namespace}:request:address:${addressKey}`,
      limit: 3,
      windowSeconds: 60 * 60,
    },
    {
      key: `${context.namespace}:request:global-minute`,
      limit: 10,
      windowSeconds: 60,
    },
    {
      key: `${context.namespace}:request:global-hour`,
      // Keep headroom under the linked project's 30-request Auth OTP limit.
      limit: 20,
      windowSeconds: 60 * 60,
    },
  ]);
}

/**
 * Protect Supabase's shared `/verify` bucket and make one staged token a
 * single application attempt. All quotas are reserved atomically so rejected
 * client or token attempts cannot consume the global allowance.
 */
export async function reservePasswordRecoveryVerification(
  tokenHash: string,
): Promise<RecoveryAllowance> {
  const context = await protectionContext();
  if (!context) return { ok: false, reason: 'unavailable' };

  return reserveLimits([
    {
      key: `${context.namespace}:verify:client:${context.clientKey}`,
      limit: 5,
      windowSeconds: 15 * 60,
    },
    {
      key: `${context.namespace}:verify:token:${privateKeyPart(context.secret, tokenHash)}`,
      limit: 1,
      windowSeconds: 15 * 60,
    },
    {
      key: `${context.namespace}:verify:global-minute`,
      limit: 15,
      windowSeconds: 60,
    },
    {
      key: `${context.namespace}:verify:global-hour`,
      limit: 180,
      windowSeconds: 60 * 60,
    },
  ]);
}
