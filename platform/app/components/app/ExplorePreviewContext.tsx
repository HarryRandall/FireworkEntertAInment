'use client';

/**
 * ExplorePreviewContext — keeps a single firework replay canvas alive and
 * positions it over whichever Explore card is hovered, swapping the show
 * rather than mounting a new WebGL context per card. A new 3D context per
 * hover is what makes scrubbing across many cards feel laggy.
 *
 * The canvas lives in one fixed overlay that never moves in the DOM (moving a
 * live WebGL canvas tears down its context); instead we track the hovered
 * card's screen rect each frame and position the overlay on top of it.
 */
import dynamic from 'next/dynamic';
import { Play } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  EXPLORE_PREVIEW_INTENT_MS,
  loadExplorePreview,
  type ExplorePreviewPayload,
} from '@/lib/explore-preview';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { ShowTemplate } from '@/lib/admin.types';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';

// Hover-intent delay: a card must be hovered (or focused) for this long before
// the heavy Three.js replay canvas loads and plays. Grazing the grid never
// loads WebGL; only a deliberate dwell triggers the black empty set -> play.

// Lazy-load the replay preview (and its Three.js canvas + Slider + icons) so it
// is not in the initial bundle; it mounts on first confirmed hover and stays
// warm.
const TemplateReplayPreview = dynamic(
  () =>
    import('@/app/components/app/TemplateReplayPreview').then((mod) => mod.TemplateReplayPreview),
  { ssr: false, loading: () => null },
);

type PreviewContextValue = {
  activeId: string | null;
  pendingId: string | null;
  /**
   * The active card whose replay canvas has actually painted. Cards keep their
   * static poster until they become the `readyId`, so the overlay only reveals
   * once there are real fireworks to show (never a black warm-up frame).
   */
  readyId: string | null;
  requestPreview: (id: string, element: HTMLElement, template: ShowTemplateSummary) => void;
  releasePreview: (id: string) => void;
};

const ExplorePreviewContext = createContext<PreviewContextValue | null>(null);

export function useExplorePreview() {
  return useContext(ExplorePreviewContext);
}

