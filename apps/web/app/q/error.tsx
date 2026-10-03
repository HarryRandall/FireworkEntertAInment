/** Public data failures remain visible rather than appearing as an empty range. */
'use client';
import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
/** Offers retry and a safe exit after a failed public data or validation boundary. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto grid max-w-lg gap-5 p-6">
      <h1 className="text-2xl font-semibold">The shop could not load</h1>
      <p role="alert">
        We could not read the shop's current fireworks and prices. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
      <Button asChild variant="outline">
        <Link href="/shopper">Open shopper page</Link>
      </Button>
    </main>
  );
}
