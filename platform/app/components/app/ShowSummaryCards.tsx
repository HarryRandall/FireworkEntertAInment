'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { ArrowRight, Dices, Heart, Play } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Textarea } from '@/app/components/ui/Input';
import { RANDOM_BRIEFS } from '@/app/(app)/shows/new/constants';
import { formatBudget, formatDuration } from '@/lib/show-domain';
import type { ShowSummaryCard, TemplateSummaryCard, VisualPalette } from '@/lib/show-summary';
import { cn } from '@/lib/utils';

type PaletteStripProps = {
  palette?: VisualPalette | null;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
};

function gradientForPalette(
  palette?: VisualPalette | null,
  orientation: 'vertical' | 'horizontal' = 'vertical',
) {
  const colours = palette?.hex?.length ? palette.hex : ['#C9CDD3', '#C9CDD3', '#C9CDD3'];
  const angle = orientation === 'vertical' ? '180deg' : '90deg';
  return `linear-gradient(${angle}, ${colours.join(', ')})`;
}

export function PaletteStrip({ palette, className, orientation = 'vertical' }: PaletteStripProps) {
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 rounded-[2px]', className)}
      style={{ background: gradientForPalette(palette, orientation) }}
    />
  );
}

function showMeta(show: ShowSummaryCard) {
  return [show.songTitle ?? 'Untitled track', show.style, formatDuration(show.lengthSeconds)]
    .filter(Boolean)
    .join(' · ');
}

export function ShowSummaryRow({
  show,
  className,
  showPlay = true,
}: {
  show: ShowSummaryCard;
  className?: string;
  showPlay?: boolean;
}) {
  return (
    <div
      className={cn(
        'group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 last:border-b-0 hover:bg-[color:var(--color-bg-subtle)]/55',
        className,
      )}
    >
      <Link
        href={`/shows/${show.slug}/preview`}
        prefetch={false}
        className="focus-visible:ring-ring/50 grid min-w-0 grid-cols-[auto_1fr] items-center gap-3 rounded-md focus:outline-none focus-visible:ring-3"
      >
        <PaletteStrip palette={show.palette} className="h-7 w-1" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
            {show.title}
          </span>
          <span className="block truncate text-xs text-[color:var(--color-content-subtle)]">
            {showMeta(show)}
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-3 text-right">
        <div className="hidden min-w-24 sm:block">
          <div
            className="font-mono text-xs font-medium text-[color:var(--color-content-emphasis)] tabular-nums"
            title="Estimated retail cost of fireworks"
          >
            {formatBudget(show.totalCostCents)}
          </div>
          <div className="text-[10px] text-[color:var(--color-content-subtle)]">
            Est. retail · {show.cueCount} cues
          </div>
        </div>
        {showPlay ? (
          <Link
            href={`/shows/${show.slug}/preview?autoplay=1`}
            prefetch={false}
            aria-label={`Play ${show.title}`}
            className="focus-visible:ring-ring/50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-emphasis)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:ring-3"
          >
            <Play size={15} fill="currentColor" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function TemplateSummaryCardView({
  template,
  className,
  showCloneAction = false,
}: {
  template: TemplateSummaryCard;
  className?: string;
  showCloneAction?: boolean;
}) {
  const style = {
    '--template-gradient': `linear-gradient(135deg, color-mix(in srgb, ${template.palette.hex[0]} 58%, black), ${template.palette.hex[0]}, ${template.palette.hex[2]})`,
  } as CSSProperties;

  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch={false}
      className={cn(
        'group focus-visible:ring-ring/50 block h-full rounded-xl focus:outline-none focus-visible:ring-3',
        className,
      )}
    >
      <Card
        hoverable
        radius="lg"
        className="flex h-full min-h-[10rem] flex-col overflow-hidden p-0"
      >
        <div
          className="relative h-20 shrink-0 overflow-hidden border-b border-[color:var(--color-border-subtle)] bg-[image:var(--template-gradient)]"
          style={style}
        >
          <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-0.5 rounded-md bg-black/35 px-2 py-1 text-right text-[11px] leading-4 text-white shadow-sm backdrop-blur">
            <span className="inline-flex items-center gap-1">
              <Heart size={12} className="shrink-0 fill-current text-[color:var(--destructive)]" />
              <span className="tabular-nums">{template.likes}</span>
            </span>
            <span className="tabular-nums" title="Estimated retail cost of fireworks">
              {formatBudget(template.totalCostCents)}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-3.5">
          <div className="min-w-0">
            <h3 className="group-hover:text-foreground line-clamp-1 text-sm font-medium text-[color:var(--color-content-emphasis)]">
              {template.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-xs text-[color:var(--color-content-subtle)]">
              {template.theme}
            </p>
          </div>
          {showCloneAction ? (
            <span className="inline-flex h-7 items-center self-start rounded-md border border-[color:var(--color-border-subtle)] px-2.5 text-xs font-medium text-[color:var(--color-content-emphasis)]">
              Clone and customise
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

type PromptHeroProps = {
  className?: string;
};

export function PromptHero({ className }: PromptHeroProps) {
  const [prompt, setPrompt] = useState('');
  const router = useRouter();

  const goToWizard = () => {
    const trimmed = prompt.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('prompt', trimmed);
    const query = params.toString();
    router.push(query ? `/shows/new?${query}` : '/shows/new');
  };

  /** Dice: replace the whole brief with a random ready-made example. */
  const rollDice = () => {
    const options = RANDOM_BRIEFS.filter((brief) => brief !== prompt.trim());
    const pool = options.length > 0 ? options : RANDOM_BRIEFS;
    setPrompt(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <section className={cn('relative isolate mx-auto w-full max-w-3xl py-10', className)}>
      <div className="prompt-hero-glow" aria-hidden />
      <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)] sm:text-3xl">
        Create any firework show you can imagine
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/55 shadow-xs backdrop-blur-md">
        <Textarea
          name="prompt"
          rows={2}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              goToWizard();
            }
          }}
          placeholder="Describe your show, or hit the dice to randomise."
          aria-label="Show prompt"
          className="h-28 resize-none rounded-none border-0 bg-transparent p-4 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
        />
        <div className="bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-bg-default)_24%,transparent)_100%)] px-4 pt-2 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={rollDice}
                aria-label="Randomise the brief"
                title="Randomise the brief"
                className="h-9 w-9 rounded-full px-0"
              >
                <Dices size={16} />
              </Button>
              <Button type="button" onClick={goToWizard} className="h-9 rounded-full px-4 text-sm">
                Continue
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function EmptyShowsPanel({ includePromptHero = true }: { includePromptHero?: boolean }) {
  return <>{includePromptHero ? <PromptHero /> : null}</>;
}
