'use client';

import { Copy } from 'lucide-react';
import { toast } from '@/components/design-system';
import { cn } from '@/lib/utils';

type InlineCopyButtonProps = {
  value: string;
  label: string;
  successMessage: string;
  className?: string;
};

export function InlineCopyButton({
  value,
  label,
  successMessage,
  className,
}: InlineCopyButtonProps) {
  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void copyValue();
      }}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[color:var(--color-content-subtle)] opacity-0 transition group-focus-within/identity:opacity-100 group-hover/identity:opacity-100 hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)] focus:opacity-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]',
        className,
      )}
    >
      <Copy size={13} strokeWidth={1.8} />
    </button>
  );
}
