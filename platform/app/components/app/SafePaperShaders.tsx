'use client';

/**
 * Safe wrappers around the paper-design React shader components.
 *
 * The upstream components pass `getShaderNoiseTexture()` as a fresh
 * HTMLImageElement. React ShaderMount only waits for string image uniforms, so
 * WebGL can receive an incomplete `u_noiseTexture` and throw. These wrappers
 * keep the public props we use, but pass the same texture as a URL so the
 * package's loader waits before mounting the shader.
 */
import { memo } from 'react';
import { ShaderMount } from '@paper-design/shaders-react';
import type {
  GodRaysProps,
  GrainGradientProps,
  MeshGradientProps,
  SimplexNoiseProps,
  WarpProps,
} from '@paper-design/shaders-react';
import {
  defaultObjectSizing,
  defaultPatternSizing,
  getShaderColorFromString,
  getShaderNoiseTexture,
  godRaysFragmentShader,
  GrainGradientShapes,
  grainGradientFragmentShader,
  meshGradientFragmentShader,
  ShaderFitOptions,
  simplexNoiseFragmentShader,
  WarpPatterns,
  warpFragmentShader,
} from '@paper-design/shaders';
import type { ShaderSizingParams } from '@paper-design/shaders';

function noiseTextureUniform() {
  if (typeof window === 'undefined') return {};
  const image = getShaderNoiseTexture();
  return image?.src ? { u_noiseTexture: image.src } : {};
}

function sizingUniforms(sizing: Required<ShaderSizingParams>) {
  return {
    u_fit: ShaderFitOptions[sizing.fit],
    u_scale: sizing.scale,
    u_rotation: sizing.rotation,
    u_offsetX: sizing.offsetX,
    u_offsetY: sizing.offsetY,
    u_originX: sizing.originX,
    u_originY: sizing.originY,
    u_worldWidth: sizing.worldWidth,
    u_worldHeight: sizing.worldHeight,
  };
}

function colourUniforms(colors: string[]) {
  return colors.map(getShaderColorFromString);
}

export const MeshGradient = memo(function SafeMeshGradient({
  speed = 1,
  frame = 0,
  colors = ['#e0eaff', '#241d9a', '#f75092', '#9f50d3'],
  distortion = 0.8,
  swirl = 0.1,
  grainMixer = 0,
  grainOverlay = 0,
  fit = defaultObjectSizing.fit,
  rotation = defaultObjectSizing.rotation,
  scale = defaultObjectSizing.scale,
  originX = defaultObjectSizing.originX,
  originY = defaultObjectSizing.originY,
  offsetX = defaultObjectSizing.offsetX,
  offsetY = defaultObjectSizing.offsetY,
  worldWidth = defaultObjectSizing.worldWidth,
  worldHeight = defaultObjectSizing.worldHeight,
  ...props
}: MeshGradientProps) {
  return (
    <ShaderMount
      {...props}
      speed={speed}
      frame={frame}
      fragmentShader={meshGradientFragmentShader}
      uniforms={{
        u_colors: colourUniforms(colors),
        u_colorsCount: colors.length,
        u_distortion: distortion,
        u_swirl: swirl,
        u_grainMixer: grainMixer,
        u_grainOverlay: grainOverlay,
        ...sizingUniforms({
          fit,
          scale,
          rotation,
          originX,
          originY,
          offsetX,
          offsetY,
          worldWidth,
          worldHeight,
        }),
      }}
    />
  );
});
MeshGradient.displayName = 'SafeMeshGradient';

export const SimplexNoise = memo(function SafeSimplexNoise({
  speed = 0.5,
  frame = 0,
  colors = ['#4449CF', '#FFD1E0', '#F94446', '#FFD36B', '#FFFFFF'],
  stepsPerColor = 2,
  softness = 0,
  fit = defaultPatternSizing.fit,
  scale = defaultPatternSizing.scale,
  rotation = defaultPatternSizing.rotation,
  originX = defaultPatternSizing.originX,
  originY = defaultPatternSizing.originY,
  offsetX = defaultPatternSizing.offsetX,
  offsetY = defaultPatternSizing.offsetY,
  worldWidth = defaultPatternSizing.worldWidth,
  worldHeight = defaultPatternSizing.worldHeight,
  ...props
}: SimplexNoiseProps) {
  return (
    <ShaderMount
      {...props}
      speed={speed}
      frame={frame}
      fragmentShader={simplexNoiseFragmentShader}
      uniforms={{
        u_colors: colourUniforms(colors),
        u_colorsCount: colors.length,
        u_stepsPerColor: stepsPerColor,
        u_softness: softness,
        ...sizingUniforms({
          fit,
          scale,
          rotation,
          originX,
          originY,
          offsetX,
          offsetY,
          worldWidth,
          worldHeight,
        }),
      }}
    />
  );
});
SimplexNoise.displayName = 'SafeSimplexNoise';

