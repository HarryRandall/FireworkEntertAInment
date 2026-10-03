/** Unexpected catalogue read failures stay visible with an explicit retry. */
'use client';
import { Button } from '@/ui/primitives/button';
import { Callout } from '@/ui/kit/feedback';
/** Offers recovery without treating a failed read as an empty catalogue. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Callout tone="danger" title="Catalogue could not be loaded">
      <p>Please retry the catalogue read.</p>
      <Button variant="outline" onClick={reset}>
        Retry
      </Button>
    </Callout>
  );
}
