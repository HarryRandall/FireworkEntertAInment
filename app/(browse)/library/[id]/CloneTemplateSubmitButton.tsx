'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function CloneTemplateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-glow-action inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-[var(--shadow-cta)] transition-[background-color,transform,opacity] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 sm:w-fit"
    >
      {pending ? (
        <Loader2 aria-hidden="true" size={16} className="animate-spin motion-reduce:animate-none" />
      ) : (
        <Wand2 aria-hidden="true" size={16} />
      )}
      <span aria-live="polite">{pending ? 'Creating…' : 'Create from template'}</span>
    </button>
  );
}
