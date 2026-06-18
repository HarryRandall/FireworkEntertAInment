/** Shared inline form-error component used by the marketing auth forms. */

import { AlertCircle } from 'lucide-react';

export function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-status-danger-subtle)] px-3.5 py-2.5">
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-[color:var(--color-status-danger)]" />
      <p className="text-sm leading-snug text-[color:var(--color-status-danger)]">{message}</p>
    </div>
  );
}
