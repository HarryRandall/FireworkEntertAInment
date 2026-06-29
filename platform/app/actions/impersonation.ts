'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/admin.server';
import {
  createReturnToken,
  hashReturnToken,
  impersonationCookieOptions,
  IMPERSONATION_RETURN_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  type ImpersonationEndReason,
} from '@/lib/impersonation.server';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

type ActionResult = { ok: false; error: string };
type ServiceRoleClient = NonNullable<ReturnType<typeof createServiceRoleSupabase>>;

const StartImpersonationSchema = z.object({
  targetUserId: z.string().uuid(),
});

type TargetUser = {
  id: string;
  email: string;
  fullName: string | null;
  status: string;
};

function requestIpFromHeaders(headerStore: Headers): string | null {
  const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headerStore.get('x-real-ip')?.trim();
  return (forwardedFor || realIp || null)?.slice(0, 255) ?? null;
}

function clearReturnCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(IMPERSONATION_RETURN_COOKIE, '', {
    ...impersonationCookieOptions(),
    maxAge: 0,
  });
}

async function loadTargetUser(
  service: ServiceRoleClient,
  targetUserId: string,
): Promise<{ user: TargetUser | null; error: string | null }> {
  const [{ data: profile, error: profileError }, { data: authUser, error: authError }] =
    await Promise.all([
      service
        .from('users')
        .select('id, email, full_name, status')
        .eq('id', targetUserId)
        .maybeSingle(),
      service.auth.admin.getUserById(targetUserId),
    ]);

  if (profileError) {
    console.error('[impersonation] target profile lookup failed:', profileError);
    return { user: null, error: 'Could not load that user.' };
  }
  if (authError) {
    console.error('[impersonation] target auth lookup failed:', authError);
    return { user: null, error: 'Could not load that user.' };
  }
  if (!profile || !authUser.user) return { user: null, error: 'User not found.' };

  const email = authUser.user.email ?? profile.email;
  if (!email) {
    return { user: null, error: 'That user does not have an email address.' };
  }

  return {
    user: {
      id: profile.id,
      email,
      fullName: profile.full_name,
      status: profile.status,
    },
    error: null,
  };
}

async function switchSessionWithMagicLink(
  service: ServiceRoleClient,
  requestClient: ReturnType<typeof createClient>,
  params: { userId: string; email: string },
): Promise<{ ok: true } | ActionResult> {
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: params.email,
  });
  if (linkError) {
    console.error('[impersonation] magic link generation failed:', linkError);
    return { ok: false, error: 'Could not create an impersonation session.' };
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    return { ok: false, error: 'Could not create an impersonation session.' };
  }

  const { data: verifyData, error: verifyError } = await requestClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError || verifyData.user?.id !== params.userId) {
    if (verifyError) console.error('[impersonation] session verification failed:', verifyError);
    return { ok: false, error: 'Could not switch sessions.' };
  }

  return { ok: true };
}

async function markImpersonationEnded(
  service: ServiceRoleClient,
  sessionId: string,
  reason: ImpersonationEndReason,
) {
  const { error } = await service
    .from('impersonation_sessions')
    .update({
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq('id', sessionId);

  if (error) console.error('[impersonation] could not end audit row:', error);
}

async function restoreAdminSession(
  service: ServiceRoleClient,
  requestClient: ReturnType<typeof createClient>,
  adminUserId: string,
  adminEmail: string | null,
): Promise<{ ok: true } | ActionResult> {
  let email = adminEmail;
  if (!email) {
    const { data, error } = await service.auth.admin.getUserById(adminUserId);
    if (error) {
      console.error('[impersonation] admin auth lookup failed:', error);
      return { ok: false, error: 'Could not restore the admin session.' };
    }
    email = data.user?.email ?? null;
  }
  if (!email) return { ok: false, error: 'Could not restore the admin session.' };

  return switchSessionWithMagicLink(service, requestClient, {
    userId: adminUserId,
    email,
  });
}

export async function startImpersonationAction(input: {
  targetUserId: string;
}): Promise<ActionResult> {
  const admin = await requirePermission('admin.impersonate_users');
  if (!admin) return { ok: false, error: 'Not permitted.' };

  const parsed = StartImpersonationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid user.' };
  if (parsed.data.targetUserId === admin.id) {
    return { ok: false, error: 'You cannot impersonate your own account.' };
  }

  const service = createServiceRoleSupabase();
  if (!service) {
    return {
      ok: false,
      error: 'Impersonation is unavailable. Configure SUPABASE_SERVICE_ROLE_KEY.',
    };
  }

  const { user: target, error: targetError } = await loadTargetUser(
    service,
    parsed.data.targetUserId,
  );
  if (!target) return { ok: false, error: targetError ?? 'User not found.' };
  if (target.status !== 'active')
    return { ok: false, error: 'Suspended users cannot be impersonated.' };

  const returnToken = createReturnToken();
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000).toISOString();
  const headerStore = await headers();

  const { data: auditRow, error: auditError } = await service
    .from('impersonation_sessions')
    .insert({
      admin_user_id: admin.id,
      target_user_id: target.id,
      return_token_hash: hashReturnToken(returnToken),
      expires_at: expiresAt,
      user_agent: headerStore.get('user-agent')?.slice(0, 1000) ?? null,
      ip_address: requestIpFromHeaders(headerStore),
    })
    .select('id')
    .single();
  if (auditError || !auditRow) {
    console.error('[impersonation] audit row insert failed:', auditError);
    return { ok: false, error: 'Could not start impersonation.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_RETURN_COOKIE, returnToken, impersonationCookieOptions());
  const requestClient = createClient(cookieStore);
  const switchResult = await switchSessionWithMagicLink(service, requestClient, {
    userId: target.id,
    email: target.email,
  });
  if (!switchResult.ok) {
    await markImpersonationEnded(service, auditRow.id, 'error');
    clearReturnCookie(cookieStore);
    await restoreAdminSession(service, requestClient, admin.id, admin.email);
    return switchResult;
  }

  redirect('/home');
}

export async function stopImpersonationAction(
  reason: ImpersonationEndReason = 'stopped',
): Promise<ActionResult> {
  const service = createServiceRoleSupabase();
  const cookieStore = await cookies();
  const returnToken = cookieStore.get(IMPERSONATION_RETURN_COOKIE)?.value;
  if (!service || !returnToken) {
    clearReturnCookie(cookieStore);
    return { ok: false, error: 'No active impersonation session was found.' };
  }

  const { data: session, error: sessionError } = await service
    .from('impersonation_sessions')
    .select('id, admin_user_id, target_user_id')
    .eq('return_token_hash', hashReturnToken(returnToken))
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (sessionError || !session) {
    if (sessionError) console.error('[impersonation] stop lookup failed:', sessionError);
    clearReturnCookie(cookieStore);
    return { ok: false, error: 'This impersonation session has expired.' };
  }

  const { data: profile } = await service
    .from('users')
    .select('email')
    .eq('id', session.admin_user_id)
    .maybeSingle();

  const requestClient = createClient(cookieStore);
  const restoreResult = await restoreAdminSession(
    service,
    requestClient,
    session.admin_user_id,
    profile?.email ?? null,
  );
  if (!restoreResult.ok) return restoreResult;

  await markImpersonationEnded(service, session.id, reason);
  clearReturnCookie(cookieStore);
  redirect(`/admin/users/${session.target_user_id}`);
}
