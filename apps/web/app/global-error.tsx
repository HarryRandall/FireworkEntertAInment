'use client';

import './globals.css';

/** Shows the application error boundary with an explicit retry action. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
          <h1 className="text-3xl font-semibold">ShowCrafter failed to load.</h1>
          <p className="text-muted-foreground">Try again in a moment.</p>
          <button
            className="bg-primary text-primary-foreground w-fit rounded-md px-4 py-2"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
