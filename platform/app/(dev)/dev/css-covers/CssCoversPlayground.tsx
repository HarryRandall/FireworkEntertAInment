'use client';

/**
 * Dev playground for the lightweight CSS covers. Shuffle across every effect,
 * tweak colours and motion, and flip Live/Frozen to preview the "photo" a show
 * would freeze to. Mirrors the paper-shaders playground layout and styling.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  LayoutGrid,
  Palette,
  Play,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { ColorPicker } from '@/app/components/ui/ColorPicker';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { CssCover } from '@/app/components/app/CssCover';
import {
  CSS_COVER_LOOP_SECONDS,
  cssCoverFromSeed,
  randomCssCover,
  type CssCover as CssCoverConfig,
  type CssCoverKind,
} from '@/lib/css-cover';
import { cn } from '@/lib/utils';

type KindMeta = { kind: CssCoverKind; label: string; description: string };

const KINDS: KindMeta[] = [
  {
    kind: 'liquid',
    label: 'Liquid',
    description: 'Flowing mesh gradient, like the WebGL cover (CPU field).',
  },
  {
    kind: 'silk',
    label: 'Silk',
    description: 'Sheared, domain-warped colour flow, like the Warp shader (CPU field).',
  },
  {
    kind: 'caustics',
    label: 'Caustics',
    description: 'Water-light ridges rippling over a deep gradient (CPU field).',
  },
  {
    kind: 'marble',
    label: 'Marble',
    description: 'Swirled, banded colour rings, like the noise shader (CPU field).',
  },
  {
    kind: 'smoke',
    label: 'Smoke',
    description: 'Drifting noise clouds, like the grain gradient (CPU field).',
  },
  {
    kind: 'spiro',
    label: 'Spiro',
    description: 'A glowing spirograph curve slowly rotating (Canvas2D).',
  },
  { kind: 'curtain', label: 'Curtain', description: 'Aurora borealis curtains drifting sideways.' },
  {
    kind: 'dots',
    label: 'Dots',
    description: 'A grid of dots rippling with a travelling wave (Canvas2D).',
  },
  {
    kind: 'constellation',
    label: 'Constellation',
    description: 'Drifting nodes linked by lines (Canvas2D).',
  },
  { kind: 'grid', label: 'Retro Grid', description: 'Neon grid receding to a glowing horizon.' },
  { kind: 'waves', label: 'Waves', description: 'Stacked oscillating gradient bands (Canvas2D).' },
  {
    kind: 'starfield',
    label: 'Starfield',
    description: 'Warp-speed stars streaking outward (Canvas2D).',
  },
  { kind: 'plasma', label: 'Plasma', description: 'Fast overlapping colour blobs.' },
  { kind: 'kaleido', label: 'Kaleido', description: 'Spinning multi-colour wheel.' },
  { kind: 'rays', label: 'Rays', description: 'Light beams radiating from a bright core.' },
  { kind: 'aurora', label: 'Aurora', description: 'Soft drifting bands of light.' },
  { kind: 'bloom', label: 'Bloom', description: 'Drifting bokeh sparks (Canvas2D).' },
];

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

const MIN_COLOURS = 3;
const MAX_COLOURS = 6;

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
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

function randomHex() {
  return hslToHex(randomInt(0, 359), randomInt(62, 100), randomInt(46, 70));
}

function kindMeta(kind: CssCoverKind) {
  return KINDS.find((entry) => entry.kind === kind) ?? KINDS[0];
}

export function CssCoversPlayground() {
  // Deterministic first render so server and client HTML match; randomise only
  // after mount to avoid a hydration mismatch from Math.random().
  const [cover, setCover] = useState<CssCoverConfig>(() => cssCoverFromSeed('showcrafter'));
  const [animate, setAnimate] = useState(true);
  const [view, setView] = useState<'single' | 'gallery'>('single');

  useEffect(() => {
    setCover(randomCssCover());
  }, []);

  const meta = useMemo(() => kindMeta(cover.kind), [cover.kind]);

  const patch = (next: Partial<CssCoverConfig>) => setCover((current) => ({ ...current, ...next }));

  const setColour = (index: number, value: string) =>
    setCover((current) => {
      const colors = [...current.colors];
      colors[index] = value;
      return { ...current, colors };
    });

  const setColourCount = (count: number) =>
    setCover((current) => {
      const colors = [...current.colors];
      while (colors.length < count) colors.push(randomHex());
      colors.length = count;
      return { ...current, colors };
    });

  const shufflePalette = () =>
    setCover((current) => ({
      ...current,
      colors: current.colors.map(() => randomHex()),
    }));

  const randomiseEffect = () => setCover(randomCssCover());

  return (
    <main className="relative min-h-[calc(100svh-49px)] overflow-hidden bg-[#05070d] text-white">
      <section
        className="relative grid min-h-[calc(100svh-49px)] grid-rows-[minmax(320px,1fr)_auto] overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1"
        aria-labelledby="css-cover-title"
      >
        <div className="relative isolate min-h-[46svh] overflow-hidden bg-black xl:min-h-0">
          {view === 'single' ? (
            <CssCover cover={cover} animate={animate} />
          ) : (
            <GalleryGrid
              cover={cover}
              animate={animate}
              onPick={(kind) => {
                patch({ kind });
                setView('single');
              }}
            />
          )}

          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0%,rgba(5,7,13,0.08)_52%,rgba(5,7,13,0.62)_100%)]"
            aria-hidden
          />

          {view === 'single' ? (
            <div className="absolute top-5 left-5 z-10 flex max-w-[min(34rem,calc(100%-2.5rem))] flex-col gap-3 rounded-2xl border border-white/12 bg-black/28 px-4 py-3 shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.22em] text-cyan-200 uppercase">
                <Sparkles size={15} aria-hidden="true" />
                CSS covers
                {!animate ? (
                  <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] tracking-[0.16em] text-amber-100">
                    Frozen photo
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                <h1 id="css-cover-title" className="text-2xl font-semibold tracking-normal">
                  {meta.label}
                </h1>
                <p className="max-w-md text-sm leading-5 text-cyan-50/70">{meta.description}</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border-t border-white/10 bg-[#0b1020] text-white shadow-2xl xl:max-h-[calc(100svh-49px)] xl:overflow-y-auto xl:border-t-0 xl:border-l">
          <div className="space-y-7 p-4 sm:p-5">
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'single' ? 'primary' : 'secondary'}
                  onClick={() => setView('single')}
                >
                  <SlidersHorizontal size={15} aria-hidden="true" />
                  Single
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'gallery' ? 'primary' : 'secondary'}
                  onClick={() => setView('gallery')}
                >
                  <LayoutGrid size={15} aria-hidden="true" />
                  Gallery
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={randomiseEffect}>
                  <Shuffle size={15} aria-hidden="true" />
                  Randomise
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAnimate((value) => !value)}
                >
                  {animate ? (
                    <Camera size={15} aria-hidden="true" />
                  ) : (
                    <Play size={15} aria-hidden="true" />
                  )}
                  {animate ? 'Freeze' : 'Play'}
                </Button>
              </div>
            </section>

            <section aria-labelledby="css-kind-heading" className="space-y-3">
              <h2
                id="css-kind-heading"
                className="flex items-center gap-2 text-sm font-semibold text-white"
              >
                <SlidersHorizontal size={16} className="text-cyan-300" aria-hidden="true" />
                Effect
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {KINDS.map((entry) => {
                  const selected = entry.kind === cover.kind;
                  return (
                    <button
                      key={entry.kind}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => patch({ kind: entry.kind })}
                      className={cn(
                        'min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/40',
                        selected
                          ? 'border-cyan-300/70 bg-cyan-300 text-[#06101b] shadow-lg shadow-cyan-500/20'
                          : 'border-white/10 bg-white/[0.045] text-slate-200 hover:border-cyan-300/40 hover:bg-white/[0.075]',
                      )}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="css-colour-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="css-colour-heading"
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <Palette size={16} className="text-fuchsia-300" aria-hidden="true" />
                  Colours
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={shufflePalette}
                  className="text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <Shuffle size={15} aria-hidden="true" />
                  Palette
                </Button>
              </div>

              <Field className="space-y-2">
                <FieldLabel>Colour count</FieldLabel>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: MAX_COLOURS }, (_, index) => index + 1).map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={cover.colors.length === count}
                      disabled={count < MIN_COLOURS}
                      onClick={() => setColourCount(count)}
                      className={cn(
                        'h-9 rounded-lg border font-mono text-xs tabular-nums transition focus:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-35',
                        cover.colors.length === count
                          ? 'border-cyan-300 bg-cyan-300 text-[#06101b]'
                          : 'border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/[0.08]',
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {cover.colors.map((color, index) => (
                  <Field key={`${cover.kind}-color-${index}`} className="space-y-1.5">
                    <FieldLabel>Colour {index + 1}</FieldLabel>
                    <ColorPicker
                      value={color}
                      onChange={(next) => setColour(index, next)}
                      presets={COLOR_PRESETS}
                      label={`Colour ${index + 1}`}
                      className="w-full justify-start"
                    />
                  </Field>
                ))}
              </div>
            </section>

            <section aria-labelledby="css-motion-heading" className="space-y-3">
              <h2 id="css-motion-heading" className="text-sm font-semibold">
                Motion and look
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SliderField
                  label="Speed"
                  value={cover.speed}
                  min={0.2}
                  max={3}
                  step={0.05}
                  showNumberInput
                  onChange={(speed) => patch({ speed })}
                />
                <SliderField
                  label="Scale"
                  value={cover.scale}
                  min={0.5}
                  max={1.6}
                  step={0.01}
                  showNumberInput
                  onChange={(scale) => patch({ scale })}
                />
                <SliderField
                  label="Angle"
                  value={cover.angle}
                  min={0}
                  max={360}
                  step={1}
                  showNumberInput
                  onChange={(angle) => patch({ angle })}
                />
                <SliderField
                  label="Softness"
                  value={cover.blur}
                  min={0}
                  max={1}
                  step={0.01}
                  showNumberInput
                  onChange={(blur) => patch({ blur })}
                />
                <SliderField
                  label="Grain"
                  value={cover.grain}
                  min={0}
                  max={1}
                  step={0.01}
                  showNumberInput
                  onChange={(grain) => patch({ grain })}
                />
                <SliderField
                  label="Intensity"
                  value={cover.intensity}
                  min={0}
                  max={1}
                  step={0.01}
                  showNumberInput
                  onChange={(intensity) => patch({ intensity })}
                />
                <SliderField
                  label="Density"
                  value={cover.density}
                  min={0}
                  max={1}
                  step={0.01}
                  showNumberInput
                  onChange={(density) => patch({ density })}
                />
                <SliderField
                  label="Frozen frame (s)"
                  value={cover.frame}
                  min={0}
                  max={CSS_COVER_LOOP_SECONDS}
                  step={0.1}
                  showNumberInput
                  onChange={(frame) => patch({ frame })}
                />
              </div>
            </section>

            <section aria-labelledby="css-json-heading" className="space-y-2">
              <h2 id="css-json-heading" className="text-sm font-semibold">
                Config
              </h2>
              <Field className="space-y-1.5">
                <FieldLabel>Seed</FieldLabel>
                <SelectField
                  value={String(cover.seed % 6)}
                  onChange={(value) => patch({ seed: Number(value) + randomInt(1, 1000) })}
                  options={Array.from({ length: 6 }, (_, index) => ({
                    value: String(index),
                    label: `Layout ${index + 1}`,
                  }))}
                  ariaLabel="Bloom particle layout seed"
                />
              </Field>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(JSON.stringify(cover, null, 2));
                }}
                className="w-full"
              >
                Copy cover JSON
              </Button>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}

function GalleryGrid({
  cover,
  animate,
  onPick,
}: {
  cover: CssCoverConfig;
  animate: boolean;
  onPick: (kind: CssCoverKind) => void;
}) {
  return (
    <div className="absolute inset-0 grid grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 sm:gap-3 sm:p-4">
      {KINDS.map((entry) => (
        <button
          key={entry.kind}
          type="button"
          onClick={() => onPick(entry.kind)}
          className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 focus:outline-none focus-visible:ring-3 focus-visible:ring-cyan-300/50"
        >
          <CssCover cover={{ ...cover, kind: entry.kind }} animate={animate} />
          <span className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-left text-sm font-semibold text-white">
            {entry.label}
          </span>
        </button>
      ))}
    </div>
  );
}
