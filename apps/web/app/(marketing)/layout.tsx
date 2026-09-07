/** Marketing site layout (public, unauthenticated) shared by every `(marketing)` page. */

import type { ReactNode } from 'react';
import { MarketingNavBar } from '@/ui/marketing/NavBar';
import { MarketingFooter } from '@/ui/marketing/Footer';
import { SkipLink } from '@/ui/patterns/SkipLink';

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
