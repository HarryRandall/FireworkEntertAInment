import { cookies } from "next/headers";
import { Clock, LogIn, MailCheck, UserPlus } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { createClient } from "@/utils/supabase/server";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelative(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.round(months / 12);
  return `${years} yr${years === 1 ? "" : "s"} ago`;
}

export async function RecentSecurityActivity() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows: {
    icon: typeof Clock;
    label: string;
    value: string;
    hint: string | null;
  }[] = [
    {
      icon: LogIn,
      label: "Last sign-in",
      value: formatDateTime(user.last_sign_in_at),
      hint: formatRelative(user.last_sign_in_at),
    },
    {
      icon: MailCheck,
      label: "Email confirmed",
      value: user.email_confirmed_at ? formatDateTime(user.email_confirmed_at) : "Not confirmed",
      hint: user.email_confirmed_at ? formatRelative(user.email_confirmed_at) : null,
    },
    {
      icon: UserPlus,
      label: "Account created",
      value: formatDateTime(user.created_at),
      hint: formatRelative(user.created_at),
    },
  ];

  return (
    <Card radius="md" className="space-y-5 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-on-surface">Recent activity</h2>
        <p className="text-sm text-on-surface-variant">
          A snapshot of your account&apos;s security events.
        </p>
      </div>
      <ul className="divide-y divide-outline-variant/45 rounded-xl border border-outline-variant/45 bg-surface-container-low">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li
              key={row.label}
              className="flex items-center gap-4 px-5 py-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant/55 bg-surface text-on-surface-variant">
                <Icon size={16} strokeWidth={1.85} />
              </span>
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-on-surface">
                  {row.label}
                </span>
                <span className="flex items-baseline gap-2 text-right">
                  <span className="font-mono text-sm tabular-nums text-on-surface">
                    {row.value}
                  </span>
                  {row.hint ? (
                    <span className="text-xs text-on-surface-variant">
                      {row.hint}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
