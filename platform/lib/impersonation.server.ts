import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { ActiveImpersonation, ImpersonationIdentity } from '@/lib/impersonation.types';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

export const IMPERSONATION_RETURN_COOKIE = 'showcrafter_impersonation_return';
export const IMPERSONATION_TTL_SECONDS = 2 * 60 * 60;

type ServiceRoleClient = SupabaseClient<Database>;

export type ImpersonationEndReason = 'stopped' | 'expired' | 'sign_out' | 'error';

export function createReturnToken() {
  return randomBytes(32).toString('base64url');
}

export function hashReturnToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function impersonationCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: IMPERSONATION_TTL_SECONDS,
  };
}

export async function getImpersonationReturnToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATION_RETURN_COOKIE)?.value ?? null;
}

export async function hasImpersonationCookie(): Promise<boolean> {
  return Boolean(await getImpersonationReturnToken());
}

function identityFromProfiles(
  userId: string,
  users: Pick<Database['public']['Tables']['users']['Row'], 'id' | 'email' | 'full_name'>[],
): ImpersonationIdentity {
  const profile = users.find((row) => row.id === userId);
  return {
    id: userId,
    email: profile?.email ?? null,
    fullName: profile?.full_name ?? null,
  };
}

async function getActiveSessionByToken(
  service: ServiceRoleClient,
  token: string,
): Promise<ActiveImpersonation | null> {
  const { data: session, error } = await service
    .from('impersonation_sessions')
    .select('id, admin_user_id, target_user_id, started_at, expires_at')
    .eq('return_token_hash', hashReturnToken(token))
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !session) {
    if (error) console.error('[impersonation] active session lookup failed:', error);
    return null;
  }

  const userIds = [session.admin_user_id, session.target_user_id];
  const { data: users, error: profilesError } = await service
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds);

  if (profilesError) {
    console.error('[impersonation] profile lookup failed:', profilesError);
  }

  return {
    id: session.id,
    admin: identityFromProfiles(session.admin_user_id, users ?? []),
    target: identityFromProfiles(session.target_user_id, users ?? []),
    startedAt: session.started_at,
    expiresAt: session.expires_at,
  };
}

export const getActiveImpersonation = cache(async (): Promise<ActiveImpersonation | null> => {
  const token = await getImpersonationReturnToken();
  if (!token) return null;

  const service = createServiceRoleSupabase();
  if (!service) return null;

  return getActiveSessionByToken(service, token);
});