export const Warp = memo(function SafeWarp({
  speed = 1,
  frame = 0,
  colors = ['#121212', '#9470ff', '#121212', '#8838ff'],
  proportion = 0.45,
  softness = 1,
  distortion = 0.25,
  swirl = 0.8,
  swirlIterations = 10,
  shapeScale = 0.1,
  shape = 'checks',
  fit = defaultPatternSizing.fit,
  scale = defaultPatternSizing.scale,
  rotation = defaultPatternSizing.rotation,
  originX = defaultPatternSizing.originX,
  originY = defaultPatternSizing.originY,
  offsetX = defaultPatternSizing.offsetX,
  offsetY = defaultPatternSizing.offsetY,
  worldWidth = defaultPatternSizing.worldWidth,
  worldHeight = defaultPatternSizing.worldHeight,
  ...props
}: WarpProps) {
  return (
    <ShaderMount
      {...props}
      speed={speed}
      frame={frame}
      fragmentShader={warpFragmentShader}
      uniforms={{
        u_colors: colourUniforms(colors),
        u_colorsCount: colors.length,
        u_proportion: proportion,
        u_softness: softness,
        u_distortion: distortion,
        u_swirl: swirl,
        u_swirlIterations: swirlIterations,
        u_shapeScale: shapeScale,
        u_shape: WarpPatterns[shape],
        ...noiseTextureUniform(),
        ...sizingUniforms({
          fit,
          scale,
          rotation,
          originX,
          originY,
          offsetX,
          offsetY,
          worldWidth,
          worldHeight,
        }),
      }}
    />
  );
});
Warp.displayName = 'SafeWarp';

export const GodRays = memo(function SafeGodRays({
  speed = 0.75,
  frame = 0,
  colorBloom = '#0000ff',
  colorBack = '#000000',
  colors = ['#a600ff6e', '#6200fff0', '#ffffff', '#33fff5'],
  density = 0.3,
  spotty = 0.3,
  midIntensity = 0.4,
  midSize = 0.2,
  intensity = 0.8,
  bloom = 0.4,
  fit = defaultObjectSizing.fit,
  scale = defaultObjectSizing.scale,
  rotation = defaultObjectSizing.rotation,
  originX = defaultObjectSizing.originX,
  originY = defaultObjectSizing.originY,
  offsetX = 0,
  offsetY = -0.55,
  worldWidth = defaultObjectSizing.worldWidth,
  worldHeight = defaultObjectSizing.worldHeight,
  ...props
}: GodRaysProps) {
  return (
    <ShaderMount
      {...props}
      speed={speed}
      frame={frame}
      fragmentShader={godRaysFragmentShader}
      uniforms={{
        u_colorBloom: getShaderColorFromString(colorBloom),
        u_colorBack: getShaderColorFromString(colorBack),
        u_colors: colourUniforms(colors),
        u_colorsCount: colors.length,
        u_density: density,
        u_spotty: spotty,
        u_midIntensity: midIntensity,
        u_midSize: midSize,
        u_intensity: intensity,
        u_bloom: bloom,
        ...noiseTextureUniform(),
        ...sizingUniforms({
          fit,
          scale,
          rotation,
          originX,
          originY,
          offsetX,
          offsetY,
          worldWidth,
          worldHeight,
        }),
      }}
    />
  );
});
GodRays.displayName = 'SafeGodRays';

export const GrainGradient = memo(function SafeGrainGradient({
  speed = 1,
  frame = 0,
  colorBack = '#000000',
  colors = ['#7300ff', '#eba8ff', '#00bfff', '#2a00ff'],
  softness = 0.5,
  intensity = 0.5,
  noise = 0.25,
  shape = 'corners',
  fit = defaultObjectSizing.fit,
  scale = defaultObjectSizing.scale,
  rotation = defaultObjectSizing.rotation,
  originX = defaultObjectSizing.originX,
  originY = defaultObjectSizing.originY,
  offsetX = defaultObjectSizing.offsetX,
  offsetY = defaultObjectSizing.offsetY,
  worldWidth = defaultObjectSizing.worldWidth,
  worldHeight = defaultObjectSizing.worldHeight,
  ...props
}: GrainGradientProps) {
  return (
    <ShaderMount
      {...props}
      speed={speed}
      frame={frame}
      fragmentShader={grainGradientFragmentShader}
      uniforms={{
        u_colorBack: getShaderColorFromString(colorBack),
        u_colors: colourUniforms(colors),
        u_colorsCount: colors.length,
        u_softness: softness,
        u_intensity: intensity,
        u_noise: noise,
        u_shape: GrainGradientShapes[shape],
        ...noiseTextureUniform(),
        ...sizingUniforms({
          fit,
          scale,
          rotation,
          originX,
          originY,
          offsetX,
          offsetY,
          worldWidth,
          worldHeight,
        }),
      }}
    />
  );
});
GrainGradient.displayName = 'SafeGrainGradient';
