'use client';

import {
  GodRays,
  GrainGradient,
  MeshGradient,
  SimplexNoise,
  Warp,
} from '@/app/components/app/SafePaperShaders';
import { Palette, Shuffle, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { ColorPicker } from '@/app/components/ui/ColorPicker';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { cn } from '@/lib/utils';

type ShaderKind = 'grain-gradient' | 'mesh-gradient' | 'warp' | 'simplex-noise' | 'god-rays';

type GrainShape = 'wave' | 'dots' | 'truchet' | 'corners' | 'ripple' | 'blob' | 'sphere';
type WarpShape = 'checks' | 'stripes' | 'edge';

type ShaderState = {
  kind: ShaderKind;
  colors: string[];
  colorCount: number;
  colorBack: string;
  colorBloom: string;
  speed: number;
  frame: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  softness: number;
  intensity: number;
  noise: number;
  grainShape: GrainShape;
  distortion: number;
  swirl: number;
  grainMixer: number;
  grainOverlay: number;
  proportion: number;
  swirlIterations: number;
  warpShape: WarpShape;
  shapeScale: number;
  stepsPerColor: number;
  bloom: number;
  density: number;
  spotty: number;
  midSize: number;
  midIntensity: number;
  count: number;
  size: number;
};

type ShaderDefinition = {
  kind: ShaderKind;
  label: string;
  shortLabel: string;
  description: string;
  maxColors: number;
  hasBack?: boolean;
  hasBloom?: boolean;
};

const SHADERS: ShaderDefinition[] = [
  {
    kind: 'grain-gradient',
    label: 'Grain Gradient',
    shortLabel: 'Grain',
    description: 'Noise-textured abstract gradient forms.',
    maxColors: 7,
    hasBack: true,
  },
  {
    kind: 'mesh-gradient',
    label: 'Mesh Gradient',
    shortLabel: 'Mesh',
    description: 'Moving colour spots with organic distortion.',
    maxColors: 10,
  },
  {
    kind: 'warp',
    label: 'Warp',
    shortLabel: 'Warp',
    description: 'Warped colour fields over checks, stripes, or edge splits.',
    maxColors: 10,
  },
  {
    kind: 'simplex-noise',
    label: 'Simplex Noise',
    shortLabel: 'Simplex',
    description: 'Multi-colour curves built from animated Simplex noise.',
    maxColors: 10,
  },
  {
    kind: 'god-rays',
    label: 'God Rays',
    shortLabel: 'Rays',
    description: 'Radiating light shafts with bloom and centre glow.',
    maxColors: 5,
    hasBack: true,
    hasBloom: true,
  },
];

const DEFAULT_STATE: Record<ShaderKind, ShaderState> = {
  'grain-gradient': {
    kind: 'grain-gradient',
    colors: ['#7300ff', '#eba8ff', '#00bfff', '#2b00ff'],
    colorCount: 4,
    colorBack: '#000000',
    colorBloom: '#0000ff',
    speed: 1,
    frame: 0,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    softness: 0.5,
    intensity: 0.5,
    noise: 0.25,
    grainShape: 'corners',
    distortion: 0.8,
    swirl: 0.1,
    grainMixer: 0,
    grainOverlay: 0,
    proportion: 0.45,
    swirlIterations: 10,
    warpShape: 'checks',
    shapeScale: 0.1,
    stepsPerColor: 2,
    bloom: 0.4,
    density: 0.3,
    spotty: 0.3,
    midSize: 0.2,
    midIntensity: 0.4,
    count: 10,
    size: 0.83,
  },
  'mesh-gradient': {
    kind: 'mesh-gradient',
    colors: ['#e0eaff', '#241d9a', '#f75092', '#9f50d3'],
    colorCount: 4,
    colorBack: '#000000',
    colorBloom: '#0000ff',
    speed: 1,
    frame: 0,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    softness: 0.5,
    intensity: 0.5,
    noise: 0.25,
    grainShape: 'corners',
    distortion: 0.8,
    swirl: 0.1,
    grainMixer: 0,
    grainOverlay: 0,
    proportion: 0.45,
    swirlIterations: 10,
    warpShape: 'checks',
    shapeScale: 0.1,
    stepsPerColor: 2,
    bloom: 0.4,
    density: 0.3,
    spotty: 0.3,
    midSize: 0.2,
    midIntensity: 0.4,
    count: 10,
    size: 0.83,
  },
  warp: {
    kind: 'warp',
    colors: ['#121212', '#9470ff', '#121212', '#8838ff'],
    colorCount: 4,
    colorBack: '#000000',
    colorBloom: '#0000ff',
    speed: 1,
    frame: 0,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    softness: 1,
    intensity: 0.5,
    noise: 0.25,
    grainShape: 'corners',
    distortion: 0.25,
    swirl: 0.8,
    grainMixer: 0,
    grainOverlay: 0,
    proportion: 0.45,
    swirlIterations: 10,
    warpShape: 'checks',
    shapeScale: 0.1,
    stepsPerColor: 2,
    bloom: 0.4,
    density: 0.3,
    spotty: 0.3,
    midSize: 0.2,
    midIntensity: 0.4,
    count: 10,
    size: 0.83,
  },
  'simplex-noise': {
    kind: 'simplex-noise',
    colors: ['#4449cf', '#ffd1e0', '#f94346', '#ffd36b', '#ffffff'],
    colorCount: 5,
    colorBack: '#000000',
    colorBloom: '#0000ff',
    speed: 1,
    frame: 0,
    scale: 0.6,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    softness: 0,
    intensity: 0.5,
    noise: 0.25,
    grainShape: 'corners',
    distortion: 0.8,
    swirl: 0.1,
    grainMixer: 0,
    grainOverlay: 0,
    proportion: 0.45,
    swirlIterations: 10,
    warpShape: 'checks',
    shapeScale: 0.1,
    stepsPerColor: 2,
    bloom: 0.4,
    density: 0.3,
    spotty: 0.3,
    midSize: 0.2,
    midIntensity: 0.4,
    count: 10,
    size: 0.83,
  },
  'god-rays': {
    kind: 'god-rays',
    colors: ['#a600ff', '#6200ff', '#ffffff', '#33fff5'],
    colorCount: 4,
    colorBack: '#000000',
    colorBloom: '#0000ff',
    speed: 1,
    frame: 0,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: -0.55,
    softness: 0.5,
    intensity: 0.8,
    noise: 0.25,
    grainShape: 'corners',
    distortion: 0.8,
    swirl: 0.1,
    grainMixer: 0,
    grainOverlay: 0,
    proportion: 0.45,
    swirlIterations: 10,
    warpShape: 'checks',
    shapeScale: 0.1,
    stepsPerColor: 2,
    bloom: 0.4,
    density: 0.3,
    spotty: 0.3,
    midSize: 0.2,
    midIntensity: 0.4,
    count: 10,
    size: 0.83,
  },
};

const COLOR_PRESETS = [
  '#00e5ff',
  '#3b82f6',
  '#8b5cf6',
  '#ff3df2',
  '#ffd166',
  '#00ff9c',
  '#ff4d6d',
  '#ffffff',
  '#0b1020',
  '#000000',
] as const;

const GRAIN_SHAPES: GrainShape[] = [
  'corners',
  'wave',
  'dots',
  'truchet',
  'ripple',
  'blob',
  'sphere',
];
const WARP_SHAPES: WarpShape[] = ['checks', 'stripes', 'edge'];
const MIN_COLOUR_COUNT = 3;
const MAX_RANDOM_COLOUR_COUNT = 6;
const MIN_SPEED = 1;
const MAX_SPEED = 4;
const DEFAULT_SCALE_RANGE = { min: 0.05, max: 4 };
const GRAIN_SCALE_RANGE = { min: 0.4, max: 1.5 };

/** Per-shader ranges used by the "Randomise effect" button. */
const RANDOM_SPEED_RANGE: Record<ShaderKind, { min: number; max: number }> = {
  'grain-gradient': { min: MIN_SPEED, max: MAX_SPEED },
  'mesh-gradient': { min: 0.75, max: 1.25 },
  warp: { min: MIN_SPEED, max: MAX_SPEED },
  'simplex-noise': { min: MIN_SPEED, max: MAX_SPEED },
  'god-rays': { min: MIN_SPEED, max: MAX_SPEED },
};

const RANDOM_SCALE_RANGE: Record<ShaderKind, { min: number; max: number }> = {
  'grain-gradient': GRAIN_SCALE_RANGE,
  'mesh-gradient': { min: 0.5, max: 0.75 },
  warp: { min: 0.3, max: 1.25 },
  'simplex-noise': { min: 0.4, max: 1.25 },
  'god-rays': { min: 0.5, max: 4 },
};

function randomBetween(min: number, max: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((min + Math.random() * (max - min)) * factor) / factor;
}

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomHex() {
  const hue = randomInt(0, 359);
  const saturation = randomInt(62, 100);
  const lightness = randomInt(42, 72);
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getShaderDefinition(kind: ShaderKind) {
  return SHADERS.find((shader) => shader.kind === kind) ?? SHADERS[0];
}

function cloneState(state: ShaderState): ShaderState {
  return { ...state, colors: [...state.colors] };
}

function randomChoice<T>(items: readonly T[]) {
  return items[randomInt(0, items.length - 1)];
}

function getScaleRange(kind: ShaderKind) {
  return kind === 'grain-gradient' ? GRAIN_SCALE_RANGE : DEFAULT_SCALE_RANGE;
}

function buildRandomBaseState(kind: ShaderKind): ShaderState {
  const definition = getShaderDefinition(kind);
  const speedRange = RANDOM_SPEED_RANGE[kind];
  const scaleRange = RANDOM_SCALE_RANGE[kind];
  const colorCount = randomInt(
    MIN_COLOUR_COUNT,
    Math.min(definition.maxColors, MAX_RANDOM_COLOUR_COUNT),
  );
  const colors = Array.from({ length: colorCount }, () => randomHex());

  // Offset is left at each shader's default (never randomised).
  return {
    ...cloneState(DEFAULT_STATE[kind]),
    colors,
    colorCount,
    speed: randomBetween(speedRange.min, speedRange.max),
    frame: randomInt(0, 120000),
    scale: randomBetween(scaleRange.min, scaleRange.max),
    rotation: randomInt(0, 360),
  };
}

function buildRandomState(kind: ShaderKind): ShaderState {
  const base = buildRandomBaseState(kind);

  if (kind === 'grain-gradient') {
    return {
      ...base,
      colorBack: Math.random() > 0.22 ? '#000000' : randomHex(),
      softness: randomBetween(0, 1),
      intensity: randomBetween(0, 0.1),
      noise: 0,
      grainShape: randomChoice(GRAIN_SHAPES),
    };
  }

  if (kind === 'mesh-gradient') {
    return {
      ...base,
      distortion: randomBetween(0.15, 1),
      swirl: randomBetween(0, 1),
      grainMixer: randomBetween(0, 0.1),
      grainOverlay: 0,
    };
  }

  if (kind === 'warp') {
    const warpShape = randomChoice(WARP_SHAPES);
    return {
      ...base,
      proportion: randomBetween(0.08, 0.88),
      softness: randomBetween(0, 1),
      distortion: randomBetween(0.5, 1),
      swirl: randomBetween(0.5, 1),
      swirlIterations: randomInt(10, 20),
      warpShape,
      shapeScale: warpShape === 'edge' ? 0 : randomBetween(0.05, 0.9),
    };
  }

  if (kind === 'simplex-noise') {
    return {
      ...base,
      stepsPerColor: randomInt(1, 6),
      softness: 0,
    };
  }

  return {
    ...base,
    colorBack: Math.random() > 0.2 ? '#000000' : randomHex(),
    colorBloom: randomHex(),
    bloom: randomBetween(0.15, 1),
    intensity: randomBetween(0.35, 1),
    density: randomBetween(0.03, 0.5),
    spotty: randomBetween(0.05, 0.85),
    midSize: randomBetween(0.05, 0.65),
    midIntensity: randomBetween(0.15, 1),
  };
}

/**
 * Resolves the shader background colour from the active theme so shaders with a
 * background always match the app: light in light mode, dark in dark mode. Reads
 * the live `--color-bg-default` token, falling back to white/black.
 */
function useThemeBackground(): string {
  const { resolvedTheme } = useTheme();
  const [background, setBackground] = useState('#ffffff');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg-default')
      .trim();
    setBackground(token || (resolvedTheme === 'dark' ? '#09090b' : '#ffffff'));
  }, [resolvedTheme]);

  return background;
}

