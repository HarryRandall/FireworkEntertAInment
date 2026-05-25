/** Form-field primitives — Field / FieldLabel / FieldHint / FieldError — use to wrap any labelled form control. */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { uiStyles } from '@/app/components/ui/styles';

/** Vertical wrapper that stacks a label, control, and hint/error. */
export function Field({ className, children, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('space-y-2', className)} {...rest}>
      {children}
    </div>
  );
}

/** Styled label for use inside a Field. */
export function FieldLabel({
  className,
  children,
  htmlFor,
  ...rest
}: ComponentPropsWithoutRef<'label'>) {
  if (!htmlFor) {
    return <span className={cn(uiStyles.text.label, className)}>{children}</span>;
  }

  return (
    <Label htmlFor={htmlFor} className={cn(uiStyles.text.label, className)} {...rest}>
      {children}
    </Label>
  );
}

/** Muted helper text rendered below a field control. */
export function FieldHint({ className, children, ...rest }: ComponentPropsWithoutRef<'p'>) {
  return (
    <p className={cn(uiStyles.text.hint, className)} {...rest}>
      {children}
    </p>
  );
}

/** Danger-toned error text for failed validation. */
export function FieldError({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'p'> & { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className={cn(uiStyles.text.error, className)} {...rest}>
      {children}
    </p>
  );
}
