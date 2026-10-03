/** Repeater rows and split explanation/control settings surfaces. */
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';

/** Stable list data with optional icon and contextual actions. */
export interface ListItem {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}
/** Displays repeatable rows without assigning interaction to an entire row. */
export function ListRows({ items }: { items: readonly ListItem[] }) {
  return (
    <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-lg border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 p-3">
          <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-md">
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <b className="block text-sm font-medium">{item.title}</b>
            <span className="text-muted-foreground text-xs">{item.description}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">{item.actions}</div>
        </li>
      ))}
    </ul>
  );
}
/** Adds a repeater item using a full-width dashed action. */
export function AddRow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className="h-11 w-full border-dashed">
      <Plus />
      {children}
    </Button>
  );
}
/** Places an explanation left and the related controls right, stacking on phones. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border grid gap-5 border-b py-6 sm:grid-cols-[1fr_2fr]">
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </header>
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
  );
}
