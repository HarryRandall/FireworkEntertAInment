'use client';

/**
 * Keeps a show's artwork on screen when its cover engine throws, for example
 * when WebGL is unavailable or a context is lost mid-animation. The fallback
 * is the cover's own palette gradient, so the surface never goes blank.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { coverGradient, type ShowCover } from '@/lib/cover';

type CoverErrorBoundaryProps = {
  cover: ShowCover;
  children: ReactNode;
};

type CoverErrorBoundaryState = {
  failed: boolean;
};

export class CoverErrorBoundary extends Component<
  CoverErrorBoundaryProps,
  CoverErrorBoundaryState
> {
  state: CoverErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): CoverErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[cover] renderer failed, showing static artwork:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div
          aria-hidden="true"
          data-cover-fallback
          className="absolute inset-0 h-full w-full"
          style={{ background: coverGradient(this.props.cover) }}
        />
      );
    }
    return this.props.children;
  }
}
