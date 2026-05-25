/** Security settings page combining password change and recent security activity. */

import { Card } from '@/app/components/ui/Card';
import { PasswordChangeForm } from './PasswordChangeForm';
import { RecentSecurityActivity } from './RecentSecurityActivity';

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <Card elevation="low" radius="md" className="space-y-5 p-6">
        <div className="space-y-2">
          <h2 className="text-on-surface text-2xl font-bold">Password</h2>
          <p className="text-on-surface-variant text-sm">
            Update the password you use to sign in to ShowCrafter.
          </p>
        </div>
        <PasswordChangeForm />
      </Card>

      <RecentSecurityActivity />
    </div>
  );
}
