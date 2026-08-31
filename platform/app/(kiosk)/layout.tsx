import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BrandLockup } from '@/app/components/ui/BrandMark';
import { SkipLink } from '@/app/components/ui/SkipLink';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-on-surface min-h-dvh">
      <SkipLink />
      <header className="border-border/70 border-b">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <BrandLockup className="text-lg" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </div>
  );
}
