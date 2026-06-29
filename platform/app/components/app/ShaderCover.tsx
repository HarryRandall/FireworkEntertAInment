'use client';

/**
 * ShaderCover — renders a saved {@link ShaderCover} config as a paper-shader
 * surface. Used as the full-bleed animated background on the generating screen
 * and (optionally) as cover art elsewhere. Sparse shaders use a backdrop
 * derived from the show palette so cover tiles never collapse into the app
 * background.
 */
import {
  GodRays,
  GrainGradient,
  MeshGradient,
  SimplexNoise,
  Warp,
} from '@/app/components/app/SafePaperShaders';
import {
  shaderCoverBackdropColor,
  shaderCoverGradient,
  type ShaderCover as ShaderCoverConfig,
} from '@/lib/shader-cover';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Skeleton } from '@/app/components/ui/Feedback';

export function ShaderCover({
  cover,
  animate = true,
  className,
  showSkeletonUntilReady = false,
}: {
  cover: ShaderCoverConfig;
  /** When false, use the lowest viable shader speed so static covers still paint reliably. */
  animate?: boolean;
  className?: string;
  /** Mask the poster-to-canvas startup so cards reveal only once their shader has painted. */
  showSkeletonUntilReady?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const colorBack = shaderCoverBackdropColor(cover);
  const gradient = shaderCoverGradient(cover);
  const speed = animate ? cover.speed : 0;
  const rootClassName = cn('absolute inset-0 h-full w-full overflow-hidden', className);
  const readinessKey = useMemo(
    () => `${cover.kind}:${cover.frame}:${cover.colors.join('|')}`,
    [cover.colors, cover.frame, cover.kind],
  );
  const common = {
    width: '100%',
    height: '100%',
    fit: 'cover' as const,
    speed: animate ? speed : 0.001,
    frame: cover.frame,
    scale: cover.scale,
    rotation: cover.rotation,
    className: 'absolute inset-0 h-full w-full',
  };

  let shader: ReactNode;
  if (cover.kind === 'mesh-gradient') {
    shader = (
      <MeshGradient
        {...common}
        colors={cover.colors}
        distortion={cover.distortion}
        swirl={cover.swirl}
        grainMixer={cover.grainMixer}
        grainOverlay={0}
      />
    );
  } else if (cover.kind === 'warp') {
    shader = (
      <Warp
        {...common}
        colors={cover.colors}
        proportion={cover.proportion}
        softness={cover.softness}
        distortion={cover.distortion}
        swirl={cover.swirl}
        swirlIterations={cover.swirlIterations}
        shape={cover.warpShape}
        shapeScale={cover.warpShape === 'edge' ? 0 : cover.shapeScale}
      />
    );
  } else if (cover.kind === 'simplex-noise') {
    shader = (
      <SimplexNoise
        {...common}
        colors={cover.colors}
        stepsPerColor={cover.stepsPerColor}
        softness={0}
      />
    );
  } else if (cover.kind === 'god-rays') {
    shader = (
      <GodRays
        {...common}
        colors={cover.colors}
        colorBack={colorBack}
        colorBloom={cover.colors[0]}
        bloom={0}
        intensity={cover.intensity}
        density={cover.density}
        spotty={cover.spotty}
        midSize={cover.midSize}
        midIntensity={cover.midIntensity}
      />
    );
  } else {
    shader = (
      <GrainGradient
        {...common}
        colors={cover.colors}
        colorBack={colorBack}
        softness={cover.softness}
        intensity={Math.max(0.35, Math.min(cover.intensity, 0.7))}
        noise={0}
        shape={cover.grainShape}
      />
    );
  }

  useEffect(() => {
    const loadingNode = rootRef.current?.querySelector<HTMLElement>('[data-cover-loading]');

    function setLoadingVisible(visible: boolean) {
      if (!loadingNode) return;
      loadingNode.style.opacity = visible ? '1' : '0';
      loadingNode.style.visibility = visible ? 'visible' : 'hidden';
      loadingNode.style.pointerEvents = 'none';
    }

    if (!showSkeletonUntilReady) {
      setLoadingVisible(false);
      return;
    }

    setLoadingVisible(true);

    let cancelled = false;
    let paintFrame = 0;
    let settleFrame = 0;
    let observer: MutationObserver | null = null;

    function revealAfterPaint() {
      if (cancelled) return;
      paintFrame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(() => {
          if (!cancelled) setLoadingVisible(false);
        });
      });
    }

    function hasPaintableCanvas() {
      const canvas = rootRef.current?.querySelector('canvas');
      return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
    }

    function checkReady() {
      if (!hasPaintableCanvas()) return;
      observer?.disconnect();
      observer = null;
      revealAfterPaint();
    }

    if (!hasPaintableCanvas()) {
      const root = rootRef.current;
      if (root) {
        observer = new MutationObserver(checkReady);
        observer.observe(root, {
          attributes: true,
          attributeFilter: ['height', 'width'],
          childList: true,
          subtree: true,
        });
      }
    } else {
      revealAfterPaint();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.cancelAnimationFrame(paintFrame);
      window.cancelAnimationFrame(settleFrame);
    };
  }, [readinessKey, showSkeletonUntilReady]);

  return (
    <div ref={rootRef} className={rootClassName}>
      <div className="absolute inset-0 h-full w-full" style={{ background: gradient }} />
      {shader}
      {!animate ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
          style={{ background: gradient }}
        />
      ) : null}
      {showSkeletonUntilReady ? (
        <div
          data-cover-loading
          aria-hidden="true"
          className="absolute inset-0 z-20 transition-opacity duration-150"
        >
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      ) : null}
    </div>
  );
}
