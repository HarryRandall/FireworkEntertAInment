'use client';

/**
 * Last-resort boundary for failures in the root layout. It replaces the whole
 * document, so it brings its own html/body and global styles.
 */

import './globals.css';
import { RouteError } from '@/ui/patterns/RouteError';

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground font-sans">
        <title>ShowCrafter | Something went wrong</title>
        <main>
          <RouteError title="ShowCrafter failed to load" onRetry={retry} className="min-h-screen">
            Something went wrong while loading the app. Try again in a moment.
          </RouteError>
        </main>
      </body>
    </html>
  );
}
