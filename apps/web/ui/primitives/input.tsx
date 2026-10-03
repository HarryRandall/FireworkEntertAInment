/** Token-styled shadcn text controls. */
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
const control =
  'w-full min-w-0 rounded-md border border-input bg-card px-(--field-padding) text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';
/** Renders a 36 px field; caller classes may size specialised controls. */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-(--field-height)', className)} {...props} />;
}
/** Renders a resizable multiline field with the prototype minimum height. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        control,
        'min-h-(--textarea-min-height) resize-y py-[9px] leading-[1.45]',
        className,
      )}
      {...props}
    />
  );
}
/** Renders a native select with the same dimensions as a text field. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'h-(--field-height)', className)} {...props} />;
}
