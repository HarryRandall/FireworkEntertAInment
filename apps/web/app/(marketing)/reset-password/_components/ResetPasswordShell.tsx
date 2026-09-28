import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLockup } from '@/ui/patterns/BrandMark';

export function ResetPasswordShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="text-foreground mb-8">
        <BrandLockup />
      </Link>
      <div className="border-border bg-card w-full max-w-sm space-y-6 rounded-xl border p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}
