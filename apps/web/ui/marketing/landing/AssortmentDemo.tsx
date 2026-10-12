'use client';

/**
 * The assortment flow on a phone: scan the box, pick a song, watch a show built only from
 * the pack's contents. The steps advance on their own while the section is on screen.
 */
import { useEffect, useState } from 'react';
import { Music2, QrCode, ScanLine, Search, Sparkles } from 'lucide-react';
import { effectTemplates } from '@showcrafter/renderer';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { PosterImage } from '@/ui/kit/show-card';
import { cn } from '@/lib/utils';
import { useLandingPosters, useNearViewport } from './useLandingPosters';

/** Milliseconds each step stays on screen before the next. */
const STEP_MS = 3800;

const PACK = [
  { key: 'peony', label: 'Peony shells', quantity: 6 },
  { key: 'chrysanthemum', label: 'Chrysanthemum shells', quantity: 6 },
  { key: 'willow', label: 'Gold willow cake', quantity: 1 },
  { key: 'crossette', label: 'Crossette cake', quantity: 1 },
  { key: 'dahlia', label: 'Dahlia shells', quantity: 4 },
  { key: 'brocadeCrown', label: 'Brocade finale cake', quantity: 1 },
].map((item) => {
  const template = effectTemplates.find((entry) => entry.key === item.key);
  if (!template) throw new Error(`The landing page needs the ${item.key} template.`);
  return { ...item, design: template.design };
});

const STEPS = [
  { title: 'Scan the box', Icon: ScanLine },
  { title: 'Pick a song', Icon: Music2 },
  { title: 'Watch the show', Icon: Sparkles },
] as const;

const SONGS = ['Golden Hour', 'Night Drive', 'Summer Lights'];

const CUES = [
  ['0:06', 'Peony shells', 'Intro'],
  ['0:41', 'Crossette cake', 'First drop'],
  ['1:28', 'Gold willow cake', 'Bridge'],
  ['2:12', 'Brocade finale cake', 'Finale'],
] as const;

type Qr = { size: number; cells: boolean[] };

function QrGraphic({ qr, className }: { qr: Qr; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-2} y={-2} width={qr.size + 4} height={qr.size + 4} fill="#ffffff" />
      {qr.cells.map((dark, index) =>
        dark ? (
          <rect
            key={index}
            x={index % qr.size}
            y={Math.floor(index / qr.size)}
            width={1}
            height={1}
            fill="#111111"
          />
        ) : null,
      )}
    </svg>
  );
}

function PhoneScreen({ step, qr, poster }: { step: number; qr: Qr; poster?: string }) {
  if (step === 0)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="relative rounded-xl bg-white p-3 shadow-lg">
          <QrGraphic qr={qr} className="size-36" />
          <span className="sc-float pointer-events-none absolute inset-x-2 top-1/2 h-0.5 rounded-full bg-[var(--hl)] shadow-[0_0_12px_var(--hl)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Back Garden Party</p>
          <p className="mt-1 text-xs text-white/60">Scan the code on the box to start</p>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <p className="text-xs font-semibold text-white">Choose your music</p>
        <div className="flex h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs text-white/70">
          <Search aria-hidden size={13} />
          summer
        </div>
        <ul className="grid gap-1.5">
          {SONGS.map((song, index) => (
            <li
              key={song}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs',
                index === 2 ? 'bg-[var(--hl)]/20 text-white' : 'text-white/70',
              )}
            >
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-white/10">
                <Music2 aria-hidden size={12} />
              </span>
              <span className="flex-1">{song}</span>
              <span className="text-white/50 tabular-nums">{`${2 + index}:${index}5`}</span>
            </li>
          ))}
        </ul>
        <p className="mt-auto text-center text-[11px] text-white/50">Or upload your own track</p>
      </div>
    );
  return (
    <div className="flex h-full flex-col">
      <PosterImage url={poster} className="aspect-[4/3] rounded-none" />
      <div className="grid gap-2 p-4">
        <div>
          <p className="text-sm font-semibold text-white">Your show · 2:30</p>
          <p className="text-[11px] text-white/60">Built from the 6 items in this box</p>
        </div>
        <ul className="grid gap-1">
          {CUES.map(([time, item, moment]) => (
            <li
              key={time}
              className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5 text-[11px]"
            >
              <span className="font-mono text-white/50">{time}</span>
              <span className="flex-1 truncate text-white">{item}</span>
              <span className="text-white/50">{moment}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AssortmentDemo({ qr }: { qr: Qr }) {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const near = useNearViewport(section, '0px');
  const posters = useLandingPosters(PACK, near);
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!near || reduce) return;
    const timer = window.setTimeout(
      () => setStep((current) => (current + 1) % STEPS.length),
      STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [near, reduce, step]);

  return (
    <section
      ref={setSection}
      id="assortments"
      aria-labelledby="assortments-heading"
      className="border-border scroll-mt-16 border-b"
    >
      <Reveal className="border-border mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-10 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-center lg:border-x">
        <div>
          <Rise>
            <p className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
              Assortments
            </p>
            <h2
              id="assortments-heading"
              className="text-foreground mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Scan the box. Pick a song. Get a show.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
              Each assortment pack carries a QR code. Scanning it opens a planner that only uses
              what is inside, set to whatever song you choose.
            </p>
          </Rise>

          <Rise delay={120} className="mt-8">
            <div className="border-border bg-card rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Example pack</p>
                  <p className="text-foreground text-sm font-semibold">Back Garden Party</p>
                </div>
                <span className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                  <QrCode aria-hidden size={13} /> On the box
                </span>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PACK.map((item) => (
                  <li key={item.key} className="flex items-center gap-2.5">
                    <PosterImage
                      url={posters.urls[item.key]}
                      error={posters.failed[item.key] ? ' ' : undefined}
                      className="w-12 shrink-0 rounded-md"
                    />
                    <span className="min-w-0 text-xs">
                      <span className="text-foreground block truncate font-medium">
                        {item.label}
                      </span>
                      <span className="text-muted-foreground">x{item.quantity}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Rise>
        </div>

        <Rise delay={200} className="mx-auto w-full max-w-[20rem]">
          <ol className="mb-4 grid grid-cols-3 gap-1.5">
            {STEPS.map(({ title, Icon }, index) => (
              <li key={title}>
                <button
                  type="button"
                  aria-pressed={index === step}
                  onClick={() => setStep(index)}
                  className={cn(
                    'focus-visible:ring-ring relative flex w-full flex-col items-center gap-1 overflow-hidden rounded-lg px-1 py-2 text-[11px] transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    index === step
                      ? 'bg-card text-foreground border-border border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden size={14} />
                  {title}
                </button>
              </li>
            ))}
          </ol>
          <div className="bg-stage-night mx-auto aspect-[3/5] overflow-hidden rounded-[2.25rem] border-[6px] border-neutral-800 shadow-2xl">
            <div aria-live="polite" className="h-full">
              <PhoneScreen step={step} qr={qr} poster={posters.urls.brocadeCrown} />
            </div>
          </div>
        </Rise>
      </Reveal>
    </section>
  );
}
