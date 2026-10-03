/** Retailer show shelf tiles share poster rendering and link to the full playback page. */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { poster } from '@showcrafter/fireworks/view';
import { showShots } from '@/lib/shopper/playback';
import { formatPrice, qrDestination } from '@/lib/shopper/paths';
import type { ShowPage } from '@/lib/shopper/contracts';
import { PlannedShowCard } from '@/ui/kit/show-card';

const MS_PER_SECOND = 1000; // Stored show duration is milliseconds; shopper labels use seconds.
/** Presents one playable retailer show using the shared kit card and one poster context. */
export function ShowCard({ show, slug }: { show: ShowPage; slug: string }) {
  const router = useRouter();
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let ownedUrl: string | undefined;
    async function prepare() {
      const shots = showShots(show);
      const first = shots.at(0);
      if (!first) throw new Error('Show has no published shots');
      const blob = await poster(null, first.design, { shots });
      if (cancelled) return;
      ownedUrl = URL.createObjectURL(blob);
      setUrl(ownedUrl);
    }
    prepare().catch((failure: unknown) => {
      if (!cancelled) {
        console.error('Show poster failed', failure);
        setError('Poster unavailable');
      }
    });
    return () => {
      cancelled = true;
      if (ownedUrl !== undefined) URL.revokeObjectURL(ownedUrl);
    };
  }, [show]);
  return (
    <PlannedShowCard
      title={show.name}
      description={show.available ? 'Available at this shop' : 'Some fireworks are out of stock'}
      price={formatPrice(show.price_minor, show.currency)}
      duration={`${String(Math.ceil(show.duration_ms / MS_PER_SECOND))} seconds`}
      itemCount={show.products.reduce((total, item) => total + item.quantity, 0)}
      energy={[]}
      tags={[]}
      poster={url}
      posterError={error}
      selected={false}
      onSelect={() => {
        router.push(qrDestination(slug, 'show', show.id));
      }}
    />
  );
}
