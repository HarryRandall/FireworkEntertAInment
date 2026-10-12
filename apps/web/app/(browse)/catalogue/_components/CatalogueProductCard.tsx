/** Catalogue grid card: hover to play, click through to the product page. */

import { Clock3, Layers3, MoveVertical } from 'lucide-react';
import type { FireworkSpecification } from '@/lib/show-domain';
import { formatBudget, formatDuration, formatManufacturerLabel } from '@/lib/show-domain';
import { productColours } from '@/lib/catalogue-browse';
import { fireworkPreviewImageUrl, withFireworkPreviewRevision } from '@/lib/firework-preview-image';
import { FireworkBrowseCard } from '@/ui/catalogue/FireworkBrowseCard';
import { ColourSwatches } from '@/ui/catalogue/ColourSwatches';

export function catalogueProductPreviewUrl(
  product: Pick<FireworkSpecification, 'id' | 'previewImageRevision'>,
) {
  return withFireworkPreviewRevision(
    `/api/catalogue/${product.id}/preview`,
    product.previewImageRevision,
  );
}

export function CatalogueProductCard({ product }: { product: FireworkSpecification }) {
  const shotCount = product.shotCount ?? 1;
  const colours = productColours(product);

  return (
    <FireworkBrowseCard
      previewId={`catalogue-${product.id}`}
      previewUrl={catalogueProductPreviewUrl(product)}
      persistedPosterUrl={fireworkPreviewImageUrl(product.previewImagePath)}
      label={product.name}
      href={`/catalogue/${product.id}`}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-foreground line-clamp-2 text-sm leading-5 font-semibold">
              {product.name}
            </h2>
            <p className="text-muted-foreground mt-1 truncate text-xs">
              {[
                product.baseEffect?.name,
                product.caliber,
                formatManufacturerLabel(product.manufacturer),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {product.minPriceCents != null ? (
            <span className="text-foreground shrink-0 font-mono text-sm font-medium tabular-nums">
              {formatBudget(product.minPriceCents)}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Layers3 size={13} aria-hidden />
              <span className="tabular-nums">
                {shotCount.toLocaleString()} {shotCount === 1 ? 'shot' : 'shots'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} aria-hidden />
              <span className="font-mono tabular-nums">
                {formatDuration(product.durationSeconds)}
              </span>
            </span>
            {product.heightMeters != null ? (
              <span className="inline-flex items-center gap-1.5">
                <MoveVertical size={13} aria-hidden />
                <span className="font-mono tabular-nums">{Math.round(product.heightMeters)} m</span>
              </span>
            ) : null}
          </div>
          <ColourSwatches colours={colours} />
        </div>
      </div>
    </FireworkBrowseCard>
  );
}
