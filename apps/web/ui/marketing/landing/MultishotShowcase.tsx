'use client';

/** Multishot cakes: pick one and watch every tube fire at its own time and angle. */
import { useState } from 'react';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { cn } from '@/lib/utils';
import { designAccent } from './demoShow';
import { CAKES } from './multishotCakes';
import { ShowPreviewPanel } from './ShowPreviewPanel';

/** The fan of tube angles, drawn as lines from the base of the box. */
function AngleFan({ pans, color }: { pans: readonly number[]; color: string }) {
  return (
    <svg aria-hidden="true" viewBox="-50 -46 100 50" className="h-10 w-20 shrink-0">
      {pans.map((pan, index) => {
        const radians = (pan * Math.PI) / 180;
        return (
          <line
            key={index}
            x1={0}
            y1={0}
            x2={Math.round(Math.sin(radians) * 44 * 100) / 100}
            y2={Math.round(-Math.cos(radians) * 44 * 100) / 100}
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      })}
      <rect x={-12} y={-2} width={24} height={6} rx={1.5} fill="currentColor" opacity={0.5} />
    </svg>
  );
}

export function MultishotShowcase() {
  const [selected, setSelected] = useState(0);
  const cake = CAKES[selected] ?? CAKES[0];

  return (
    <section
      id="multishots"
      aria-labelledby="multishots-heading"
      className="border-border scroll-mt-16 border-b"
    >
      <Reveal className="border-border mx-auto max-w-6xl px-4 py-14 sm:px-10 sm:py-20 lg:border-x">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
          <Rise>
            <p className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
              Multishots
            </p>
            <h2
              id="multishots-heading"
              className="text-foreground mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              One cake, every tube on its own beat.
            </h2>
          </Rise>
          <Rise delay={80}>
            <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
              A multishot fires a sequence of tubes from one box. Each shot keeps its own time and
              angle, so fans, zippers and finales look the way they will on the night.
            </p>
          </Rise>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Rise delay={140}>
            <ul aria-label="Multishot cakes" className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {CAKES.map((entry, index) => {
                const color = designAccent(entry.cues[0]?.firework.design);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-pressed={index === selected}
                      onClick={() => setSelected(index)}
                      className={cn(
                        'border-border focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                        index === selected
                          ? 'bg-card border-border-strong shadow-sm'
                          : 'hover:bg-card/60',
                      )}
                    >
                      <span className="text-muted-foreground">
                        <AngleFan
                          pans={entry.cues.map((cue) => cue.shotPanDegrees ?? 0)}
                          color={color}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="text-foreground block text-sm font-medium">
                          {entry.name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {entry.cues.length} shots · {entry.pattern}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground mt-4 hidden text-sm leading-relaxed lg:block">
              {cake.description} Drag along the timeline to replay any shot.
            </p>
          </Rise>

          <Rise delay={200}>
            <ShowPreviewPanel
              cues={cake.cues}
              duration={cake.duration}
              title={cake.name}
              subtitle={`${cake.cues.length} shots · ${cake.effect}`}
              track="Firing sequence"
              unit="shots"
              palette={[designAccent(cake.cues[0]?.firework.design)]}
              height="clamp(340px, 52vw, 480px)"
            />
          </Rise>
        </div>
      </Reveal>
    </section>
  );
}
