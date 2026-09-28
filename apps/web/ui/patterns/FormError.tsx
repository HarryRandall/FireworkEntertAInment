/** Shared inline form-error component used by the marketing auth forms. */

import { AlertCircle } from 'lucide-react';

export function FormError({ message }: { message: string }) {
  return (
    <div className="border-border bg-status-danger-subtle flex items-start gap-2.5 rounded-md border px-3.5 py-2.5">
      <AlertCircle size={15} className="text-status-danger mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-status-danger text-sm leading-snug">{message}</p>
    </div>
  );
}
