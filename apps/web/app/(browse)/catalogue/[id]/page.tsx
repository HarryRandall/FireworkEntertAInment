/** Public product page: playable preview, a plain summary, key specs and shot sequence. */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  catalogueHref,
  catalogueProductSummary,
  colourFamilyLabel,
  isReadableDescription,
  productColourFamilies,
  productColours,
  relatedCatalogueProducts,
} from '@/lib/catalogue-browse';
import {
  getCatalogueProduct,
  listCatalogueShots,
  type CatalogueShot,
} from '@/lib/catalogue-detail.server';
import { fireworkPreviewImageUrl } from '@/lib/firework-preview-image';
import { formatBudget, formatDurationWords, formatManufacturerLabel } from '@/lib/show-domain';
import { FireworkBrowseCard } from '@/ui/catalogue/FireworkBrowseCard';
import { FireworkBrowsePreviewProvider } from '@/ui/catalogue/FireworkBrowsePreviewContext';
import { ColourSwatches } from '@/ui/catalogue/ColourSwatches';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert } from '@/ui/patterns/Feedback';
import {
  CatalogueProductCard,
  catalogueProductPreviewUrl,
} from '@/app/(browse)/catalogue/_components/CatalogueProductCard';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getCatalogueProduct(id);
  if (!result) return { title: 'Firework not found' };
  return {
    title: `${result.product.name} | Firework catalogue`,
    description: catalogueProductSummary(result.product),
  };
}

async function loadShots(productId: string): Promise<CatalogueShot[] | null> {
  try {
    return await listCatalogueShots(productId);
  } catch (error) {
    console.error(`[catalogue] shot sequence ${productId} failed:`, error);
    return null;
  }
}

export default async function CatalogueProductPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getCatalogueProduct(id);
  if (!result) notFound();
  const { product, catalogue } = result;

  const shotCount = product.shotCount ?? 1;
  const isMultishot = shotCount > 1;
  const shots = isMultishot ? await loadShots(product.id) : [];
  const shotHeights = (shots ?? [])
    .map((shot) => shot.heightMeters)
    .filter((height): height is number => height != null);
  const height = shotHeights.length > 0 ? Math.max(...shotHeights) : product.heightMeters;
  const colours = productColours(product, 8);
  const families = [...productColourFamilies(product)];
  const related = relatedCatalogueProducts(product, catalogue, 4);

  const specs: Array<{ label: string; value: string }> = [
    { label: 'Shots', value: shotCount.toLocaleString() },
    {
      label: isMultishot ? 'Runs for' : 'Burst lasts',
      value: formatDurationWords(product.durationSeconds),
    },
    {
      label: isMultishot ? 'Peak height' : 'Height',
      value: height != null ? `${Math.round(height)} m` : 'Unknown',
    },
    { label: 'Calibre', value: product.caliber ?? 'Unknown' },
    { label: 'Made by', value: formatManufacturerLabel(product.manufacturer) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10">
      <Link
        href="/catalogue"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={15} aria-hidden />
        Catalogue
      </Link>

      <FireworkBrowsePreviewProvider>
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] lg:gap-12">
          <FireworkBrowseCard
            previewId={`catalogue-detail-${product.id}`}
            previewUrl={catalogueProductPreviewUrl(product)}
            persistedPosterUrl={fireworkPreviewImageUrl(product.previewImagePath)}
            label={product.name}
            className="h-fit"
          >
            <p className="text-muted-foreground px-4 py-2.5 text-xs">Click the stage to fire it.</p>
          </FireworkBrowseCard>

          <div className="flex flex-col gap-6">
            <header className="space-y-2">
              {product.baseEffect ? (
                <Link
                  href={catalogueHref({}, { effect: product.baseEffect.slug })}
                  className="text-muted-foreground hover:text-foreground text-xs font-medium tracking-wide uppercase"
                >
                  {product.baseEffect.name}
                </Link>
              ) : null}
              <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {product.name}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {isReadableDescription(product.description)
                  ? product.description
                  : catalogueProductSummary(product)}
              </p>
            </header>

            <div className="flex items-center gap-3">
              {product.minPriceCents != null ? (
                <>
                  <span className="text-foreground text-xl font-semibold tabular-nums">
                    {formatBudget(product.minPriceCents)}
                  </span>
                  <span className="text-muted-foreground text-xs">best supplier price</span>
                </>
              ) : (
                <span className="border-border text-muted-foreground rounded-full border px-2.5 py-1 text-xs">
                  Not currently stocked
                </span>
              )}
            </div>

            <dl className="border-border divide-border divide-y border-y text-sm">
              {specs.map((spec) => (
                <div key={spec.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{spec.label}</dt>
                  <dd className="text-foreground text-right tabular-nums">{spec.value}</dd>
                </div>
              ))}
              {colours.length > 0 ? (
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Colours</dt>
                  <dd className="flex items-center gap-2">
                    <span className="text-foreground">
                      {families.map((family) => colourFamilyLabel(family)).join(', ')}
                    </span>
                    <ColourSwatches colours={colours} />
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button href="/shows/new">Use in a new show</Button>
              {product.baseEffect ? (
                <Button
                  href={catalogueHref({}, { effect: product.baseEffect.slug })}
                  variant="secondary"
                >
                  More {product.baseEffect.name.toLowerCase()}
                </Button>
              ) : null}
            </div>

            {product.description && !isReadableDescription(product.description) ? (
              <details className="text-muted-foreground text-xs">
                <summary className="hover:text-foreground cursor-pointer select-none">
                  Supplier description
                </summary>
                <p className="mt-2 font-mono leading-relaxed break-words">{product.description}</p>
              </details>
            ) : null}
          </div>
        </section>

        {isMultishot ? <ShotSequence shots={shots} /> : null}

        {related.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-foreground text-lg font-semibold">More like this</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {related.map((item) => (
                <CatalogueProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </FireworkBrowsePreviewProvider>
    </div>
  );
}

function ShotSequence({ shots }: { shots: CatalogueShot[] | null }) {
  if (shots == null) {
    return (
      <InlineAlert tone="warning" title="Shot sequence unavailable">
        The firing order could not be loaded. Refresh to try again.
      </InlineAlert>
    );
  }
  if (shots.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-foreground text-lg font-semibold">Shot sequence</h2>
      <ol className="border-border divide-border divide-y rounded-xl border">
        {shots.map((shot, index) => (
          <li
            key={`${shot.sequenceIndex}-${index}`}
            className="grid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {index + 1}
            </span>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              +{shot.timeOffsetSeconds.toFixed(1)}s
            </span>
            <span className="min-w-0">
              <span className="text-foreground block truncate">{shot.effectName ?? shot.name}</span>
              <span className="text-muted-foreground block truncate text-xs" title={shot.name}>
                {shot.name}
              </span>
            </span>
            <ColourSwatches colours={shot.colours} />
          </li>
        ))}
      </ol>
    </section>
  );
}
