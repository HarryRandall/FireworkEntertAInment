import { redirect } from "next/navigation";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { PersonalDetailsForm } from "./PersonalDetailsForm";
import { SignOutButton } from "../SignOutButton";
import { getCurrentProfile } from "@/lib/admin.server";

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6">
      <PersonalDetailsForm
        initialFullName={profile.fullName ?? ""}
        initialPhone={profile.phone ?? ""}
        email={profile.email ?? ""}
        initialTheme={profile.themePreference}
      />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/45 bg-surface-container-low p-5 sm:p-6">
        <div>
          <h2 className="text-base font-bold text-on-surface">Sign out</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            End this browser session. You can sign back in any time.
          </p>
        </div>
        <SignOutButton />
      </div>

      <DeleteAccountSection />
    </div>
  );
}
