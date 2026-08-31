/** Renders the user's recent sign-in / security events on the security settings page. */

import { cookies } from 'next/headers';
import { Clock, LogIn, MailCheck, UserPlus } from 'lucide-react';
import { LocalSecurityEventTime } from './LocalSecurityEventTime';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/server';

export async function RecentSecurityActivity() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    console.error('[RecentSecurityActivity] auth read failed:', error);
    throw new Error('Security activity could not be loaded.');
  }
  if (!user) return null;

  const rows: {
    icon: typeof Clock;
    label: string;
    timestamp: string | null;
    fallback?: string;
  }[] = [
    {
      icon: LogIn,
      label: 'Last sign-in',
      timestamp: user.last_sign_in_at ?? null,
    },
    {
      icon: MailCheck,
      label: 'Email confirmed',
      timestamp: user.email_confirmed_at ?? null,
      fallback: 'Not confirmed',
    },
    {
      icon: UserPlus,
      label: 'Account created',
      timestamp: user.created_at,
    },
  ];

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          A snapshot of your account&apos;s security events in your device&apos;s time zone.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-border divide-y">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="border-border bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
                  <Icon aria-hidden="true" size={15} strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">{row.label}</p>
                  {row.timestamp ? (
                    <LocalSecurityEventTime value={row.timestamp} />
                  ) : (
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {row.fallback ?? 'Unavailable'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
