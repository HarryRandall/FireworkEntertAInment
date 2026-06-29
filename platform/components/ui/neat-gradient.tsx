'use client';

import { useEffect, useRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import type { NeatConfig, NeatGradient as NeatGradientInstance } from '@firecms/neat';
import { cn } from '@/lib/utils';

export const rainbowMatrixNeatConfig = {
  colors: [
    {
      color: '#FD113F',
      enabled: true,
    },
    {
      color: '#90E0FF',
      enabled: true,
    },
    {
      color: '#FFC858',
      enabled: true,
    },
    {
      color: '#753BFF',
      enabled: true,
    },
    {
      color: '#f5e1e5',
      enabled: false,
    },
    {
      color: '#B8D4E6',
      enabled: false,
    },
  ],
  speed: 2,
  horizontalPressure: 5,
  verticalPressure: 6,
  waveFrequencyX: 1,
  waveFrequencyY: 2,
  waveAmplitude: 10,
  shadows: 0,
  highlights: 7,
  colorBrightness: 1.05,
  colorSaturation: 0,
  wireframe: false,
  colorBlending: 9,
  backgroundColor: '#003FFF',
  backgroundAlpha: 1,
  grainScale: 0,
  grainSparsity: 0,
  grainIntensity: 0,
  grainSpeed: 0,
  resolution: 1,
  yOffset: 106,
  yOffsetWaveMultiplier: 6.5,
  yOffsetColorMultiplier: 5,
  yOffsetFlowMultiplier: 3,
  flowDistortionA: 2.8,
  flowDistortionB: 2.4,
  flowScale: 1.5,
  flowEase: 0.41,
  flowEnabled: false,
  enableProceduralTexture: false,
  transparentTextureVoid: false,
  textureVoidLikelihood: 0.06,
  textureVoidWidthMin: 10,
  textureVoidWidthMax: 500,
  textureBandDensity: 0.8,
  textureColorBlending: 0.06,
  textureSeed: 333,
  textureEase: 0.4,
  proceduralBackgroundColor: '#FFED00',
  textureShapeTriangles: 20,
  textureShapeCircles: 15,
  textureShapeBars: 15,
  textureShapeSquiggles: 10,
  domainWarpEnabled: false,
  domainWarpIntensity: 0,
  domainWarpScale: 3,
  vignetteIntensity: 0,
  vignetteRadius: 0.8,
  fresnelEnabled: false,
  fresnelPower: 2,
  fresnelIntensity: 0.5,
  fresnelColor: '#FFFFFF',
  iridescenceEnabled: false,
  iridescenceIntensity: 0.5,
  iridescenceSpeed: 1,
  bloomIntensity: 0,
  bloomThreshold: 0.7,
  chromaticAberration: 0,
  shapeType: 'plane',
  shapeRotationX: 0,
  shapeRotationY: 0,
  shapeRotationZ: 0,
  shapeAutoRotateSpeedX: 0,
  shapeAutoRotateSpeedY: 0,
  sphereRadius: 15,
  torusRadius: 15,
  torusTube: 5,
  cylinderRadius: 10,
  cylinderHeight: 40,
  planeBend: 0,
  planeTwist: 0,
  silhouetteFade: 0.25,
  cylinderFade: 0.08,
  ribbonFade: 0.05,
  flatShading: true,
  cameraLock: true,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
  cameraRotationX: 0,
  cameraRotationY: 0,
  cameraRotationZ: 0,
  cameraZoom: 1,
} satisfies NeatConfig;

type NeatGradientCanvasProps = Omit<ComponentPropsWithoutRef<'canvas'>, 'ref'> & {
  config?: Partial<NeatConfig>;
  scrollReactive?: boolean;
};

export function NeatGradientCanvas({
  className,
  config,
  scrollReactive = true,
  ...canvasProps
}: NeatGradientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gradientRef = useRef<NeatGradientInstance | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let cancelled = false;
    let gradient: NeatGradientInstance | null = null;
    let removeScrollListener: (() => void) | null = null;
    const mergedConfig: NeatConfig = {
      ...rainbowMatrixNeatConfig,
      ...config,
      colors: config?.colors ?? rainbowMatrixNeatConfig.colors,
    };

    void import('@firecms/neat').then(({ NeatGradient }) => {
      if (cancelled) {
        return;
      }

      gradient = new NeatGradient({
        ref: canvas,
        ...mergedConfig,
      });
      gradientRef.current = gradient;

      if (scrollReactive) {
        const syncScrollOffset = () => {
          if (gradient) {
            gradient.yOffset = window.scrollY;
          }
        };

        window.addEventListener('scroll', syncScrollOffset, { passive: true });
        syncScrollOffset();
        removeScrollListener = () => window.removeEventListener('scroll', syncScrollOffset);
      }
    });

    return () => {
      cancelled = true;
      removeScrollListener?.();
      gradient?.destroy();
      gradientRef.current = null;
    };
  }, [config, scrollReactive]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('block h-full w-full', className)}
      aria-hidden="true"
      {...canvasProps}
    />
  );
}

export const Component = NeatGradientCanvas;
