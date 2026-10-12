'use client';

/** A trimmed version of the firework editor: real controls on one shell, saving nothing. */
import { useMemo, useState } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import { effectTemplates, type Design } from '@showcrafter/renderer';
import type { Colour } from '@showcrafter/renderer/schema';
import { CurveEditor } from '@/ui/firework-editor/renderer-design/curve-editor';
import { GradientEditor } from '@/ui/firework-editor/renderer-design/gradient-editor';
import { DesignPreview } from '@/ui/firework-editor/renderer-design/preview';
import { CanvasSurface } from '@/ui/renderer/CanvasSurface';
import { Button } from '@/ui/patterns/Button';
import { SliderField } from '@/ui/patterns/SliderField';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { useNearViewport } from './useLandingPosters';

function baseDesign(): Design {
  const design = effectTemplates.find((entry) => entry.key === 'peony')?.design;
  if (!design?.breaks[0]?.layers[0]) throw new Error('The editor demo needs the peony template.');
  return design;
}
const BASE = baseDesign();
type StarLayer = Design['breaks'][number]['layers'][number];
function firstLayer(design: Design): StarLayer {
  const layer = design.breaks[0]?.layers[0];
  if (!layer) throw new Error('The editor demo needs a star layer.');
  return layer;
}
const BASE_LAYER = firstLayer(BASE);
const BASE_RADIUS_M = BASE_LAYER.radius_m;
const BASE_COUNT = BASE_LAYER.count;
// Dimensionless multiplier, v1 schema bound for authored brightness keys.
const MAX_BRIGHTNESS = 10;
const HISTORY_LIMIT = 30;

/** One-click palettes, each a two-colour fade over the star's life. */
const PALETTES: readonly { name: string; colour: Colour }[] = [
  { name: 'Gold', colour: fade('#ffd27a', '#ff8a3d') },
  { name: 'Rose', colour: fade('#ffd1dc', '#fb7185') },
  { name: 'Violet', colour: fade('#d8ccff', '#8f7be8') },
  { name: 'Sky', colour: fade('#d6f1ff', '#38bdf8') },
  { name: 'Emerald', colour: fade('#c9ffe6', '#2ec487') },
];

function fade(from: string, to: string): Colour {
  return {
    mode: 'solid',
    stops: [
      [0, from],
      [1, to],
    ],
  };
}

/** Applies a change to the first star layer of a copy of the design. */
function withLayer(design: Design, change: (layer: StarLayer) => void) {
  const next = structuredClone(design);
  const layer = next.breaks[0]?.layers[0];
  if (layer) change(layer);
  return next;
}

export function EditorDemo() {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const near = useNearViewport(section);
  const [history, setHistory] = useState<Design[]>([]);
  const [design, setDesign] = useState<Design>(BASE);
  const layer = firstLayer(design);
  const ticks = useMemo(() => ({ min: BASE_RADIUS_M * 0.5, max: BASE_RADIUS_M * 1.6 }), []);

  function edit(change: (target: StarLayer) => void) {
    setHistory((current) => [...current, design].slice(-HISTORY_LIMIT));
    setDesign((current) => withLayer(current, change));
  }

  return (
    <section ref={setSection} aria-labelledby="editor-heading" className="border-border border-b">
      <Reveal className="border-border mx-auto max-w-6xl px-4 py-14 sm:px-10 sm:py-20 lg:border-x">
        <Rise>
          <p className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
            Editor
          </p>
          <h2
            id="editor-heading"
            className="text-foreground mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Design a firework. Watch it burst.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
            These are the editor's own controls, working on a peony shell. Nothing here is saved.
          </p>
        </Rise>

        <div className="border-border bg-card mt-10 grid overflow-hidden rounded-xl border lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Rise delay={120} className="bg-stage-night relative min-h-80 lg:min-h-[32rem]">
            {near ? (
              <CanvasSurface className="absolute inset-0">
                <DesignPreview document={design} player={false} loop lowPower="auto" />
              </CanvasSurface>
            ) : null}
            <p className="text-stage-glass-muted pointer-events-none absolute bottom-3 left-3 z-10 font-mono text-[11px]">
              Fig 0.1 · Live preview
            </p>
          </Rise>

          <Rise
            delay={180}
            className="border-border grid content-start gap-6 p-5 sm:p-6 lg:border-l"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground font-mono text-[11px]">Fig 0.2 · Stars</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={history.length === 0}
                  onClick={() => {
                    const previous = history.at(-1);
                    if (!previous) return;
                    setHistory((current) => current.slice(0, -1));
                    setDesign(previous);
                  }}
                >
                  <Undo2 aria-hidden size={14} />
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={design === BASE}
                  onClick={() => {
                    setHistory([]);
                    setDesign(BASE);
                  }}
                >
                  <RotateCcw aria-hidden size={14} />
                  Reset
                </Button>
              </div>
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-foreground mb-2 text-sm font-medium">Palette</legend>
              <div className="flex flex-wrap gap-2">
                {PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() =>
                      edit((target) => {
                        target.colour = structuredClone(palette.colour);
                      })
                    }
                    className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className="size-3 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${String(palette.colour.stops[0]?.[1])}, ${String(palette.colour.stops[1]?.[1])})`,
                      }}
                    />
                    {palette.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <GradientEditor
              label="Colour over life"
              value={layer.colour}
              maxTime={Math.max(1, ...layer.colour.stops.map((stop) => stop[0]))}
              onChange={(colour) =>
                edit((target) => {
                  target.colour = colour;
                })
              }
            />

            <p className="text-muted-foreground -mb-3 font-mono text-[11px]">Fig 0.3 · Shape</p>
            <CurveEditor
              label="Brightness"
              value={layer.brightness}
              maxValue={MAX_BRIGHTNESS}
              onChange={(brightness) =>
                edit((target) => {
                  target.brightness = brightness;
                })
              }
            />
            <SliderField
              label="Burst size"
              value={layer.radius_m}
              min={ticks.min}
              max={ticks.max}
              step={0.5}
              unit="m"
              formatValue={(value) => value.toFixed(1)}
              onChange={(value) =>
                edit((target) => {
                  target.radius_m = value;
                })
              }
            />
            <SliderField
              label="Stars"
              value={layer.count}
              min={Math.max(3, Math.round(BASE_COUNT * 0.4))}
              max={Math.round(BASE_COUNT * 2)}
              step={1}
              formatValue={(value) => String(Math.round(value))}
              onChange={(value) =>
                edit((target) => {
                  target.count = Math.round(value);
                })
              }
            />
          </Rise>
        </div>
      </Reveal>
    </section>
  );
}
