import { redirect } from "next/navigation";
import { LockKeyhole, Mail, Phone, User } from "lucide-react";
import { updateProfileAction } from "@/app/actions/platform-admin";
import { ThemePreferenceField } from "@/app/components/theme/ThemePreferenceField";
import { Button } from "@/app/components/ui/Button";
import { getCurrentProfile } from "@/lib/platform.server";

export default async function ProfileSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <form
      action={updateProfileAction}
      className="max-w-3xl space-y-6 rounded-xl border border-outline-variant/15 bg-surface-container-high/70 p-5 sm:p-6"
    >
      <label className="block space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Full name
        </span>
        <div className="relative">
          <User
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline"
            size={17}
          />
          <input
            name="fullName"
            defaultValue={profile.fullName ?? ""}
            className="h-12 w-full rounded-lg border border-transparent bg-surface-container-highest pl-11 pr-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 hover:border-outline-variant/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </label>

      <label className="block space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Phone
        </span>
        <div className="relative">
          <Phone
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline"
            size={17}
          />
          <input
            name="phone"
            defaultValue={profile.phone ?? ""}
            className="h-12 w-full rounded-lg border border-transparent bg-surface-container-highest pl-11 pr-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/60 hover:border-outline-variant/25 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </label>

      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Email
        </span>
        <div className="group relative flex h-12 items-center gap-3 rounded-lg border border-transparent bg-surface-container-highest/45 px-4 text-base text-on-surface-variant opacity-75 transition-colors hover:border-outline-variant/20 hover:bg-surface-container-highest/60">
          <span className="relative h-5 w-5 shrink-0 text-outline">
            <Mail
              className="absolute inset-0 transition-opacity group-hover:opacity-0"
              size={18}
            />
            <LockKeyhole
              className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
              size={18}
            />
          </span>
          <span className="truncate">{profile.email || "No email"}</span>
        </div>
      </div>

      <ThemePreferenceField initialTheme={profile.themePreference} />

      <div className="pt-2">
        <Button type="submit" className="min-w-36">
          Save profile
        </Button>
      </div>
    </form>
  );
}
