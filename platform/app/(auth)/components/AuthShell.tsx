/** Shared split-screen shell for the auth pages (login and signup). */

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { SkipLink } from '@/app/components/ui/SkipLink';
import { authIllustrationMarkup } from './authIllustration';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[color:var(--color-bg-default)]">
      <SkipLink />
      {/* Form column: tall, narrow, centred. */}
      <div className="flex w-full flex-col px-6 py-10 sm:px-10 lg:w-[480px] lg:shrink-0 lg:px-14">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[color:var(--color-content-emphasis)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]">
            <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
          </span>
          ShowCrafter
        </Link>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center py-10"
        >
          <div className="w-full max-w-sm space-y-6">{children}</div>
        </main>
      </div>

      {/* Illustration column: inline SVG, hidden on small screens. Pinned to the
          viewport height. Dark-mode treatment lives in globals.css (.auth-art-*),
          because the app themes via `data-theme`, not the `.dark` class. */}
      <div className="auth-art-panel relative isolate hidden flex-1 overflow-hidden border-l border-[color:var(--color-border-subtle)] lg:sticky lg:top-0 lg:block lg:h-screen">
        <div
          className="auth-art-svg"
          role="img"
          aria-label="Illustration of a ShowCrafter timeline launching a firework display"
          dangerouslySetInnerHTML={{ __html: authIllustrationMarkup }}
        />
      </div>
    </div>
  );
}
