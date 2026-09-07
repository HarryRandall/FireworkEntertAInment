'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrentProfile } from '@/lib/admin.types';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import { toast } from '@/ui/patterns/toast';
import { SidebarFooter, useSidebar } from '@/ui/primitives/sidebar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { ProfileMenu } from './ProfileMenu';
import { signOutCurrentSession } from './sign-out.client';

export function WorkspaceAccountMenu({
  profile,
  impersonation,
  children,
}: {
  profile: CurrentProfile;
  impersonation?: ActiveImpersonation | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const { state, isMobile } = useSidebar();

  async function signOut() {
    const result = await signOutCurrentSession();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <SidebarFooter>
      {impersonation ? (
        <ImpersonationBanner
          impersonation={impersonation}
          collapsed={state === 'collapsed' && !isMobile}
        />
      ) : null}
      {children}
      <ProfileMenu
        profile={{
          displayName: profile.fullName || profile.email || 'Account',
          secondaryLine: profile.fullName && profile.email ? profile.email : '',
        }}
        onSignOut={signOut}
      />
    </SidebarFooter>
  );
}
