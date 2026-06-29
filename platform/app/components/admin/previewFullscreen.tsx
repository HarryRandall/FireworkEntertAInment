'use client';

/**
 * Shared fullscreen helpers for the firework replay surfaces. The show viewer
 * and the admin firework/effect editors all wrap a `FireworkReplayCanvas` in a
 * positioned container; the owner calls `usePreviewFullscreen()` for the state
 * + Esc/scroll-lock wiring, flips the container into a `fixed inset-[5vmin]`
 * overlay via className, and renders `PreviewFullscreenBackdrop` behind it.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type PreviewFullscreen = {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
};

export function usePreviewFullscreen(): PreviewFullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((current) => !current), []);
  const exitFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') exitFullscreen();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen, exitFullscreen]);

  return { isFullscreen, toggleFullscreen, exitFullscreen };
}

/**
 * Dimmed, lightly blurred backdrop portalled to the document body so it sits
 * behind the fullscreen box regardless of where the owner is mounted. Clicking
 * it exits fullscreen.
 */
export function PreviewFullscreenBackdrop({ onExit }: { onExit: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-[2px]"
      onClick={onExit}
      aria-hidden="true"
    />,
    document.body,
  );
}
