/** Request-scoped verified identities and server-enforced workspace boundaries. */
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server-client';
import { areas, canAccessArea, landingArea, type Area, type AccessIdentity } from './areas';

/** Loads access facts under the caller's RLS identity; unexpected read errors remain failures. */
export const getIdentity = cache(async () => {
  const client = await getServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  if (!user) return null;
  const [profile, staff, memberships, suppliers] = await Promise.all([
    client.from('profiles').select('status,is_anonymous').eq('id', user.id).single(),
    client.rpc('current_staff_role'),
    client.from('memberships').select('role').eq('profile_id', user.id),
    client.from('supplier_members').select('role').eq('profile_id', user.id),
  ]);
  for (const result of [profile, staff, memberships, suppliers]) {
    if (result.error) throw result.error;
  }
  if (!profile.data || !memberships.data || !suppliers.data)
    throw new Error('Access identity is incomplete');
  const access: AccessIdentity = {
    status: profile.data.status,
    anonymous: user.is_anonymous === true || profile.data.is_anonymous,
    staffRole: staff.data,
    retailerRoles: memberships.data.map((member) => member.role),
    supplierRoles: suppliers.data.map((member) => member.role),
  };
  return { user, access };
});
/** Refuses missing, anonymous and unauthorised identities before an area renders. */
export async function requireArea(area: Area) {
  const identity = await getIdentity();
  if (!identity || identity.access.anonymous) redirect(`/auth/sign-in?next=${areas[area].href}`);
  if (!canAccessArea(area, identity.access)) redirect('/access-denied');
  return identity;
}
/** Resolves the caller's default destination after authentication. */
export async function getLandingDestination(): Promise<string> {
  const identity = await getIdentity();
  return identity ? landingArea(identity.access) : '/auth/sign-in';
}
