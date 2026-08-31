/** Loading skeleton for the `/settings/security` route. */

import { Skeleton } from '@/app/components/ui/Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SECURITY_EVENTS = ['Last sign-in', 'Email confirmed', 'Account created'] as const;

export default function SecuritySettingsLoading() {
  return (
    <div className="space-y-5" aria-label="Loading security settings" aria-busy="true">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update the password you use to sign in to ShowCrafter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Current password</p>
            <Skeleton className="h-10 w-full rounded-md" />
            <p className="text-muted-foreground text-sm">
              Required so an open browser session cannot change credentials alone.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">New password</p>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">Confirm new password</p>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            A snapshot of your account&apos;s security events in your device&apos;s time zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y p-0">
          {SECURITY_EVENTS.map((label) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <Skeleton className="size-8 rounded-md" />
              <div className="space-y-2">
                <p className="text-foreground text-sm font-medium">{label}</p>
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
