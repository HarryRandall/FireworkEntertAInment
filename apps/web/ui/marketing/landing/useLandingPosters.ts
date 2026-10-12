'use client';

/** Renders template stills one at a time through the renderer's shared poster context. */
import { useEffect, useState } from 'react';
import type { Design } from '@showcrafter/renderer';

// Four-to-three tiles at about twice their largest CSS size on the landing page.
const POSTER_WIDTH_PX = 480;
const POSTER_HEIGHT_PX = 360;

export type PosterState = {
  urls: Record<string, string>;
  failed: Record<string, true>;
};

// A busy GPU can miss the renderer's capture budget once; a second miss marks the tile.
const ATTEMPTS = 2;

/**
 * Captures a still per design once `enabled` turns true, revoking object URLs on unmount.
 * Stills arrive progressively; a design that fails twice is marked unavailable and the
 * rest still render.
 */
export function useLandingPosters(
  designs: readonly { key: string; design: Design }[],
  enabled: boolean,
): PosterState {
  const [state, setState] = useState<PosterState>({ urls: {}, failed: {} });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const created: string[] = [];
    async function still(design: Design): Promise<Blob | null> {
      const { poster } = await import('@showcrafter/renderer/view');
      for (let attempt = 0; attempt < ATTEMPTS && !cancelled; attempt += 1) {
        try {
          return await poster(null, design, { width: POSTER_WIDTH_PX, height: POSTER_HEIGHT_PX });
        } catch {
          // Retried below; the final miss is reported per tile.
        }
      }
      return null;
    }
    async function capture() {
      for (const { key, design } of designs) {
        const blob = await still(design).catch(() => null);
        if (cancelled) return;
        if (blob === null) {
          setState((current) => ({ ...current, failed: { ...current.failed, [key]: true } }));
          continue;
        }
        const url = URL.createObjectURL(blob);
        created.push(url);
        setState((current) => ({ ...current, urls: { ...current.urls, [key]: url } }));
      }
    }
    void capture();
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [designs, enabled]);
  return state;
}

/** True once the element comes within `margin` of the viewport, and from then on. */
export function useNearViewport<T extends Element>(
  element: T | null,
  margin = '400px 0px',
): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near || !element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, margin, near]);
  return near;
}
