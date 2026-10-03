/** QR recovery and organisation-wide store choices use only the resolver's public slice. */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ViewEvent } from './view-events';
import { scannedDestination, storePath } from '@/lib/shopper/paths';
import { EmptyState } from '@/ui/kit/feedback';
import { Button } from '@/ui/primitives/button';

/** Presents authorised store choices for an organisation-wide shelf code. */
export function QrStoreChoices({
  stores,
  qr,
}: {
  qr: string;
  stores: {
    id: string;
    slug: string;
    name: string;
    target_type: string;
    target_id: string | null;
  }[];
}) {
  return (
    <>
      <p className="text-muted-foreground">Choose a location to see its fireworks and prices.</p>
      {stores.map((store) => (
        <Button key={store.id} asChild variant="outline">
          <Link href={scannedDestination(store.slug, store.target_type, store.target_id, qr)}>
            {store.name}
          </Link>
        </Button>
      ))}
      {stores.length === 0 ? (
        <EmptyState title="No shops available">Ask a member of staff for help.</EmptyState>
      ) : null}
    </>
  );
}
/** Explains a retired or unknown code without guessing an unauthorised store association. */
export function QrRecovery({ slug }: { slug?: string }) {
  const known = slug !== undefined;
  return (
    <EmptyState title="Let's get you back to the shop">
      <p>
        {known
          ? 'This shelf code has been retired or its target is no longer available.'
          : 'We could not find this code. Scan another shelf label or ask a member of staff.'}
      </p>
      <Button asChild className="mt-4">
        <Link href={known ? storePath(slug) : '/shopper'}>
          {known ? 'Browse this shop' : 'Open shopper page'}
        </Link>
      </Button>
    </EmptyState>
  );
}

/** Wraps a QR recovery result with one main landmark and scan call site. */
export function QrLanding({
  title,
  target,
  children,
}: {
  title: string;
  target: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-lg gap-6 px-4 py-10">
      <ViewEvent kind="qr_scan" target={target} />
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
