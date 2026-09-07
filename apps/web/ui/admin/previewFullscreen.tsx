'use client';

/**
 * Shared fullscreen helpers for the firework replay surfaces. The show viewer
 * and the admin firework/effect editors all wrap a `FireworkReplayCanvas` in a
 * positioned container; the owner calls `usePreviewFullscreen()` for the state,
 * accessibility, Esc and scroll-lock wiring, flips the container into a fixed
 * overlay via className, and renders `PreviewFullscreenBackdrop` behind it.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type PreviewFullscreenOptions = {
  dialogLabel?: string;
  dialogLabelledBy?: string;
};

export type PreviewFullscreenContainerProps = {
  role?: 'dialog';
  'aria-modal'?: true;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  tabIndex?: -1;
};

export type PreviewFullscreen<Container extends HTMLElement = HTMLDivElement> = {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
  fullscreenContainerRef: RefObject<Container | null>;
  fullscreenContainerProps: PreviewFullscreenContainerProps;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type BackgroundBranchState = {
  element: Element;
  ariaHidden: string | null;
  hadInertAttribute: boolean;
};

function isolateBackgroundBranches(container: HTMLElement): () => void {
  const branches: BackgroundBranchState[] = [];
  let current: Element = container;

  while (current.parentElement) {
    const parent = current.parentElement;
    for (const sibling of parent.children) {
      if (sibling === current || sibling.hasAttribute('data-preview-fullscreen-layer')) continue;
      branches.push({
        element: sibling,
        ariaHidden: sibling.getAttribute('aria-hidden'),
        hadInertAttribute: sibling.hasAttribute('inert'),
      });
      sibling.setAttribute('aria-hidden', 'true');
      sibling.setAttribute('inert', '');
    }

    if (parent === document.body) break;
    current = parent;
  }

  return () => {
    for (const branch of branches) {
      if (branch.ariaHidden === null) branch.element.removeAttribute('aria-hidden');
      else branch.element.setAttribute('aria-hidden', branch.ariaHidden);

      if (!branch.hadInertAttribute) branch.element.removeAttribute('inert');
    }
  };
}

function focusableControls(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (control) => !control.closest('[hidden], [aria-hidden="true"], [inert]'),
  );
}

export function usePreviewFullscreen<Container extends HTMLElement = HTMLDivElement>({
  dialogLabel,
  dialogLabelledBy,
}: PreviewFullscreenOptions = {}): PreviewFullscreen<Container> {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const fullscreenContainerRef = useRef<Container | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const hasDialogLabel = Boolean(dialogLabel || dialogLabelledBy);

  const toggleFullscreen = useCallback(() => {
    const nextFullscreen = !isFullscreenRef.current;
    if (nextFullscreen && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    isFullscreenRef.current = nextFullscreen;
    setIsFullscreen(nextFullscreen);
  }, []);
  const exitFullscreen = useCallback(() => {
    isFullscreenRef.current = false;
    setIsFullscreen(false);
  }, []);

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

  useEffect(() => {
    if (!isFullscreen || !hasDialogLabel) return;
    const container = fullscreenContainerRef.current;
    if (!container) return;

    const restoreBackground = isolateBackgroundBranches(container);
    container.focus({ preventScroll: true });
    const dialogContainer: HTMLElement = container;

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      const controls = focusableControls(dialogContainer);
      const first = controls[0];
      const last = controls.at(-1);
      const active = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        dialogContainer.focus({ preventScroll: true });
        return;
      }

      if (!dialogContainer.contains(active) || active === dialogContainer) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      restoreBackground();
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [hasDialogLabel, isFullscreen]);

  const fullscreenContainerProps: PreviewFullscreenContainerProps =
    isFullscreen && hasDialogLabel
      ? {
          role: 'dialog',
          'aria-modal': true,
          ...(dialogLabelledBy
            ? { 'aria-labelledby': dialogLabelledBy }
            : { 'aria-label': dialogLabel }),
          tabIndex: -1,
        }
      : {};

  return {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    fullscreenContainerRef,
    fullscreenContainerProps,
  };
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
      data-preview-fullscreen-layer
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-[2px]"
      onClick={onExit}
      aria-hidden="true"
    />,
    document.body,
  );
}
