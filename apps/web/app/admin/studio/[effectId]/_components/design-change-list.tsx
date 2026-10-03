/** Stored-value differences share one accessible presentation in review and history. */
import type { DesignChange } from '@/lib/studio/diff';

/** Shows every change with wrapping values, including added and removed fields. */
export function DesignChangeList({ changes }: { changes: DesignChange[] }) {
  return changes.length > 0 ? (
    <ul className="grid gap-2" aria-label="Design changes">
      {changes.map((change) => (
        <li
          key={change.key}
          className="border-border bg-background grid min-w-0 gap-1 rounded-lg border p-3 text-sm"
        >
          <span className="font-medium break-words">{change.label}</span>
          <span className="text-muted-foreground break-all">
            <span className="sr-only">Before: </span>
            <del>{change.from}</del>
          </span>
          <span className="break-all">
            <span aria-hidden="true">→ </span>
            <span className="sr-only">After: </span>
            {change.to}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground text-sm">Nothing changed.</p>
  );
}
