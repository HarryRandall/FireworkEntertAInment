import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Mail, Phone, User } from "lucide-react";
import { updateProfileAction } from "@/app/actions/platform-admin";
import { ThemePreferenceField } from "@/app/components/theme/ThemePreferenceField";
import { Button } from "@/app/components/ui/Button";
import { Field, FieldHint, FieldLabel } from "@/app/components/ui/Field";
import { Input } from "@/app/components/ui/Input";
import { SignOutButton } from "../SignOutButton";
import { getCurrentProfile } from "@/lib/platform.server";

type PageProps = {
  searchParams?: Promise<{ returnTo?: string }>;
};

export default async function ProfileSettingsPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const params = await searchParams;
  const returnTo =
    params?.returnTo && params.returnTo.startsWith("/admin")
      ? params.returnTo
      : null;

  return (
    <div className="space-y-6">
      {returnTo ? (
        <Link
          href={returnTo}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary"
        >
          <ArrowLeft size={16} />
          Back to admin
        </Link>
      ) : null}

      <form
        action={updateProfileAction}
        className="space-y-6 rounded-xl border border-outline-variant/45 bg-surface-container-low p-5 shadow-[var(--shadow-card)] sm:p-6"
      >
        <Field>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile.fullName ?? ""}
            iconLeft={<User size={17} />}
            placeholder="Your full name"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input
            id="phone"
            name="phone"
            defaultValue={profile.phone ?? ""}
            iconLeft={<Phone size={17} />}
            placeholder="+61 ..."
          />
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <div className="flex h-11 items-center gap-3 rounded-xl border border-outline/55 bg-surface px-4 text-sm text-on-surface-variant">
            <Mail size={17} className="text-on-surface-variant" />
            <span className="truncate">{profile.email || "No email"}</span>
            <LockKeyhole size={14} className="ml-auto text-on-surface-variant" />
          </div>
          <FieldHint className="text-xs">
            Email changes go through the security tab.
          </FieldHint>
        </Field>

        <ThemePreferenceField initialTheme={profile.themePreference} />

        <div className="pt-2">
          <Button type="submit" className="min-w-36">
            Save profile
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/45 bg-surface-container-low p-5 sm:p-6">
        <div>
          <h2 className="text-base font-bold text-on-surface">Sign out</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            End this browser session. You can sign back in any time.
          </p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
