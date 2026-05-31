/** Profile settings page wiring up the personal details form and the delete-account section. */

import { redirect } from 'next/navigation';
import { DeleteAccountSection } from './DeleteAccountSection';
import { PersonalDetailsForm } from './PersonalDetailsForm';
import { SignOutButton } from '../SignOutButton';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { getCurrentProfile } from '@/lib/admin.server';
import { getActiveImpersonation } from '@/lib/impersonation.server';

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const impersonation = await getActiveImpersonation();
  const isImpersonating = Boolean(impersonation);

  return (
    <div className="space-y-6">
      {isImpersonating ? (
        <InlineAlert tone="warning" title="Account security is disabled while impersonating">
          You can edit profile details for support, but password changes and account deletion are
          blocked until impersonation stops.
        </InlineAlert>
      ) : null}

      <PersonalDetailsForm
        initialFullName={profile.fullName ?? ''}
        initialPhone={profile.phone ?? ''}
        email={profile.email ?? ''}
        initialTheme={profile.themePreference}
      />

      <div className="border-outline-variant/45 bg-surface-container-low flex items-center justify-between gap-4 rounded-xl border p-5 sm:p-6">
        <div>
          <h2 className="text-on-surface text-base font-bold">
            {isImpersonating ? 'Stop impersonating' : 'Sign out'}
          </h2>
          <p className="text-on-surface-variant mt-1 text-sm">
            {isImpersonating
              ? 'Return to your admin session without signing this user out.'
              : 'End this browser session. You can sign back in any time.'}
          </p>
        </div>
        <SignOutButton impersonating={isImpersonating} />
      </div>

      <DeleteAccountSection disabled={isImpersonating} />
    </div>
  );
}
