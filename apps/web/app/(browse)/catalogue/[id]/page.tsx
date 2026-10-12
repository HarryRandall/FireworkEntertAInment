/** Public product page: large playable preview, specification, colours and shot sequence. */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  catalogueHref,
  colourFamilyLabel,
  productColourFamilies,
  productColours,
  relatedCatalogueProducts,
} from '@/lib/catalogue-browse';
import { getCatalogueProduct, listCatalogueShots } from '@/lib/catalogue-detail.server';
import { fireworkPreviewImageUrl } from '@/lib/firework-preview-image';
import { formatBudget, formatDuration, formatManufacturerLabel } from '@/lib/show-domain';
import { FireworkBrowseCard } from '@/ui/catalogue/FireworkBrowseCard';
import { FireworkBrowsePreviewProvider } from '@/ui/catalogue/FireworkBrowsePreviewContext';
import { ColourSwatches } from '@/ui/catalogue/ColourSwatches';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert, Skeleton } from '@/ui/patterns/Feedback';
import { StatTile } from '@/ui/patterns/StatTile';
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
    description:
      result.product.description ??
      `${result.product.baseEffect?.name ?? 'Firework'} from the ShowCrafter catalogue.`,
  };
}

export default async function CatalogueProductPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getCatalogueProduct(id);
  if (!result) notFound();
  const { product, catalogue } = result;

  const shotCount = product.shotCount ?? 1;
  const colours = productColours(product, 12);
  const families = [...productColourFamilies(product)];
  const related = relatedCatalogueProducts(product, catalogue, 4);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">
      <Link
        href="/catalogue"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={15} aria-hidden />
        Catalogue
      </Link>

      <FireworkBrowsePreviewProvider>
        <section className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <FireworkBrowseCard
            previewId={`catalogue-detail-${product.id}`}
            previewUrl={catalogueProductPreviewUrl(product)}
            persistedPosterUrl={fireworkPreviewImageUrl(product.previewImagePath)}
            label={product.name}
            className="h-fit"
          >
            <p className="text-muted-foreground px-4 py-3 text-xs">
              Click or hover the stage to fire it. Preview is rendered live in your browser.
            </p>
          </FireworkBrowseCard>

          <div className="flex flex-col gap-6">
            <header className="space-y-3">
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide uppercase">
                {product.baseEffect ? (
                  <Link
                    href={catalogueHref({}, { effect: product.baseEffect.slug })}
                    className="hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {product.baseEffect.name}
                  </Link>
                ) : null}
                <span>{shotCount > 1 ? 'Multi-shot' : 'Single shot'}</span>
              </div>
              <h1 className="text-foreground text-3xl font-bold tracking-tight">{product.name}</h1>
              <p className="text-muted-foreground font-mono text-xs">
                {formatManufacturerLabel(product.manufacturer)} · {product.slug}
              </p>
              {product.description ? (
                <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  {product.description}
                </p>
              ) : null}
            </header>

            <div className="flex items-baseline gap-2">
              <span className="text-foreground font-mono text-2xl font-semibold tabular-nums">
                {product.minPriceCents != null
                  ? formatBudget(product.minPriceCents)
                  : 'Not stocked'}
              </span>
              {product.minPriceCents != null ? (
                <span className="text-muted-foreground text-xs">cheapest supplier price</span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Shots" value={shotCount.toLocaleString()} />
              <StatTile label="Duration" value={formatDuration(product.durationSeconds)} />
              <StatTile
                label="Height"
                value={product.heightMeters != null ? Math.round(product.heightMeters) : '—'}
                unit={product.heightMeters != null ? 'm' : undefined}
              />
              <StatTile label="Calibre" value={product.caliber ?? '—'} />
            </div>

            {colours.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-foreground text-sm font-medium">Colours</h2>
                <ColourSwatches colours={colours} size="md" />
                <div className="flex flex-wrap gap-2">
                  {families.map((family) => (
                    <Link
                      key={family}
                      href={catalogueHref({}, { colour: family })}
                      className="border-border text-muted-foreground hover:text-foreground hover:border-border-emphasis rounded-full border px-2.5 py-1 text-xs"
                    >
                      More {colourFamilyLabel(family).toLowerCase()}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button href="/shows/new">Use in a new show</Button>
              {product.baseEffect ? (
                <Button
                  href={catalogueHref({}, { effect: product.baseEffect.slug })}
                  variant="secondary"
                >
                  All {product.baseEffect.name.toLowerCase()} effects
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {shotCount > 1 ? (
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <ShotSequence productId={product.id} />
          </Suspense>
        ) : null}

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

async function ShotSequence({ productId }: { productId: string }) {
  let shots: Awaited<ReturnType<typeof listCatalogueShots>>;
  try {
    shots = await listCatalogueShots(productId);
  } catch (error) {
    console.error(`[catalogue] shot sequence ${productId} failed:`, error);
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
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                #
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Fires at
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Effect
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Calibre
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Colours
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {shots.map((shot, index) => (
              <tr key={`${shot.sequenceIndex}-${index}`}>
                <td className="text-muted-foreground px-4 py-2.5 font-mono tabular-nums">
                  {index + 1}
                </td>
                <td className="px-4 py-2.5 font-mono tabular-nums">
                  +{shot.timeOffsetSeconds.toFixed(2)}s
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-foreground">{shot.name}</span>
                  {shot.effectName ? (
                    <span className="text-muted-foreground ml-2 text-xs">{shot.effectName}</span>
                  ) : null}
                </td>
                <td className="text-muted-foreground px-4 py-2.5">{shot.caliber ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <ColourSwatches colours={shot.colours} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
