/** Marketing site layout (public, unauthenticated) shared by every `(marketing)` page. */

import type { ReactNode } from 'react';
import { MarketingNavBar } from '@/app/components/marketing/NavBar';
import { MarketingFooter } from '@/app/components/marketing/Footer';
import { SkipLink } from '@/app/components/ui/SkipLink';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-on-surface flex min-h-screen flex-col">
      <SkipLink />
      <MarketingNavBar />
      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
