/**
 * Small layout primitives for the new-show wizard's form fields.
 *
 * Kept local to this route (not in `app/components/ui`) because they bake in
 * wizard-specific spacing + a `trailing` slot that doesn't make sense
 * elsewhere. Promote them later if another flow needs the same shape.
 */
'use client';

import type { ReactNode } from 'react';

/**
 * One labelled form row with an optional helper line, leading icon, and
 * trailing summary slot.
 */
export function Field({
  label,
  required,
  helper,
  icon,
  trailing,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-content-emphasis)]">
            {icon}
            {label}
            {required ? (
              <span aria-label="required" className="text-[color:var(--color-status-danger)]">
                *
              </span>
            ) : null}
          </label>
          {helper ? (
            <p className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">{helper}</p>
          ) : null}
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

/** Small inline error message rendered below a {@link Field}. */
export function FieldError({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[color:var(--color-status-danger)]">{children}</p>;
}
