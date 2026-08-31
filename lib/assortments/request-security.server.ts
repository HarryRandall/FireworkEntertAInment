import 'server-only';

import { createHash } from 'crypto';
import { consumeFixedWindowRateLimits } from '@/lib/server-cache';

type AssortmentOperation = 'upload' | 'analyse' | 'generate' | 'status';

const OPERATION_LIMITS: Record<AssortmentOperation, { limit: number; windowSeconds: number }> = {
  upload: { limit: 8, windowSeconds: 60 * 60 },
  analyse: { limit: 8, windowSeconds: 60 * 60 },
  generate: { limit: 12, windowSeconds: 60 * 60 },
  status: { limit: 180, windowSeconds: 60 * 10 },
};

function requestFingerprint(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
  const agent = request.headers.get('user-agent')?.slice(0, 200) || 'unknown';
  return createHash('sha256').update(`${ip}\n${agent}`).digest('hex').slice(0, 32);
}

export async function consumeAssortmentPublicRateLimit(params: {
  request: Request;
  assortmentId: string;
  operation: AssortmentOperation;
}) {
  const rule = OPERATION_LIMITS[params.operation];
  const fingerprint = requestFingerprint(params.request);
  const result = await consumeFixedWindowRateLimits([
    {
      key: `showcrafter:assortment-qr:${params.operation}:assortment:${params.assortmentId}`,
      limit: rule.limit * 5,
      windowSeconds: rule.windowSeconds,
    },
    {
      key: `showcrafter:assortment-qr:${params.operation}:visitor:${fingerprint}`,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
    },
  ]);

  return {
    allowed: result.available && result.allowed,
    retryAfterSeconds: result.retryAfterSeconds,
    durable: result.durable,
    productionReady: process.env.NODE_ENV !== 'production' || result.durable,
  };
}
