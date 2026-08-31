import { notFound } from 'next/navigation';
import { Music2, Package, ShieldCheck } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { TemplateReplayPreview } from '@/app/components/app/TemplateReplayPreview';
import {
  getAssortmentServiceClient,
  getPublicAssortmentByToken,
  resolvePublicAssortmentShow,
} from '@/lib/assortments/public.server';
import type { ShowTemplate } from '@/lib/admin.types';
import { formatBudget } from '@/lib/show-domain';
import { listFireworkProducts, listReplayCuesForShowWithClient } from '@/lib/shows.server';
import { KioskGeneratingShow, RegenerateAssortmentShow } from './KioskShowActions';

export const dynamic = 'force-dynamic';

export default async function AssortmentShowPage({
  params,
}: {
  params: Promise<{ token: string; showToken: string }>;
}) {
  const { token, showToken } = await params;
  const assortment = await getPublicAssortmentByToken(token);
  if (!assortment) notFound();
  const show = await resolvePublicAssortmentShow({
    assortmentId: assortment.id,
    showAccessToken: showToken,
  });
  if (!show) notFound();

  if (show.generationStatus === 'running') {
    return <KioskGeneratingShow token={token} showToken={showToken} showTitle={show.title} />;
  }

  if (show.generationStatus === 'failed') {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center px-4 py-12 sm:px-6">
        <Card className="w-full p-6 text-center">
          <h1 className="text-2xl font-bold">This show could not be generated</h1>
          <p className="text-on-surface-variant mt-2 text-sm leading-6">
            {show.generationError || 'Try generating another design from the same assortment.'}
          </p>
          <div className="mt-6 flex justify-center">
            <RegenerateAssortmentShow token={token} showToken={showToken} />
          </div>
        </Card>
      </div>
    );
  }

  const supabase = getAssortmentServiceClient();
  const [replayCues, allSpecifications, signedAudio] = await Promise.all([
    listReplayCuesForShowWithClient(supabase, show.id),
    listFireworkProducts(),
    show.audioPath
      ? supabase.storage.from('audio').createSignedUrl(show.audioPath, 30 * 60)
      : Promise.resolve({ data: null, error: null }),
  ]);
  const assortmentProductIds = new Set(show.snapshotItems.map((item) => item.catalogueItemId));
  const specifications = allSpecifications.filter((product) =>
    assortmentProductIds.has(product.id),
  );
  const now = new Date().toISOString();
  const template: ShowTemplate = {
    id: show.id,
    slug: `qr-${show.id}`,
    title: show.title,
    theme: 'Assortment QR',
    description: `Generated from ${assortment.name}`,
    durationSeconds: show.durationSeconds,
    budgetCents: show.budgetCents,
    totalCents: show.budgetCents ?? show.totalCents,
    effectsCount: show.effectsCount,
    timeOfDay: 'night',
    moodTags: [],
    previewCues: replayCues.flatMap((cue) =>
      cue.productId
        ? [
            {
              timeSeconds: cue.timeSeconds ?? 0,
              description: cue.description,
              catalogueItemId: cue.productId,
              launchPositionIndex: cue.launchPositionIndex,
              emphasis: cue.emphasis ?? 'normal',
            },
          ]
        : [],
    ),
    coverShader: null,
    coverImagePath: null,
    isFeatured: false,
    isPublished: false,
    publishedAt: null,
    sortOrder: 0,
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const pieceCount = show.snapshotItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={17} aria-hidden="true" />
            Generated from the scanned assortment
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Your show is ready</h1>
          <p className="text-on-surface-variant mt-2">{assortment.name}</p>
        </div>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {formatBudget(show.budgetCents ?? show.totalCents)}
        </p>
      </div>

      <div className="mt-6">
        <TemplateReplayPreview template={template} specifications={specifications} mode="detail" />
      </div>

      {signedAudio.data?.signedUrl ? (
        <Card className="mt-4 flex items-center gap-3 p-4">
          <Music2 className="text-primary shrink-0" size={20} aria-hidden="true" />
          <audio
            controls
            preload="metadata"
            src={signedAudio.data.signedUrl}
            className="h-10 w-full"
          >
            Your browser does not support audio playback.
          </audio>
        </Card>
      ) : null}

      <Card className="mt-6 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Package className="text-primary mt-0.5" size={20} aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{assortment.name}</h2>
              <p className="text-on-surface-variant mt-1 text-sm">
                {pieceCount} included {pieceCount === 1 ? 'product' : 'products'}
              </p>
            </div>
          </div>
          <span className="font-mono text-sm tabular-nums">
            {formatBudget(show.budgetCents ?? show.totalCents)}
          </span>
        </div>
        <ul className="border-border mt-4 space-y-2 border-t pt-4">
          {show.snapshotItems.map((item) => (
            <li key={item.catalogueItemId} className="flex gap-3 text-sm">
              <span className="text-on-surface-variant w-8 shrink-0 font-mono tabular-nums">
                {item.quantity}x
              </span>
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="not-happy-heading" className="mt-8">
        <h2 id="not-happy-heading" className="text-lg font-semibold">
          Not happy with this design?
        </h2>
        <p className="text-on-surface-variant mt-1 mb-4 text-sm leading-6">
          Generate a different timeline using this exact assortment. The products and quantities
          stay locked.
        </p>
        <RegenerateAssortmentShow token={token} showToken={showToken} />
      </section>
    </div>
  );
}
