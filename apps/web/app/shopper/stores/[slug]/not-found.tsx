/** Unavailable public targets retain a local route back to their shop. */
import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
/** Reports a hidden, unpublished or missing public target without disclosing its data. */
export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-lg gap-5 p-6">
      <h1 className="text-2xl font-semibold">This page is unavailable</h1>
      <p>
        The shop or firework may no longer be available. Scan another label or ask staff for help.
      </p>
      <Button asChild variant="outline">
        <Link href="/shopper">Open shopper page</Link>
      </Button>
    </main>
  );
}
