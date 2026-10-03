/** Labelled controls and addons, composed from shadcn inputs. */
'use client';
import { useId, type ReactNode, type ComponentProps } from 'react';
import { Input } from '@/ui/primitives/input';

/** Associates a visible label, help and validation message with the control's supplied id. */
export function Field({
  id,
  label,
  help,
  error,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5 text-sm">
      <label htmlFor={id} className="font-medium">
        {label} {optional && <span className="text-muted-foreground font-normal">(optional)</span>}
      </label>
      {children}
      {(error ?? help) !== undefined && (
        <p
          id={`${id}-help`}
          className={
            error === undefined ? 'text-muted-foreground text-xs' : 'text-destructive text-xs'
          }
        >
          {error ?? help}
        </p>
      )}
    </div>
  );
}
/** Adds currency, units or actions without losing the input's accessible label. */
export function InputGroup({
  prefix,
  suffix,
  ...props
}: Omit<ComponentProps<'input'>, 'prefix'> & { prefix?: ReactNode; suffix?: ReactNode }) {
  return (
    <div className="border-input bg-card focus-within:border-ring flex h-(--field-height) min-w-0 items-stretch overflow-hidden rounded-md border text-sm">
      {prefix !== undefined && (
        <span className="border-border text-muted-foreground bg-muted flex shrink-0 items-center border-r px-2.5">
          {prefix}
        </span>
      )}
      <Input className="h-full flex-1 rounded-none border-0 bg-transparent" {...props} />
      {suffix !== undefined && (
        <span className="border-border text-muted-foreground bg-muted flex shrink-0 items-center border-l px-2.5">
          {suffix}
        </span>
      )}
    </div>
  );
}
/** Gives a child control the same label and description ids as a field. */
export function AutoField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: (id: string, description: string | undefined) => ReactNode;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} help={help}>
      {children(id, help === undefined ? undefined : `${id}-help`)}
    </Field>
  );
}
