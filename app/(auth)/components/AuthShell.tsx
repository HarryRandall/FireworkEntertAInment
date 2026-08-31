/** Shared split-screen shell for the auth pages (login and signup). */

import Link from 'next/link';
import { SkipLink } from '@/components/design-system/SkipLink';
import { BrandLockup } from '@/components/design-system/BrandMark';
import { authIllustrationMarkup } from './authIllustration';
import styles from './AuthShell.module.css';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[color:var(--color-bg-default)]">
      <SkipLink />
      <div className="flex w-full flex-col px-6 py-10 sm:px-10 lg:w-[480px] lg:shrink-0 lg:px-14">
        <Link href="/" className="text-[color:var(--color-content-emphasis)]">
          <BrandLockup />
        </Link>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center py-10"
        >
          <div className="w-full max-w-sm space-y-6">{children}</div>
        </main>
      </div>

      <div
        className={`${styles.artPanel} relative isolate hidden flex-1 overflow-hidden border-l border-[color:var(--color-border-subtle)] lg:sticky lg:top-0 lg:block lg:h-screen`}
      >
        <div
          className={styles.artwork}
          role="img"
          aria-label="Illustration of a ShowCrafter timeline launching a firework display"
          dangerouslySetInnerHTML={{ __html: authIllustrationMarkup }}
        />
      </div>
    </div>
  );
}
