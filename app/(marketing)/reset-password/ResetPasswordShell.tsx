import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLockup } from '@/app/components/ui/BrandMark';

export function ResetPasswordShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--color-bg-muted)] px-4 py-12">
      <Link href="/" className="mb-8 text-[color:var(--color-content-emphasis)]">
        <BrandLockup />
      </Link>
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
