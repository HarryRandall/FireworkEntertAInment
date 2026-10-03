/** Product shelf cards reuse one shared poster context and never mount card viewers. */
'use client';
import Link from 'next/link';
import { RENDERER_VERSION } from '@showcrafter/fireworks';
import { publicVisualUrl } from '@/lib/shopper/media';
import { useEffect, useState } from 'react';
import { poster } from '@showcrafter/fireworks/view';
import { productShots } from '@/lib/shopper/playback';
import { formatPrice, qrDestination } from '@/lib/shopper/paths';
import type { StoreProduct } from '@/lib/shopper/contracts';
import { PosterImage } from '@/ui/kit/product-picker';
import { Badge } from '@/ui/kit/feedback';

/** Shows an immutable published product with its price and movement-derived stock state. */
export function ProductCard({ product, slug }: { product: StoreProduct; slug: string }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let ownedUrl: string | undefined;
    const stored = product.playback.poster;
    if (stored?.renderer === RENDERER_VERSION) {
      setUrl(publicVisualUrl('posters', stored.path));
      setError(undefined);
      return;
    }
    setUrl(undefined);
    setError(undefined);
    async function prepare() {
      try {
        const shots = productShots(product.playback);
        const first = shots.at(0);
        if (!first) throw new Error('No published poster design');
        const blob = await poster(null, first.design, {
          shots,
          prop: product.kind === 'cake' ? 'cake' : undefined,
        });
        if (cancelled) return;
        ownedUrl = URL.createObjectURL(blob);
        setUrl(ownedUrl);
      } catch (failure) {
        if (!cancelled) {
          console.error('Product poster failed', failure);
          setError('Poster unavailable');
        }
      }
    }
    prepare().catch((failure: unknown) => {
      console.error('Poster preparation failed', failure);
    });
    return () => {
      cancelled = true;
      if (ownedUrl !== undefined) URL.revokeObjectURL(ownedUrl);
    };
  }, [product]);
  return (
    <Link
      href={qrDestination(slug, 'product', product.product_id)}
      className="focus-visible:outline-ring grid min-w-0 snap-start gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="overflow-hidden rounded-xl">
        <PosterImage
          url={url}
          error={error}
          onError={() => {
            setError('Poster unavailable');
          }}
        />
      </div>
      <strong className="text-sm">{product.name}</strong>
      <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
        <span>{product.kind === 'pack' ? 'Selection pack' : product.kind}</span>
        <b className="text-foreground tabular-nums">
          {formatPrice(product.price_minor, product.currency)}
        </b>
      </div>
      <div>
        <Badge tone={product.stock_qty > 0 ? 'success' : 'neutral'}>
          {product.stock_qty > 0 ? 'In stock' : 'Out of stock'}
        </Badge>
      </div>
    </Link>
  );
}
