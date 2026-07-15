import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

export function ResetPasswordShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--color-bg-muted)] px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight text-[color:var(--color-content-emphasis)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]">
          <Sparkles size={14} strokeWidth={2.2} />
        </span>
        ShowCrafter
      </Link>
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
