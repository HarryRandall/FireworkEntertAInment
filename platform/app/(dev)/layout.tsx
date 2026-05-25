/** Layout for the `(dev)` route group (developer-only Supabase examples). */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { TerminalSquare } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-on-surface flex min-h-screen flex-col">
      <div className="border-outline-variant/20 bg-surface-container-low border-b">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="text-on-surface-variant flex items-center gap-2">
            <TerminalSquare size={16} strokeWidth={1.75} className="text-primary" />
            <span className="text-primary text-xs font-bold tracking-widest uppercase">
              Dev tools
            </span>
            <span className="text-on-surface-variant/70 text-xs">
              Internal QA surfaces — not for end-user navigation.
            </span>
          </div>
          <Link href="/" className="text-primary text-xs font-medium hover:underline">
            ← Back to site
          </Link>
        </Container>
      </div>
      <main className="flex-grow">{children}</main>
    </div>
  );
}
