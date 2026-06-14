'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { ArrowRight, Heart, Play, ShieldCheck, WandSparkles } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input } from '@/app/components/ui/Input';
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

export function PaletteDots({
  palette,
  className,
}: {
  palette: VisualPalette;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-1.5', className)} aria-label="Show palette">
      {palette.hex.map((colour, index) => (
        <span
          key={`${colour}-${index}`}
          aria-hidden
          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
          style={{ backgroundColor: colour }}
        />
      ))}
    </span>
  );
}

export function EnergyWaveform({
  values,
  palette,
  className,
  height = 42,
}: {
  values: number[];
  palette: VisualPalette;
  className?: string;
  height?: number;
}) {
  const buckets = values.length > 0 ? values : Array.from({ length: 48 }, () => 0.22);
  const barWidth = 3.5;
  const gap = 2.25;
  const width = buckets.length * (barWidth + gap);

  return (
    <svg
      className={cn('h-11 w-full overflow-visible', className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Show energy preview"
    >
      {buckets.map((value, index) => {
        const clamped = Math.max(0.08, Math.min(1, value));
        const barHeight = 5 + clamped * (height - 7);
        const y = height - barHeight;
        const fill =
          index > buckets.length * 0.82
            ? palette.hex[2]
            : clamped > 0.68
              ? palette.hex[2]
              : clamped > 0.38
                ? palette.hex[0]
                : 'var(--color-content-muted)';

        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={1.75}
            fill={fill}
            opacity={clamped > 0.38 ? 0.92 : 0.55}
          />
        );
      })}
    </svg>
  );
}

function formatEditedAt(iso: string) {
  const edited = new Date(iso);
  const diffMs = Date.now() - edited.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return edited.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
        prefetch
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
        <div className="hidden min-w-20 sm:block">
          <div className="font-mono text-xs font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
            {formatBudget(show.totalCostCents)}
          </div>
          <div className="text-xs text-[color:var(--color-content-subtle)]">
            {show.cueCount} cues
          </div>
        </div>
        {showPlay ? (
          <Link
            href={`/shows/${show.slug}/preview?autoplay=1`}
            prefetch
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

export function JumpBackInHero({ show }: { show: ShowSummaryCard }) {
  return (
    <Card radius="xl" className="overflow-hidden p-0">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[color:var(--color-content-muted)] uppercase">
              Jump back in
            </p>
            <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
              {show.title}
            </h2>
            <p className="mt-1 truncate text-sm text-[color:var(--color-content-subtle)]">
              {[
                show.songTitle ?? 'Untitled track',
                show.style,
                `edited ${formatEditedAt(show.lastEditedAt)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <PaletteDots palette={show.palette} />
        </div>

        <div className="mt-6">
          <EnergyWaveform values={show.energySeries} palette={show.palette} height={44} />
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span>
              <strong className="font-mono font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
                {formatDuration(show.lengthSeconds)}
              </strong>{' '}
              <span className="text-[color:var(--color-content-subtle)]">length</span>
            </span>
            <span>
              <strong className="font-mono font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
                {show.cueCount}
              </strong>{' '}
              <span className="text-[color:var(--color-content-subtle)]">cues</span>
            </span>
            <span>
              <strong className="font-mono font-medium text-[color:var(--color-content-emphasis)] tabular-nums">
                {formatBudget(show.totalCostCents)}
              </strong>{' '}
              <span className="text-[color:var(--color-content-subtle)]">cost</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href={`/shows/${show.slug}/preview?autoplay=1`} variant="secondary" size="sm">
              <Play size={14} />
              Preview
            </Button>
            <Button href={`/shows/${show.slug}/preview?cueDialog=ai`} variant="secondary" size="sm">
              <WandSparkles size={14} />
              Refine
            </Button>
          </div>
        </div>
      </div>
    </Card>
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
      prefetch
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
            <span className="tabular-nums">{formatBudget(template.totalCostCents)}</span>
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
const PROMPT_SUGGESTIONS = [
  {
    label: 'Birthday party',
    value: 'A colourful birthday show with playful bursts and a bright gold finale.',
  },
  {
    label: 'Wedding finale',
    value: 'An elegant wedding finale with white, silver, and soft pink fireworks.',
  },
  {
    label: "New year's eve",
    value: "A high-energy New year's eve show with a huge countdown finale.",
  },
  {
    label: 'Surprise me',
    value: 'A cinematic show with a calm opening, rising colour, and a massive finale.',
  },
];

export function PromptHero({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState('');
  const router = useRouter();

  return (
    <Card radius="xl" className={cn('p-5 sm:p-6', className)}>
      <form
        className="mx-auto max-w-2xl space-y-5 text-center"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = prompt.trim();
          router.push(trimmed ? `/shows/new?prompt=${encodeURIComponent(trimmed)}` : '/shows/new');
        }}
      >
        <div className="flex justify-center gap-1.5" aria-hidden>
          {['#EFB93F', '#C9CDD3', '#2EC487', '#8F7BE8'].map((colour) => (
            <span
              key={colour}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colour }}
            />
          ))}
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
            Create your first show
          </h2>
          <p className="mt-2 text-sm text-[color:var(--color-content-subtle)]">
            Describe it in a sentence. We will choreograph the fireworks, sync them to your song,
            and price it.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A golden show over water with a huge finale..."
            aria-label="Show prompt"
            className="h-11"
          />
          <Button type="submit" className="h-11 shrink-0">
            Create
            <ArrowRight size={15} />
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => setPrompt(suggestion.value)}
              className="focus-visible:ring-ring/50 rounded-md border border-[color:var(--color-border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-content-subtle)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)] focus:outline-none focus-visible:ring-3"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      </form>
    </Card>
  );
}

export function SafetyFooter() {
  return (
    <Card radius="lg" className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-status-success)_16%,transparent)] text-[color:var(--color-status-success)]">
            <ShieldCheck size={18} />
          </span>
          <p className="text-sm text-[color:var(--color-content-subtle)]">
            <span className="font-medium text-[color:var(--color-content-emphasis)]">
              New to fireworks?
            </span>{' '}
            Read the safety guide before planning a real show.
          </p>
        </div>
        <Button href="/safety" variant="secondary" size="sm">
          Safety guide
        </Button>
      </div>
    </Card>
  );
}

export function EmptyShowsPanel({
  templates,
  includeSafety = true,
}: {
  templates: TemplateSummaryCard[];
  includeSafety?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PromptHero />
      {templates.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-[color:var(--color-content-subtle)]">
              Or start from a template
            </h2>
            <Link
              href="/library"
              className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-content-emphasis)] hover:underline"
            >
              Explore all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {templates.map((template) => (
              <TemplateSummaryCardView key={template.id} template={template} showCloneAction />
            ))}
          </div>
        </section>
      ) : null}
      {includeSafety ? <SafetyFooter /> : null}
    </div>
  );
}
