import { Card } from "@/app/components/ui/Card";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { RecentSecurityActivity } from "./RecentSecurityActivity";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <Card elevation="low" radius="md" className="space-y-5 p-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-on-surface">Password</h2>
          <p className="text-sm text-on-surface-variant">
            Update the password you use to sign in to ShowCrafter.
          </p>
        </div>
        <PasswordChangeForm />
      </Card>

      <RecentSecurityActivity />
    </div>
  );
}
