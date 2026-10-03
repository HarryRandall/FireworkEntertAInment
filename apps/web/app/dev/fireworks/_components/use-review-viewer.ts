/** Live viewer lifecycle and independent cancellable thumbnail generation. */
'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Viewer } from '@showcrafter/fireworks/view';
import { mountReviewViewer, type ReviewSetters } from './review-viewer-lifecycle';
import { entries } from './review-catalogue';
import type { ReviewState } from './review-state';
/** Owns a single viewer, cleaning it up on a retry or unmount and mirroring its readout. */
export function useReviewViewer(
  host: RefObject<HTMLDivElement | null>,
  generation: number,
  setSelected: ReviewSetters['setSelected'],
) {
  const viewer = useRef<Viewer | null>(null);
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ReviewState>({
    t: 0,
    duration: 0,
    playing: false,
    count: 0,
    gpuCandidateCount: 0,
    hdr: false,
    sprayMode: 'gpu',
    shotCount: 1,
    timing: { medianMs: 0, p95Ms: 0, samples: 0, window: 0 },
    frameMs: 0,
    profile: null,
  });
  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    return mountReviewViewer(
      { setPosters, setError, setReady, setState, setSelected },
      viewer,
      () =>
        new Viewer(element, {
          design: entries[0].design,
          autoplay: false,
          forceLdr: new URLSearchParams(location.search).has('ldr'),
        }),
    );
  }, [host, generation, setSelected]);
  return { viewer, posters, error, ready, state };
}
