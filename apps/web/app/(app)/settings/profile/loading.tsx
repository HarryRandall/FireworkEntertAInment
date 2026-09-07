/** Loading skeleton for the `/settings/profile` route. */

import { Skeleton } from '@/components/design-system/Feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const THEME_OPTIONS = [
  { label: 'Dark', description: 'Layered black workspace' },
  { label: 'Light', description: 'Bright production view' },
  { label: 'System', description: 'Match this device' },
] as const;

export default function ProfileSettingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading personal details" aria-busy="true">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name, contact details, and interface theme.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">Full name</p>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <p className="text-foreground text-sm font-medium">Phone</p>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <p className="text-foreground text-sm font-medium">Email</p>
              <Skeleton className="h-10 w-full rounded-md" />
              <p className="text-muted-foreground text-sm">
                Email changes are handled through account security.
              </p>
            </div>
          </div>

          <div className="border-border border-t pt-6">
            <p className="text-foreground mb-3 text-sm font-medium">Interface theme</p>
            <div className="grid gap-3 md:grid-cols-3">
              {THEME_OPTIONS.map((option) => (
                <div key={option.label} className="border-border min-h-28 rounded-xl border p-4">
                  <Skeleton className="size-8 rounded-lg" />
                  <p className="text-foreground mt-3 text-sm font-medium">{option.label}</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {option.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Sign out or permanently delete your account.</CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y p-0">
          {[
            {
              title: 'Session',
              description: 'Loading the action available for this browser session.',
            },
            {
              title: 'Delete account',
              description:
                'Permanently remove your account, profile, and any shows you own. This cannot be undone.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="text-foreground text-sm font-medium">{item.title}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
