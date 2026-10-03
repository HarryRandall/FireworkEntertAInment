/** Poster read failures remain distinct from an empty maintenance queue. */
'use client';
import { Button } from '@/ui/primitives/button';
/** Offers a route retry without claiming failed catalogue reads are up-to-date posters. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-semibold">Posters</h1>
      <p role="alert">The poster queue could not be loaded.</p>
      <Button onClick={reset}>Retry loading posters</Button>
    </section>
  );
}
