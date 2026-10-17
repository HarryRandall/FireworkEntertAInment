'use client';

/**
 * Keeps the generating splash over the preview, in its real `finalising`
 * phase, from the moment generation completes until the replay is watchable.
 * It covers the positioned app content panel so the show chrome underneath
 * can mount and lay out the canvas without anything flashing through, and
 * makes that content inert so keyboard focus cannot land on hidden controls.
 *
 * It never fades out on a timer. If the preview is slow it says so and offers
 * a way out; if the stage fails, the owner removes it so the error shows.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ShowCover } from '@/lib/cover';
import { resolveGenerationHandoverStartedAt } from '@/lib/generation-progress-storage';
import { Button } from '@/ui/patterns/Button';
import { GeneratingShowAnimation } from '@/ui/shows/GeneratingShowAnimation';
import { FINALISING_DELAY_SECONDS } from '@/ui/shows/generation-delay';

export function GenerationHandoverSplash({
  persistKey,
  title,
  hasAudio,
  cover = null,
  onDismiss,
}: {
  /** Show slug; shares the session cover and start time with the generating route. */
  persistKey: string;
  title: string | null;
  hasAudio: boolean;
  /** The show's saved cover when known; the session cover still wins while it exists. */
  cover?: ShowCover | null;
  /** Lets the user see the preview as it is once the handover is overdue. */
  onDismiss?: () => void;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  // Anchored in session storage: this component mounts in the route loading
  // state, the streaming fallback and the viewer in turn, and the judgement
  // "this is slow" must survive those hops and a refresh.
  const [handoverStartedAt] = useState(() => resolveGenerationHandoverStartedAt(persistKey));
  const [overdue, setOverdue] = useState(
    () => Date.now() - handoverStartedAt >= FINALISING_DELAY_SECONDS * 1000,
  );

  useLayoutEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>('[data-app-content]'));
  }, []);

  // Everything else in the content panel is covered, so it must not be
  // reachable either: no tabbing onto the hidden transport or cue builder.
  useLayoutEffect(() => {
    const splash = splashRef.current;
    if (!portalTarget || !splash) return;
    const made: HTMLElement[] = [];
    for (const child of Array.from(portalTarget.children)) {
      if (child === splash || !(child instanceof HTMLElement) || child.inert) continue;
      child.inert = true;
      made.push(child);
    }
    return () => {
      for (const child of made) child.inert = false;
      // Leaving with focus inside the splash would drop it on the body; hand
      // it to the shell's focusable main landmark, which is also its skip target.
      if (splash.contains(document.activeElement)) {
        portalTarget.focus({ preventScroll: true });
      }
    };
  }, [portalTarget]);

  useEffect(() => {
    if (overdue) return;
    const remaining = handoverStartedAt + FINALISING_DELAY_SECONDS * 1000 - Date.now();
    const timer = window.setTimeout(() => setOverdue(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [handoverStartedAt, overdue]);

  // The way out appears once the wait is admitted to be long; move focus to it
  // so keyboard users are not left in a panel with nothing to reach.
  useEffect(() => {
    if (!overdue) return;
    splashRef.current
      ?.querySelector<HTMLElement>('[data-handover-recovery] button')
      ?.focus({ preventScroll: true });
  }, [overdue]);

  const recovery = overdue ? (
    <span className="contents" data-handover-recovery>
      {onDismiss ? (
        <Button size="sm" onClick={onDismiss}>
          Open the preview anyway
        </Button>
      ) : null}
      <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
        Reload the page
      </Button>
    </span>
  ) : null;

  const splash = (
    <div ref={splashRef} className="bg-background absolute inset-0 z-50" data-generation-handover>
      <GeneratingShowAnimation
        showTitle={title ?? undefined}
        status="running"
        phase="finalising"
        phaseStartedAt={handoverStartedAt}
        hasAudio={hasAudio}
        persistKey={persistKey}
        coverShader={cover}
        randomiseCoverOnLoad
        pollIntervalMs={null}
        recovery={recovery}
        className="h-full"
      />
    </div>
  );

  return portalTarget ? createPortal(splash, portalTarget) : splash;
}