export function PaperShadersPlayground() {
  const [state, setState] = useState<ShaderState>(() =>
    cloneState(DEFAULT_STATE['grain-gradient']),
  );
  const activeShader = useMemo(() => getShaderDefinition(state.kind), [state.kind]);
  const scaleRange = getScaleRange(state.kind);
  const activeColors = state.colors.slice(0, state.colorCount);
  const themeBackground = useThemeBackground();

  const setPartialState = (next: Partial<ShaderState>) => {
    setState((current) => ({ ...current, ...next }));
  };

  const setKind = (kind: ShaderKind) => {
    setState(cloneState(DEFAULT_STATE[kind]));
  };

  const setColorCount = (colorCount: number) => {
    setState((current) => {
      const colors = [...current.colors];
      while (colors.length < colorCount) {
        colors.push(randomHex());
      }

      return { ...current, colorCount, colors };
    });
  };

  const setColor = (index: number, color: string) => {
    setState((current) => {
      const colors = [...current.colors];
      colors[index] = color;
      return { ...current, colors };
    });
  };

  const randomiseColours = () => {
    setState((current) => ({
      ...current,
      colors: Array.from({ length: current.colorCount }, () => randomHex()),
      colorBack: getShaderDefinition(current.kind).hasBack ? '#000000' : current.colorBack,
      colorBloom: getShaderDefinition(current.kind).hasBloom ? randomHex() : current.colorBloom,
      frame: randomInt(0, 120000),
    }));
  };

  const randomiseEffect = () => {
    // Randomise across every shader kind and its colours, not just the
    // currently selected one.
    const kind = randomChoice(SHADERS).kind;
    setState(buildRandomState(kind));
  };

  return (
    <main className="relative min-h-[calc(100svh-49px)] overflow-hidden bg-[#05070d] text-white">
      <section
        className="relative grid min-h-[calc(100svh-49px)] grid-rows-[minmax(320px,1fr)_auto] overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1"
        aria-labelledby="paper-shader-title"
      >
        <div className="relative isolate min-h-[46svh] overflow-hidden bg-black xl:min-h-0">
          <ShaderPreview state={state} colors={activeColors} colorBack={themeBackground} />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0%,rgba(5,7,13,0.08)_52%,rgba(5,7,13,0.62)_100%)]"
            aria-hidden
          />
          <div className="absolute top-5 left-5 z-10 flex max-w-[min(34rem,calc(100%-2.5rem))] flex-col gap-3 rounded-2xl border border-white/12 bg-black/28 px-4 py-3 shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.22em] text-cyan-200 uppercase">
              <Sparkles size={15} aria-hidden="true" />
              Paper shaders
            </div>
            <div className="space-y-1">
              <h1 id="paper-shader-title" className="text-2xl font-semibold tracking-normal">
                {activeShader.label}
              </h1>
              <p className="max-w-md text-sm leading-5 text-cyan-50/70">
                {activeShader.description}
              </p>
            </div>
          </div>
        </div>

        <aside className="border-t border-white/10 bg-[#0b1020] text-white shadow-2xl xl:max-h-[calc(100svh-49px)] xl:overflow-y-auto xl:border-t-0 xl:border-l">
          <div className="space-y-7 p-4 sm:p-5">
            <section aria-labelledby="shader-select-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="shader-select-heading"
                  className="flex items-center gap-2 text-sm font-semibold text-white"
                >
                  <SlidersHorizontal size={16} className="text-cyan-300" aria-hidden="true" />
                  Shader
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={randomiseEffect}
                  className="border-cyan-300/20 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/18"
                >
                  <Shuffle size={15} aria-hidden="true" />
                  Randomise effect
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SHADERS.map((shader) => {
                  const selected = shader.kind === state.kind;
                  return (
                    <button
                      key={shader.kind}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setKind(shader.kind)}
                      className={cn(
                        'min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/40',
                        selected
                          ? 'border-cyan-300/70 bg-cyan-300 text-[#06101b] shadow-lg shadow-cyan-500/20'
                          : 'border-white/10 bg-white/[0.045] text-slate-200 hover:border-cyan-300/40 hover:bg-white/[0.075]',
                      )}
                    >
                      {shader.shortLabel}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="colour-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="colour-heading" className="flex items-center gap-2 text-sm font-semibold">
                  <Palette size={16} className="text-fuchsia-300" aria-hidden="true" />
                  Colours
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={randomiseColours}
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <Shuffle size={15} aria-hidden="true" />
                  Palette
                </Button>
              </div>

              <Field className="space-y-2">
                <FieldLabel>Colour count</FieldLabel>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: activeShader.maxColors }, (_, index) => index + 1).map(
                    (count) => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={state.colorCount === count}
                        disabled={count < MIN_COLOUR_COUNT}
                        onClick={() => setColorCount(count)}
                        className={cn(
                          'h-9 rounded-lg border font-mono text-xs tabular-nums transition focus:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-35',
                          state.colorCount === count
                            ? 'border-cyan-300 bg-cyan-300 text-[#06101b]'
                            : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/[0.08]',
                        )}
                      >
                        {count}
                      </button>
                    ),
                  )}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {activeColors.map((color, index) => (
                  <Field key={`${state.kind}-color-${index}`} className="space-y-1.5">
                    <FieldLabel>Colour {index + 1}</FieldLabel>
                    <ColorPicker
                      value={color}
                      onChange={(next) => setColor(index, next)}
                      presets={COLOR_PRESETS}
                      label={`Colour ${index + 1}`}
                      className="w-full justify-start"
                    />
                  </Field>
                ))}
                {activeShader.hasBloom ? (
                  <Field className="space-y-1.5">
                    <FieldLabel>Bloom</FieldLabel>
                    <ColorPicker
                      value={state.colorBloom}
                      onChange={(colorBloom) => setPartialState({ colorBloom })}
                      presets={COLOR_PRESETS}
                      label="Bloom colour"
                      className="w-full justify-start"
                    />
                  </Field>
                ) : null}
              </div>
            </section>

            <section aria-labelledby="motion-heading" className="space-y-3">
              <h2 id="motion-heading" className="text-sm font-semibold">
                Motion
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SliderField
                  label="Speed"
                  value={state.speed}
                  min={MIN_SPEED}
                  max={MAX_SPEED}
                  step={0.05}
                  showNumberInput
                  onChange={(speed) => setPartialState({ speed })}
                />
                <SliderField
                  label="Scale"
                  value={state.scale}
                  min={scaleRange.min}
                  max={scaleRange.max}
                  step={0.01}
                  showNumberInput
                  onChange={(scale) => setPartialState({ scale })}
                />
                <SliderField
                  label="Rotation"
                  value={state.rotation}
                  min={0}
                  max={360}
                  step={1}
                  showNumberInput
                  onChange={(rotation) => setPartialState({ rotation })}
                />
              </div>
            </section>

            <ShaderSpecificControls state={state} setPartialState={setPartialState} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function ShaderPreview({
  state,
  colors,
  colorBack,
}: {
  state: ShaderState;
  colors: string[];
  /** Background colour, bound to the active theme (light/dark). */
  colorBack: string;
}) {
  const commonProps = {
    width: '100%',
    height: '100%',
    fit: 'cover' as const,
    speed: state.speed,
    frame: state.frame,
    scale: state.scale,
    rotation: state.rotation,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    minPixelRatio: 1,
    maxPixelCount: 1920000,
    className: 'absolute inset-0 h-full w-full',
  };

  if (state.kind === 'mesh-gradient') {
    return (
      <MeshGradient
        {...commonProps}
        colors={colors}
        distortion={state.distortion}
        swirl={state.swirl}
        grainMixer={state.grainMixer}
        grainOverlay={0}
      />
    );
  }

  if (state.kind === 'warp') {
    return (
      <Warp
        {...commonProps}
        colors={colors}
        proportion={state.proportion}
        softness={state.softness}
        distortion={state.distortion}
        swirl={state.swirl}
        swirlIterations={state.swirlIterations}
        shape={state.warpShape}
        shapeScale={state.warpShape === 'edge' ? 0 : state.shapeScale}
      />
    );
  }

  if (state.kind === 'simplex-noise') {
    return (
      <SimplexNoise
        {...commonProps}
        colors={colors}
        stepsPerColor={state.stepsPerColor}
        softness={0}
      />
    );
  }

  if (state.kind === 'god-rays') {
    return (
      <GodRays
        {...commonProps}
        colors={colors}
        colorBack={colorBack}
        colorBloom={state.colorBloom}
        bloom={0}
        intensity={state.intensity}
        density={state.density}
        spotty={state.spotty}
        midSize={state.midSize}
        midIntensity={state.midIntensity}
      />
    );
  }

  return (
    <GrainGradient
      {...commonProps}
      colors={colors}
      colorBack={colorBack}
      softness={state.softness}
      intensity={state.intensity}
      noise={state.noise}
      shape={state.grainShape}
    />
  );
}

