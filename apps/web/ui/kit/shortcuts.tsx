/** Keyboard hints adapted from shadcn Kbd; the caller owns shortcut bindings. */
import type { ReactNode } from 'react';

/** Displays a keyboard key without suggesting that a binding is installed by this component. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}
/** Lists actual bindings supplied by a screen, grouped as a compact reference panel. */
export function KeyboardShortcuts({
  items,
}: {
  items: readonly { label: string; keys: readonly string[] }[];
}) {
  return (
    <section className="border-border bg-card rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">Keyboard shortcuts</h3>
      <dl className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <dt className="text-sm">{item.label}</dt>
            <dd className="flex gap-1">
              {item.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
