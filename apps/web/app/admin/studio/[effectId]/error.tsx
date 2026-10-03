/** Unexpected Studio read failures remain visible and retryable. */
'use client';
import { Button } from '@/ui/primitives/button';
/** Retains a visible failure boundary rather than replacing failed reads with an empty design. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid gap-4 p-6">
      <h1 className="text-xl font-semibold">Studio could not load</h1>
      <p role="alert">The firework design could not be read. Please retry.</p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