function ShaderSpecificControls({
  state,
  setPartialState,
}: {
  state: ShaderState;
  setPartialState: (next: Partial<ShaderState>) => void;
}) {
  if (state.kind === 'grain-gradient') {
    return (
      <section aria-labelledby="grain-controls-heading" className="space-y-3">
        <h2 id="grain-controls-heading" className="text-sm font-semibold">
          Grain Gradient
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Field className="space-y-1.5">
            <FieldLabel>Shape</FieldLabel>
            <SelectField
              value={state.grainShape}
              onChange={(grainShape) => setPartialState({ grainShape: grainShape as GrainShape })}
              options={GRAIN_SHAPES.map((shape) => ({ value: shape, label: labelise(shape) }))}
              ariaLabel="Grain Gradient shape"
            />
          </Field>
          <SliderField
            label="Softness"
            value={state.softness}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(softness) => setPartialState({ softness })}
          />
          <SliderField
            label="Intensity"
            value={state.intensity}
            min={0}
            max={0.1}
            step={0.01}
            showNumberInput
            onChange={(intensity) => setPartialState({ intensity })}
          />
        </div>
      </section>
    );
  }

  if (state.kind === 'mesh-gradient') {
    return (
      <section aria-labelledby="mesh-controls-heading" className="space-y-3">
        <h2 id="mesh-controls-heading" className="text-sm font-semibold">
          Mesh Gradient
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SliderField
            label="Distortion"
            value={state.distortion}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(distortion) => setPartialState({ distortion })}
          />
          <SliderField
            label="Swirl"
            value={state.swirl}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(swirl) => setPartialState({ swirl })}
          />
          <SliderField
            label="Grain mixer"
            value={state.grainMixer}
            min={0}
            max={0.1}
            step={0.01}
            showNumberInput
            onChange={(grainMixer) => setPartialState({ grainMixer })}
          />
        </div>
      </section>
    );
  }

  if (state.kind === 'warp') {
    return (
      <section aria-labelledby="warp-controls-heading" className="space-y-3">
        <h2 id="warp-controls-heading" className="text-sm font-semibold">
          Warp
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Field className="space-y-1.5">
            <FieldLabel>Shape</FieldLabel>
            <SelectField
              value={state.warpShape}
              onChange={(warpShape) => setPartialState({ warpShape: warpShape as WarpShape })}
              options={WARP_SHAPES.map((shape) => ({ value: shape, label: labelise(shape) }))}
              ariaLabel="Warp shape"
            />
          </Field>
          <SliderField
            label="Proportion"
            value={state.proportion}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(proportion) => setPartialState({ proportion })}
          />
          <SliderField
            label="Softness"
            value={state.softness}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(softness) => setPartialState({ softness })}
          />
          <SliderField
            label="Distortion"
            value={state.distortion}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(distortion) => setPartialState({ distortion })}
          />
          <SliderField
            label="Swirl"
            value={state.swirl}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(swirl) => setPartialState({ swirl })}
          />
          <SliderField
            label="Swirl iterations"
            value={state.swirlIterations}
            min={0}
            max={20}
            step={1}
            showNumberInput
            onChange={(swirlIterations) => setPartialState({ swirlIterations })}
          />
          {state.warpShape === 'edge' ? null : (
            <SliderField
              label="Shape scale"
              value={state.shapeScale}
              min={0}
              max={1}
              step={0.01}
              showNumberInput
              onChange={(shapeScale) => setPartialState({ shapeScale })}
            />
          )}
        </div>
      </section>
    );
  }

  if (state.kind === 'simplex-noise') {
    return (
      <section aria-labelledby="simplex-controls-heading" className="space-y-3">
        <h2 id="simplex-controls-heading" className="text-sm font-semibold">
          Simplex Noise
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SliderField
            label="Steps per colour"
            value={state.stepsPerColor}
            min={1}
            max={10}
            step={1}
            showNumberInput
            onChange={(stepsPerColor) => setPartialState({ stepsPerColor })}
          />
        </div>
      </section>
    );
  }

  if (state.kind === 'god-rays') {
    return (
      <section aria-labelledby="rays-controls-heading" className="space-y-3">
        <h2 id="rays-controls-heading" className="text-sm font-semibold">
          God Rays
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SliderField
            label="Intensity"
            value={state.intensity}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(intensity) => setPartialState({ intensity })}
          />
          <SliderField
            label="Density"
            value={state.density}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(density) => setPartialState({ density })}
          />
          <SliderField
            label="Spotty"
            value={state.spotty}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(spotty) => setPartialState({ spotty })}
          />
          <SliderField
            label="Mid size"
            value={state.midSize}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(midSize) => setPartialState({ midSize })}
          />
          <SliderField
            label="Mid intensity"
            value={state.midIntensity}
            min={0}
            max={1}
            step={0.01}
            showNumberInput
            onChange={(midIntensity) => setPartialState({ midIntensity })}
          />
        </div>
      </section>
    );
  }

  return null;
}

function labelise(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
