'use client';

/** An autoplaying story from a typed brief to a planned show, built from the kit's chat and cards. */
import { useEffect, useState } from 'react';
import { Music4 } from 'lucide-react';
import { effectTemplates } from '@showcrafter/renderer';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { ChatBubble, TypingIndicator } from '@/ui/kit/chat';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { PlannedShowCard, PosterImage } from '@/ui/kit/show-card';
import { cn } from '@/lib/utils';
import { useLandingPosters, useNearViewport } from './useLandingPosters';

const BRIEF = 'A three-minute New Year show for the back garden, about £500, big gold finale.';
const REPLY = 'Here is a plan that builds with the song and saves the gold for the last chorus.';
// Story pacing in wall-clock milliseconds.
const TYPE_MS = 28;
const THINK_MS = 1400;
const CUE_MS = 1100;
const HOLD_MS = 2400;

const CUES = [
  { time: '0:04', name: 'Peony, gold to rose', moment: 'Intro' },
  { time: '0:42', name: 'Crossette pair', moment: 'First drop' },
  { time: '1:31', name: 'Willow, green tips', moment: 'Bridge' },
  { time: '2:18', name: 'Crackling palm', moment: 'Build' },
  { time: '2:51', name: 'Brocade crown wall', moment: 'Finale' },
] as const;
const ENERGY = [0.2, 0.3, 0.45, 0.4, 0.55, 0.7, 0.5, 0.65, 0.8, 0.75, 0.95, 1];
const POSTER_DESIGNS = (() => {
  const template = effectTemplates.find((entry) => entry.key === 'brocadeCrown');
  return template ? [{ key: template.key, design: template.design }] : [];
})();

type Stage =
  | { kind: 'typing'; chars: number }
  | { kind: 'thinking' }
  | { kind: 'planned'; cue: number };

const FINAL: Stage = { kind: 'planned', cue: CUES.length - 1 };

function nextStage(stage: Stage): { stage: Stage; delay: number } {
  if (stage.kind === 'typing')
    return stage.chars < BRIEF.length
      ? { stage: { kind: 'typing', chars: stage.chars + 1 }, delay: TYPE_MS }
      : { stage: { kind: 'thinking' }, delay: THINK_MS / 2 };
  if (stage.kind === 'thinking') return { stage: { kind: 'planned', cue: 0 }, delay: THINK_MS };
  return stage.cue < CUES.length - 1
    ? { stage: { kind: 'planned', cue: stage.cue + 1 }, delay: CUE_MS }
    : { stage: { kind: 'typing', chars: 0 }, delay: HOLD_MS };
}

export function SongToShow() {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const near = useNearViewport(section, '0px');
  const reduce = usePrefersReducedMotion();
  const posters = useLandingPosters(POSTER_DESIGNS, near);
  const [stage, setStage] = useState<Stage>({ kind: 'typing', chars: 0 });
  const shown = reduce ? FINAL : stage;

  useEffect(() => {
    if (!near || reduce) return;
    const { stage: next, delay } = nextStage(stage);
    const timer = window.setTimeout(() => setStage(next), delay);
    return () => window.clearTimeout(timer);
  }, [near, reduce, stage]);

  const typed = shown.kind === 'typing' ? BRIEF.slice(0, shown.chars) : BRIEF;
  const planned = shown.kind === 'planned';

  return (
    <section
      ref={setSection}
      id="planner"
      aria-labelledby="story-heading"
      className="border-border scroll-mt-16 border-b"
    >
      <Reveal className="border-border mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-10 sm:py-20 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:border-x">
        <Rise className="space-y-4">
          <p className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Planner
          </p>
          <h2
            id="story-heading"
            className="text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            From a song and a sentence to a show.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
            Describe the night, add music and set a budget. The planner places catalogue products on
            the song's big moments, and you review every cue before anything is bought.
          </p>
        </Rise>

        <Rise delay={120} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
          <div
            aria-label="Example planning conversation"
            className="border-border bg-background grid content-start gap-3 rounded-xl border p-4"
          >
            <ChatBubble from="user">
              {typed}
              {shown.kind === 'typing' ? (
                <span
                  aria-hidden
                  className="bg-background ml-0.5 inline-block h-4 w-px align-middle"
                />
              ) : null}
            </ChatBubble>
            {shown.kind === 'thinking' ? <TypingIndicator /> : null}
            {planned ? <ChatBubble from="assistant">{REPLY}</ChatBubble> : null}
            {planned ? (
              <ol className="border-border divide-border mt-1 divide-y rounded-lg border">
                {CUES.map((cue, index) => (
                  <li
                    key={cue.time}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-xs transition-colors duration-300',
                      index === shown.cue ? 'bg-hl-soft text-foreground' : 'text-muted-foreground',
                      index > shown.cue && 'opacity-40',
                    )}
                  >
                    <span className="font-mono tabular-nums">{cue.time}</span>
                    <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                      {cue.name}
                    </span>
                    <span className="hidden items-center gap-1 sm:inline-flex">
                      <Music4 aria-hidden size={11} />
                      {cue.moment}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <div
            className={cn(
              'transition-[opacity,transform] duration-500',
              planned ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            <PlannedShowCard
              title="Gold New Year"
              description="Builds through the chorus into a brocade crown finale."
              price="£480"
              duration="3:00"
              itemCount={14}
              energy={ENERGY}
              tags={['Back garden', 'Gold finale']}
              poster={
                <PosterImage
                  url={posters.urls.brocadeCrown}
                  error={posters.failed.brocadeCrown ? 'Preview unavailable' : undefined}
                />
              }
            />
          </div>
        </Rise>
      </Reveal>
    </section>
  );
}
