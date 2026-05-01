import { KeyRound, LockKeyhole } from "lucide-react";
import { Card } from "@/app/components/ui/Card";

export default function SecuritySettingsPage() {
  return (
    <Card elevation="high" radius="md" className="p-6">
      <LockKeyhole className="mb-4 text-primary" size={22} />
      <h2 className="text-2xl font-bold text-on-surface">Security</h2>
      <div className="mt-6 rounded-xl bg-surface-container-low p-4">
        <div className="flex items-start gap-4">
          <KeyRound className="mt-1 text-primary" size={18} />
          <div>
            <h3 className="font-bold text-on-surface">Password management</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Password and email changes still run through the existing Supabase
              auth reset flow. This keeps account security separate from app
              profile edits.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
