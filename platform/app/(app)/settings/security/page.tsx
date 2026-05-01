import { LockKeyhole } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { PasswordChangeForm } from "./PasswordChangeForm";

export default function SecuritySettingsPage() {
  return (
    <Card elevation="high" radius="md" className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <LockKeyhole size={20} strokeWidth={1.85} />
        </span>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Security</h2>
          <p className="text-sm text-on-surface-variant">
            Manage how you sign in to ShowCrafter.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <PasswordChangeForm />
      </div>
    </Card>
  );
}
