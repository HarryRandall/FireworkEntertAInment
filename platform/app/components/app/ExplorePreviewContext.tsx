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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TemplateReplayPreview } from '@/app/components/app/TemplateReplayPreview';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { ShowTemplate } from '@/lib/admin.types';

type PreviewContextValue = {
  activeId: string | null;
  requestPreview: (id: string, element: HTMLElement, template: ShowTemplate) => void;
  releasePreview: (id: string) => void;
};

const ExplorePreviewContext = createContext<PreviewContextValue | null>(null);

export function useExplorePreview() {
  return useContext(ExplorePreviewContext);
}

export function ExplorePreviewProvider({
  specifications,
  children,
}: {
  specifications: FireworkSpecification[];
  children: ReactNode;
}) {
  const [active, setActive] = useState<{ id: string; element: HTMLElement } | null>(null);
  // The most recently previewed template; kept mounted so the warm canvas
  // always has a show to render and a new hover only swaps cues.
  const [mountedTemplate, setMountedTemplate] = useState<ShowTemplate | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

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

  const cancelActivePreview = useCallback(() => {
    parkOverlay();
    setActive(null);
  }, [parkOverlay]);

  const requestPreview = useCallback((id: string, element: HTMLElement, template: ShowTemplate) => {
    setMountedTemplate(template);
    setActive({ id, element });
  }, []);

  const releasePreview = useCallback((id: string) => {
    setActive((current) => (current && current.id === id ? null : current));
  }, []);

  // Wheel/scroll can leave the pointer "hovering" while the card moves under
  // it. Hide the fixed replay overlay immediately so it cannot bleed between
  // cards or rows during scroll.
  useEffect(() => {
    if (!active) return;

    const options = { capture: true, passive: true } as const;
    window.addEventListener('wheel', cancelActivePreview, options);
    window.addEventListener('scroll', cancelActivePreview, options);
    window.addEventListener('touchmove', cancelActivePreview, options);
    return () => {
      window.removeEventListener('wheel', cancelActivePreview, options);
      window.removeEventListener('scroll', cancelActivePreview, options);
      window.removeEventListener('touchmove', cancelActivePreview, options);
    };
  }, [active, cancelActivePreview]);

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
      overlay.style.opacity = '1';
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
      value={{ activeId: active?.id ?? null, requestPreview, releasePreview }}
    >
      {children}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-30 overflow-hidden rounded-xl opacity-0"
        style={{ transform: 'translate(-9999px, -9999px)' }}
      >
        {mountedTemplate ? (
          <TemplateReplayPreview
            template={mountedTemplate}
            specifications={specifications}
            isCardHovered={active !== null}
            showCardOverlays={false}
            cardClassName="absolute inset-0 h-full w-full overflow-hidden"
          />
        ) : null}
      </div>
    </ExplorePreviewContext.Provider>
  );
}