export function ExplorePreviewProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<{ id: string; element: HTMLElement } | null>(null);
  // A hover that has started but not yet survived the intent delay. While
  // pending, the card keeps showing its poster; only on confirm do we activate
  // the overlay and load the replay canvas.
  const [pending, setPending] = useState<{
    id: string;
    element: HTMLElement;
    template: ShowTemplateSummary;
  } | null>(null);
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSerialRef = useRef(0);
  const requestIdentityRef = useRef<{ id: string; serial: number } | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const previewCacheRef = useRef(new Map<string, ExplorePreviewPayload>());
  // The most recently previewed template; kept mounted so the warm canvas
  // always has a show to render and a new hover only swaps cues.
  const [mountedPreview, setMountedPreview] = useState<{
    template: ShowTemplate;
    specifications: FireworkSpecification[];
    requestSerial: number;
  } | null>(null);
  // Whether the active card's canvas has painted its first frame. Read live by
  // the follow loop (via the ref) so the overlay only fades in once ready.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current !== null) {
      clearTimeout(intentTimerRef.current);
      intentTimerRef.current = null;
    }
  }, []);

  const parkOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.transform = 'translate(-9999px, -9999px)';
    overlay.style.width = '0px';
    overlay.style.height = '0px';
    overlay.style.clipPath = 'inset(0 round 0.75rem)';
  }, []);

  const abortPreviewRequest = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  }, []);

  const cancelActivePreview = useCallback(() => {
    requestSerialRef.current += 1;
    requestIdentityRef.current = null;
    abortPreviewRequest();
    clearIntentTimer();
    setPending(null);
    parkOverlay();
    setActive(null);
  }, [abortPreviewRequest, clearIntentTimer, parkOverlay]);

  useEffect(() => {
    if (!prefersReducedMotion) return;
    cancelActivePreview();
  }, [cancelActivePreview, prefersReducedMotion]);

  const confirmPreview = useCallback(
    async (
      requestSerial: number,
      id: string,
      element: HTMLElement,
      template: ShowTemplateSummary,
    ) => {
      const previewKey = `${template.slug}:${template.updatedAt}`;
      let preview = previewCacheRef.current.get(previewKey);
      if (!preview) {
        const controller = new AbortController();
        requestAbortRef.current = controller;
        try {
          preview = await loadExplorePreview(template.slug, controller.signal);
          previewCacheRef.current.set(previewKey, preview);
        } catch {
          if (requestAbortRef.current === controller) requestAbortRef.current = null;
          if (requestSerialRef.current !== requestSerial) return;
          requestIdentityRef.current = null;
          setPending((current) => (current?.id === id ? null : current));
          setActive(null);
          parkOverlay();
          return;
        }
        if (requestAbortRef.current === controller) requestAbortRef.current = null;
      }

      if (requestSerialRef.current !== requestSerial) return;
      setPending((current) => (current?.id === id ? null : current));
      if (preview.previewCues.length === 0 || preview.specifications.length === 0) {
        requestIdentityRef.current = null;
        setActive(null);
        parkOverlay();
        return;
      }

      // Reset before mounting the next replay. A parent effect runs after the
      // canvas's mount effects and can otherwise overwrite its first onReady
      // signal, leaving the card stuck on Loading.
      readyRef.current = false;
      setReady(false);
      setMountedPreview({
        template: { ...template, previewCues: preview.previewCues },
        specifications: preview.specifications,
        requestSerial,
      });
      setActive({ id, element });
    },
    [parkOverlay],
  );

  const requestPreview = useCallback(
    (id: string, element: HTMLElement, template: ShowTemplateSummary) => {
      if (prefersReducedMotion) return;

      const requestSerial = requestSerialRef.current + 1;
      requestSerialRef.current = requestSerial;
      requestIdentityRef.current = { id, serial: requestSerial };
      abortPreviewRequest();
      clearIntentTimer();
      parkOverlay();
      setActive(null);
      setPending({ id, element, template });
      intentTimerRef.current = setTimeout(() => {
        intentTimerRef.current = null;
        void confirmPreview(requestSerial, id, element, template);
      }, EXPLORE_PREVIEW_INTENT_MS);
    },
    [abortPreviewRequest, clearIntentTimer, confirmPreview, parkOverlay, prefersReducedMotion],
  );

  const releasePreview = useCallback(
    (id: string) => {
      if (requestIdentityRef.current?.id !== id) return;
      requestSerialRef.current += 1;
      requestIdentityRef.current = null;
      abortPreviewRequest();
      clearIntentTimer();
      setPending((current) => (current && current.id === id ? null : current));
      setActive((current) => (current && current.id === id ? null : current));
      parkOverlay();
    },
    [abortPreviewRequest, clearIntentTimer, parkOverlay],
  );

  useEffect(
    () => () => {
      requestSerialRef.current += 1;
      requestIdentityRef.current = null;
      abortPreviewRequest();
      clearIntentTimer();
    },
    [abortPreviewRequest, clearIntentTimer],
  );

  // Wheel/scroll can leave the pointer "hovering" while the card moves under
  // it. Hide the fixed replay overlay immediately and cancel any pending
  // hover-intent so it cannot confirm into a play mid-scroll.
  useEffect(() => {
    if (!active && !pending) return;

    const options = { capture: true, passive: true } as const;
    window.addEventListener('wheel', cancelActivePreview, options);
    window.addEventListener('scroll', cancelActivePreview, options);
    window.addEventListener('touchmove', cancelActivePreview, options);
    return () => {
      window.removeEventListener('wheel', cancelActivePreview, options);
      window.removeEventListener('scroll', cancelActivePreview, options);
      window.removeEventListener('touchmove', cancelActivePreview, options);
    };
  }, [active, pending, cancelActivePreview]);

  // Follow the active card's on-screen position each frame without re-rendering.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (!active) {
      parkOverlay();
      return;
    }

    let raf = 0;
    const follow = () => {
      if (!active.element.isConnected) {
        parkOverlay();
        return;
      }
      const rect = active.element.getBoundingClientRect();
      const scrollViewport = active.element.closest(
        '[data-explore-scroll-viewport]',
      ) as HTMLElement | null;
      const viewportRect = scrollViewport?.getBoundingClientRect();
      const maxScrollLeft = scrollViewport
        ? scrollViewport.scrollWidth - scrollViewport.clientWidth
        : 0;
      const fadeWidth = 48;
      const clipBounds = {
        left: Math.max(
          0,
          viewportRect
            ? viewportRect.left + (scrollViewport!.scrollLeft > 1 ? fadeWidth : 0)
            : rect.left,
        ),
        top: Math.max(0, viewportRect?.top ?? rect.top),
        right: Math.min(
          window.innerWidth,
          viewportRect
            ? viewportRect.right + (scrollViewport!.scrollLeft < maxScrollLeft - 1 ? -fadeWidth : 0)
            : rect.right,
        ),
        bottom: Math.min(window.innerHeight, viewportRect?.bottom ?? rect.bottom),
      };
      const visibleLeft = Math.max(rect.left, clipBounds.left);
      const visibleTop = Math.max(rect.top, clipBounds.top);
      const visibleRight = Math.min(rect.right, clipBounds.right);
      const visibleBottom = Math.min(rect.bottom, clipBounds.bottom);

      if (
        visibleBottom <= visibleTop ||
        visibleRight <= visibleLeft ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
      ) {
        overlay.style.opacity = '0';
        raf = requestAnimationFrame(follow);
        return;
      }
      // Keep the overlay hidden (poster showing through) until the canvas has
      // painted, then reveal it in place. Position still tracks the card so the
      // reveal lands exactly on top.
      overlay.style.opacity = readyRef.current ? '1' : '0';
      overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.clipPath = `inset(${visibleTop - rect.top}px ${rect.right - visibleRight}px ${rect.bottom - visibleBottom}px ${visibleLeft - rect.left}px round 0.75rem)`;
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [active, parkOverlay]);

  return (
    <ExplorePreviewContext.Provider
      value={useMemo(
        () => ({
          // Loading the bounded payload and warming WebGL are background work.
          // Cards only switch from their poster once a real frame is ready.
          activeId: active?.id ?? null,
          pendingId: pending?.id ?? null,
          readyId: ready ? (active?.id ?? null) : null,
          requestPreview,
          releasePreview,
        }),
        [active?.id, pending?.id, ready, requestPreview, releasePreview],
      )}
    >
      {children}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-30 overflow-hidden rounded-xl opacity-0"
        style={{ transform: 'translate(-9999px, -9999px)' }}
      >
        {mountedPreview && !prefersReducedMotion ? (
          <TemplateReplayPreview
            template={mountedPreview.template}
            specifications={mountedPreview.specifications}
            isCardHovered={active !== null}
            showCardOverlays={false}
            lazyHoverMount
            onReady={() => {
              if (requestSerialRef.current !== mountedPreview.requestSerial) return;
              readyRef.current = true;
              setReady(true);
            }}
            cardClassName="absolute inset-0 h-full w-full overflow-hidden"
          />
        ) : null}
        <span className="pointer-events-none absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
          <Play size={16} fill="currentColor" />
        </span>
      </div>
    </ExplorePreviewContext.Provider>
  );
}
