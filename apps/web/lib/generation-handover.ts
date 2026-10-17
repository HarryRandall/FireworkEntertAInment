/**
 * The handover from the generating splash to the watchable preview.
 *
 * Generation finishing is not the same as the preview being ready: the replay
 * route still has to stream its data, load the renderer and prime the
 * fireworks. These helpers keep that boundary explicit and testable so the
 * splash stays up, with its real phase, until the replay is genuinely
 * watchable (or the stage has a real failure to show), and so polling stops
 * wasting work while the tab is hidden or a refresh is still in flight.
 */

import type { ShowCover } from '@/lib/cover';

const GENERATION_HANDOVER_PARAM = 'handover';

export type GenerationHandover = {
  /** Title to keep on the splash before the show row has streamed in. */
  title: string | null;
  /** Whether the stage list includes the analysis step. */
  hasAudio: boolean;
  /** The show's saved cover, when the server already knows it. */
  cover?: ShowCover | null;
};

/** Preview URL the generating route redirects to once the pipeline completes. */
export function buildGenerationHandoverUrl(
  slug: string,
  handover: { title?: string | null; hasAudio: boolean },
): string {
  const params = new URLSearchParams({ autoplay: '1', [GENERATION_HANDOVER_PARAM]: '1' });
  const title = handover.title?.trim();
  if (title) params.set('t', title);
  if (handover.hasAudio) params.set('a', '1');
  return `/shows/${slug}/preview?${params.toString()}`;
}

type SearchParamsLike = {
  get(name: string): string | null;
};

/** Handover context carried on the preview URL, or null for an ordinary visit. */
export function parseGenerationHandover(
  searchParams: SearchParamsLike | Record<string, string | string[] | undefined> | null | undefined,
): GenerationHandover | null {
  if (!searchParams) return null;
  const read = (name: string): string | null => {
    if (typeof (searchParams as SearchParamsLike).get === 'function') {
      return (searchParams as SearchParamsLike).get(name);
    }
    const value = (searchParams as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };
  if (read(GENERATION_HANDOVER_PARAM) !== '1') return null;
  const title = read('t')?.trim() || null;
  return { title, hasAudio: read('a') === '1' };
}

/**
 * Whether the splash should ask the server for fresh status now. Hidden tabs
 * wait (the visibility listener refreshes as soon as the tab returns) and a
 * refresh still being rendered is never stacked with another one.
 */
export function shouldPollGeneration(params: {
  status: 'running' | 'completed' | 'failed';
  pollIntervalMs: number | null;
  visibilityState: 'visible' | 'hidden' | 'prerender' | undefined;
  refreshPending?: boolean;
}): boolean {
  if (params.status !== 'running' || params.pollIntervalMs === null) return false;
  if (params.refreshPending) return false;
  return params.visibilityState !== 'hidden';
}

/**
 * The splash stays over the preview until the replay is genuinely watchable.
 * It never times out on its own: it leaves when the stage has something real
 * to show instead (a canvas or data failure) or when the user, offered an
 * honest way out after a slow wait, chooses to see the preview as it is.
 */
export function handoverSplashVisible(params: {
  handover: GenerationHandover | null;
  replayReady: boolean;
  stageError?: string | null;
  dismissed?: boolean;
}): boolean {
  if (params.handover == null || params.replayReady) return false;
  if (params.stageError) return false;
  return !params.dismissed;
}
