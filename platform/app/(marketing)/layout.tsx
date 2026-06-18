/** Marketing site layout (public, unauthenticated) shared by every `(marketing)` page. */

import type { ReactNode } from 'react';
import { MarketingNavBar } from '@/app/components/marketing/NavBar';
import { MarketingFooter } from '@/app/components/marketing/Footer';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-on-surface flex min-h-screen flex-col">
      <MarketingNavBar />
      <main className="flex-grow">{children}</main>
      <MarketingFooter />
    </div>
  );
}
