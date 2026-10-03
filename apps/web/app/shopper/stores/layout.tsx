/** Public shop browsing shares poster ownership without adding a workspace shell. */
import { PosterLifetime } from '@/ui/shopper/poster-lifetime';
import { type ReactNode } from 'react';
/** Keeps the shared poster lifecycle within the public browsing subtree. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <PosterLifetime />
      {children}
    </>
  );
}
