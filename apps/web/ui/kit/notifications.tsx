/** Notification inbox with explicit unread state and local selection. */
'use client';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/ui/primitives/button';

/** A synthetic or persisted notification supplied by its owning workspace. */
export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  when: string;
  unread: boolean;
}
/** Lists notifications and delegates read state to the caller. */
export function NotificationsInbox({
  items,
  onRead,
}: {
  items: readonly NotificationItem[];
  onRead: (id: string) => void;
}) {
  return (
    <section
      aria-label="Notifications"
      className="border-border bg-card overflow-hidden rounded-lg border"
    >
      <header className="border-border flex items-center gap-2 border-b p-4">
        <Bell className="size-4" />
        <h3 className="text-sm font-semibold">Notifications</h3>
      </header>
      {items.length === 0 ? (
        <p className="text-muted-foreground p-6 text-sm">You're all caught up.</p>
      ) : (
        <ul className="divide-border divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 p-4">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${item.unread ? 'bg-highlight' : 'bg-border'}`}
              />
              <div className="min-w-0 flex-1">
                <b className="text-sm font-medium">{item.title}</b>
                <p className="text-muted-foreground text-xs">
                  {item.description} · {item.when}
                </p>
                <span className="sr-only">{item.unread ? 'Unread' : 'Read'}</span>
              </div>
              {item.unread && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Mark ${item.title} as read`}
                  onClick={() => {
                    onRead(item.id);
                  }}
                >
                  <Check />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
