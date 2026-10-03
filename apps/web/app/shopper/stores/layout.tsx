/** Public shop browsing shares poster ownership without adding a workspace shell. */
import { PosterLifetime } from '@/ui/shopper/poster-lifetime';
import { Suspense, type ReactNode } from 'react';
import { ScanEvent } from '@/ui/shopper/view-events';
/** Keeps the shared poster lifecycle within the public browsing subtree. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <PosterLifetime />
      <Suspense>
        <ScanEvent />
      </Suspense>
      {children}
    </>
  );
}
