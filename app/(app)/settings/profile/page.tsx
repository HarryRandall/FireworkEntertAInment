/** Profile settings page wiring up the personal details form and the delete-account section. */

import { redirect } from 'next/navigation';
import { DeleteAccountSection } from './DeleteAccountSection';
import { PersonalDetailsForm } from './PersonalDetailsForm';
import { SignOutButton } from '../SignOutButton';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Sign out or permanently delete your account.</CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y p-0">
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-foreground text-sm font-medium">
                {isImpersonating ? 'Stop impersonating' : 'Sign out'}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {isImpersonating
                  ? 'Return to your admin session without signing this user out.'
                  : 'End this browser session. You can sign back in any time.'}
              </p>
            </div>
            <SignOutButton impersonating={isImpersonating} />
          </div>
          <DeleteAccountSection disabled={isImpersonating} />
        </CardContent>
      </Card>
    </div>
  );
}
