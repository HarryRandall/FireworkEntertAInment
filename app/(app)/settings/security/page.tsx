/** Security settings page combining password change and recent security activity. */

import { InlineAlert } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { PasswordChangeForm } from './PasswordChangeForm';
import { RecentSecurityActivity } from './RecentSecurityActivity';

export default async function SecuritySettingsPage() {
  const impersonation = await getActiveImpersonation();
  const isImpersonating = Boolean(impersonation);

  return (
    <div className="space-y-5">
      {isImpersonating ? (
        <InlineAlert tone="warning" title="Security changes are blocked while impersonating">
          Stop impersonating to return to your admin account before changing passwords or security
          settings.
        </InlineAlert>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update the password you use to sign in to ShowCrafter.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
          <PasswordChangeForm disabled={isImpersonating} />
        </CardContent>
      </Card>

      <RecentSecurityActivity />
    </div>
  );
}
