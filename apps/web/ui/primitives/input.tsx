/** Token-styled shadcn text controls. */
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
const control =
  'w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-20 resize-y', className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, className)} {...props} />;
}
