/** Truthful placeholder until notification delivery channels are implemented. */

import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function NotificationPreferences() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Notification delivery is not available yet.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border-border bg-muted/30 flex items-start gap-4 rounded-xl border p-5">
          <span className="border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-xs">
            <Bell aria-hidden size={18} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-foreground text-sm font-medium">No delivery channels configured</h2>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed text-pretty">
              ShowCrafter does not currently send configurable email, supplier stock, import, or
              digest alerts. Preferences will appear here when those delivery paths are ready.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
