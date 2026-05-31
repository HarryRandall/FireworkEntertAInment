/** Security settings page combining password change and recent security activity. */

import { Card } from '@/app/components/ui/Card';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { getActiveImpersonation } from '@/lib/impersonation.server';
import { PasswordChangeForm } from './PasswordChangeForm';
import { RecentSecurityActivity } from './RecentSecurityActivity';

export default async function SecuritySettingsPage() {
  const impersonation = await getActiveImpersonation();
  const isImpersonating = Boolean(impersonation);

  return (
    <div className="space-y-6">
      {isImpersonating ? (
        <InlineAlert tone="warning" title="Security changes are blocked while impersonating">
          Stop impersonating to return to your admin account before changing passwords or security
          settings.
        </InlineAlert>
      ) : null}

      <Card elevation="low" radius="md" className="space-y-5 p-6">
        <div className="space-y-2">
          <h2 className="text-on-surface text-2xl font-bold">Password</h2>
          <p className="text-on-surface-variant text-sm">
            Update the password you use to sign in to ShowCrafter.
          </p>
        </div>
        <PasswordChangeForm disabled={isImpersonating} />
      </Card>

      <RecentSecurityActivity />
    </div>
  );
}
