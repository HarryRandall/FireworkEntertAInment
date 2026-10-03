/** Account read failures remain visible with a retry control. */
'use client';
import { Button } from '@/ui/primitives/button';
/** Reports a failed account read without pretending the shopper has no data. */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Account unavailable</h1>
      <p role="alert">Your account could not be loaded. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
