/** Renders the user's recent sign-in / security events on the security settings page. */

import { cookies } from 'next/headers';
import { Clock, LogIn, MailCheck, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/server';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatRelative(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.round(months / 12);
  return `${years} yr${years === 1 ? '' : 's'} ago`;
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
      label: 'Last sign-in',
      value: formatDateTime(user.last_sign_in_at),
      hint: formatRelative(user.last_sign_in_at),
    },
    {
      icon: MailCheck,
      label: 'Email confirmed',
      value: user.email_confirmed_at ? formatDateTime(user.email_confirmed_at) : 'Not confirmed',
      hint: user.email_confirmed_at ? formatRelative(user.email_confirmed_at) : null,
    },
    {
      icon: UserPlus,
      label: 'Account created',
      value: formatDateTime(user.created_at),
      hint: formatRelative(user.created_at),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>A snapshot of your account&apos;s security events.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-border divide-y">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3 px-5 py-4">
                <span className="border-border bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border">
                  <Icon size={16} strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">{row.label}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    <span className="font-mono tabular-nums">{row.value}</span>
                    {row.hint ? <span className="ml-2 text-xs">{row.hint}</span> : null}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
