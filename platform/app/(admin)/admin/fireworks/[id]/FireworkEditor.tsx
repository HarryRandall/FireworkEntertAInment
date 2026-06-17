'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Pause, Play, Plus, Repeat, RotateCcw, Save, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { updateFirework } from '@/app/actions/admin-fireworks';
import {
  FireworkRenderControls,
  PanelSection,
  SubSection,
  type JsonRecord,
} from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/app/components/ui/toast';
import type { AdminFireworkDetail } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import { DEFAULT_FIREWORK_SPEC, FIREWORK_COLOR_VALUES, hexToRgb } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: JsonRecord } | { ok: false; error: string };

type StarColourMode = 'solid' | 'random' | 'bands' | 'stripes';
type StarColourAxis = 'vertical' | 'horizontal';
type ColourStop = { id: string; hex: string; share: number };

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];
const DEFAULT_ACCENT_RATIO = 0.22;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_STAR_COLOURS = 6;
const STAR_PATTERN_COUNT_MIN = 1;
const STAR_PATTERN_COUNT_MAX = 6;
const DEFAULT_COLOUR_SWATCHES = FIREWORK_COLOR_VALUES;

const STAR_COLOUR_MODE_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'random', label: 'Random mix' },
  { value: 'bands', label: 'Bottom to top' },
  { value: 'stripes', label: 'Stripes' },
];

const STAR_COLOUR_AXIS_OPTIONS = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
];

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as JsonRecord };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse JSON.' };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
}

function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  if (!isRecord(parent[key])) parent[key] = {};
  return parent[key] as JsonRecord;
}

function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const [r, g, b] = hexToRgb(hex);
  return { r, g, b };
}

function rgbObjectToHex(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const r = Number(value.r);
  const g = Number(value.g);
  const b = Number(value.b);
  if (![r, g, b].every(Number.isFinite)) return null;
  const toByte = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * 255)));
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function readInitialAccentAmount(overrides: JsonRecord): number {
  const raw = Number(overrides.secondaryColorRatio);
  return Number.isFinite(raw) ? Math.min(0.6, Math.max(0.05, raw)) : DEFAULT_ACCENT_RATIO;
}

function isStarColourMode(value: unknown): value is StarColourMode {
  return value === 'solid' || value === 'random' || value === 'bands' || value === 'stripes';
}

function isStarColourAxis(value: unknown): value is StarColourAxis {
  return value === 'vertical' || value === 'horizontal';
}

function initialColourMode(overrides: JsonRecord): StarColourMode {
  const pattern = readRecord(readRecord(readRecord(overrides, 'stars'), 'outer'), 'colourPattern');
  return isStarColourMode(pattern.mode) ? pattern.mode : 'solid';
}

function initialColourAxis(overrides: JsonRecord): StarColourAxis {
  const pattern = readRecord(readRecord(readRecord(overrides, 'stars'), 'outer'), 'colourPattern');
  return isStarColourAxis(pattern.axis) ? pattern.axis : 'vertical';
}

function clampStarPatternCount(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(STAR_PATTERN_COUNT_MAX, Math.max(STAR_PATTERN_COUNT_MIN, Math.round(value)));
}

function colourPatternQuestion(mode: StarColourMode): string {
  if (mode === 'stripes') return 'Stripe direction';
  if (mode === 'bands') return 'Colour direction';
  return 'Direction';
}

function defaultAccentHex(mainColor: string | null): string {
  const main = mainColor?.toLowerCase() ?? null;
  return DEFAULT_COLOUR_SWATCHES.find((hex) => hex.toLowerCase() !== main) ?? '#1e7fff';
}

function nextDefaultColour(existing: ColourStop[], mainColor: string | null): string {
  const used = new Set(existing.map((stop) => stop.hex.toLowerCase()));
  return (
    DEFAULT_COLOUR_SWATCHES.find((hex) => !used.has(hex.toLowerCase())) ??
    defaultAccentHex(mainColor)
  );
}

function normaliseColourShares(stops: ColourStop[]): ColourStop[] {
  if (stops.length === 0) return stops;
  if (stops.length === 1) return [{ ...stops[0], share: 100 }];
  const total = stops.reduce((sum, stop) => sum + Math.max(0, stop.share), 0);
  const rawShares =
    total > 0
      ? stops.map((stop) => (Math.max(0, stop.share) / total) * 100)
      : stops.map(() => 100 / stops.length);
  const rounded = rawShares.map((share) => Math.max(1, Math.round(share)));
  let diff = 100 - rounded.reduce((sum, share) => sum + share, 0);
  while (diff !== 0) {
    const index =
      diff > 0 ? rounded.indexOf(Math.max(...rounded)) : rounded.findIndex((share) => share > 1);
    if (index < 0) break;
    rounded[index] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  return stops.map((stop, index) => ({ ...stop, share: rounded[index] ?? 1 }));
}

function colourShareBoundaries(stops: ColourStop[]): number[] {
  return stops.slice(0, -1).reduce<number[]>((acc, stop, index) => {
    const previous = acc[index - 1] ?? 0;
    acc.push(previous + stop.share);
    return acc;
  }, []);
}

function moveColourBoundary(stops: ColourStop[], index: number, percent: number): ColourStop[] {
  const normalisedStops = normaliseColourShares(stops);
  if (normalisedStops.length <= 1) return normalisedStops;
  const boundaries = colourShareBoundaries(normalisedStops);
  const minSegment = Math.min(12, Math.floor(90 / normalisedStops.length));
  const nextBoundaries = [...boundaries];
  const min = (nextBoundaries[index - 1] ?? 0) + minSegment;
  const max = (nextBoundaries[index + 1] ?? 100) - minSegment;
  nextBoundaries[index] = Math.min(max, Math.max(min, percent));
  const nextShares = normalisedStops.map((stop, stopIndex) => {
    const start = nextBoundaries[stopIndex - 1] ?? 0;
    const end = nextBoundaries[stopIndex] ?? 100;
    return { ...stop, share: Math.max(1, Math.round(end - start)) };
  });
  return normaliseColourShares(nextShares);
}

function rebalanceColourShare(stops: ColourStop[], id: string, share: number): ColourStop[] {
  if (stops.length <= 1) return normaliseColourShares(stops);
  const fixedShare = Math.min(95, Math.max(1, Math.round(share)));
  const others = stops.filter((stop) => stop.id !== id);
  const remaining = 100 - fixedShare;
  const otherTotal = others.reduce((sum, stop) => sum + Math.max(0, stop.share), 0);
  const next = stops.map((stop) => {
    if (stop.id === id) return { ...stop, share: fixedShare };
    const share =
      otherTotal > 0
        ? Math.round((Math.max(0, stop.share) / otherTotal) * remaining)
        : Math.round(remaining / others.length);
    return { ...stop, share: Math.max(1, share) };
  });
  return normaliseColourShares(next);
}

function colourStopLabel(mode: StarColourMode, index: number, count: number): string {
  if (mode === 'bands') {
    if (count === 2) return index === 0 ? 'Bottom' : 'Top';
    if (count === 3) return ['Bottom', 'Middle', 'Top'][index] ?? `Band ${index + 1}`;
    return `Band ${index + 1}`;
  }
  if (mode === 'stripes') return `Stripe ${index + 1}`;
  if (index === 0) return 'Star';
  return index === 1 ? 'Star accent' : `Mix ${index + 1}`;
}

function CompactColourInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const picker = HEX.test(value) ? value.toLowerCase() : '#ffffff';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Colour picker"
          className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-[color:var(--color-border-subtle)] bg-transparent disabled:cursor-not-allowed"
          value={picker}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value.toLowerCase())}
        />
        <Input
          id={id}
          type="text"
          inputMode="text"
          aria-label="Colour"
          className="h-8 w-28 px-2 font-mono text-xs tabular-nums"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value.toLowerCase())}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FIREWORK_COLOR_VALUES.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Use ${preset}`}
            disabled={disabled}
            onClick={() => onChange(preset)}
            className={[
              'h-5 w-5 rounded-full border border-[color:var(--color-border-subtle)] transition-transform hover:scale-110 disabled:cursor-not-allowed',
              value.toLowerCase() === preset.toLowerCase()
                ? 'ring-2 ring-[color:var(--color-content-emphasis)] ring-offset-1'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    </div>
  );
}

function ColourPatternBar({
  stops,
  disabled,
  onChange,
}: {
  stops: ColourStop[];
  disabled?: boolean;
  onChange: (stops: ColourStop[]) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    index: number;
    latestStops: ColourStop[];
    originStops: ColourStop[];
    pointerId: number;
  } | null>(null);
  const [draftColourStops, setDraftColourStops] = useState<ColourStop[] | null>(null);
  const [activeBoundaryIndex, setActiveBoundaryIndex] = useState<number | null>(null);
  const normalisedStops = normaliseColourShares(draftColourStops ?? stops);
  const boundaries = colourShareBoundaries(normalisedStops);

  function updateBoundary(index: number, percent: number) {
    onChange(moveColourBoundary(normalisedStops, index, percent));
  }

  function pointerPercent(clientX: number): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
  }

  function beginHandleDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.focus();
    const originStops = normaliseColourShares(stops);
    const latestStops = moveColourBoundary(originStops, index, pointerPercent(event.clientX));
    dragRef.current = {
      index,
      latestStops,
      originStops,
      pointerId: event.pointerId,
    };
    setActiveBoundaryIndex(index);
    setDraftColourStops(latestStops);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueHandleDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.index !== index) return;
    event.preventDefault();
    const latestStops = moveColourBoundary(drag.originStops, index, pointerPercent(event.clientX));
    drag.latestStops = latestStops;
    setDraftColourStops(latestStops);
  }

  function commitHandleDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const latestStops = drag.latestStops;
    dragRef.current = null;
    setActiveBoundaryIndex(null);
    setDraftColourStops(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onChange(latestStops);
  }

  if (normalisedStops.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
        ref={barRef}
        className="relative flex h-8 touch-none overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] select-none"
      >
        {normalisedStops.map((stop) => (
          <div
            key={stop.id}
            className={['h-full min-w-1', activeBoundaryIndex === null ? 'transition-[width]' : '']
              .filter(Boolean)
              .join(' ')}
            style={{
              width: `${stop.share}%`,
              backgroundColor: HEX.test(stop.hex) ? stop.hex : '#ffffff',
            }}
          />
        ))}
        {boundaries.map((boundary, index) => (
          <button
            key={`${normalisedStops[index]?.id ?? index}-handle`}
            type="button"
            aria-label={`Move colour split ${index + 1}`}
            className="focus-visible:ring-ring/60 absolute top-1/2 h-8 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
            style={{ left: `${boundary}%` }}
            disabled={disabled}
            onPointerDown={(event) => beginHandleDrag(index, event)}
            onPointerMove={(event) => continueHandleDrag(index, event)}
            onPointerUp={commitHandleDrag}
            onPointerCancel={commitHandleDrag}
            onLostPointerCapture={commitHandleDrag}
            onKeyDown={(event) => {
              if (disabled) return;
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                updateBoundary(index, boundary - 2);
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                updateBoundary(index, boundary + 2);
              }
            }}
          >
            <span className="mx-auto block h-6 w-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.24),0_1px_4px_rgba(0,0,0,0.26)]" />
          </button>
        ))}
      </div>
      {normalisedStops.length > 1 ? (
        <div className="flex gap-1">
          {normalisedStops.map((stop) => (
            <span
              key={`${stop.id}-share`}
              className="text-muted-foreground min-w-0 text-center font-mono text-[10px] tabular-nums"
              style={{ width: `${stop.share}%` }}
            >
              {Math.round(stop.share)}%
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReplayCanvasSkeleton() {
  return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#0b1020]" />;
}

function buildInitialColourStops(
  firework: AdminFireworkDetail,
  overrides: JsonRecord,
): ColourStop[] {
  const pattern = readRecord(readRecord(readRecord(overrides, 'stars'), 'outer'), 'colourPattern');
  const patternColours = Array.isArray(pattern.colours) ? pattern.colours : [];
  const patternStops = patternColours
    .map((entry, index): ColourStop | null => {
      if (!isRecord(entry)) return null;
      const hex = rgbObjectToHex(entry.color);
      if (!hex) return null;
      const share = Number(entry.weight);
      return {
        id: `initial-pattern-${index}`,
        hex,
        share: Number.isFinite(share) ? Math.max(1, Math.round(share)) : 100,
      };
    })
    .filter((stop): stop is ColourStop => Boolean(stop));
  if (patternStops.length > 0)
    return normaliseColourShares(patternStops).slice(0, MAX_STAR_COLOURS);

  const outerColor = rgbObjectToHex(
    readRecord(readRecord(readRecord(overrides, 'stars'), 'outer'), 'color'),
  );
  const mainHex = outerColor ?? firework.primaryColor ?? '#ff0043';
  const accentShare = Math.round(readInitialAccentAmount(overrides) * 100);
  const stops: ColourStop[] = [{ id: 'initial-main', hex: mainHex, share: 100 }];
  const accent =
    firework.secondaryColor ??
    firework.colorPalette.find((hex) => hex.toLowerCase() !== mainHex.toLowerCase()) ??
    null;
  if (accent) {
    stops[0].share = 100 - accentShare;
    stops.push({ id: 'initial-accent', hex: accent, share: accentShare });
  }

  return normaliseColourShares(stops);
}

export function FireworkEditor({ firework }: { firework: AdminFireworkDetail }) {
  const router = useRouter();
  const colourToggleId = useId();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);

  const initialOverrides = useMemo<JsonRecord>(
    () => (isRecord(firework.renderOverridesJson) ? firework.renderOverridesJson : {}),
    [firework.renderOverridesJson],
  );

  const [name, setName] = useState(firework.name);
  const [description, setDescription] = useState(firework.description ?? '');
  const [effectId, setEffectId] = useState(
    firework.effectId ?? firework.effectOptions[0]?.id ?? '',
  );
  const [caliber, setCaliber] = useState(firework.caliber ?? '');
  const [durationSeconds, setDurationSeconds] = useState(
    firework.durationSeconds == null ? '' : String(firework.durationSeconds),
  );
  const [heightMeters, setHeightMeters] = useState(
    firework.heightMeters == null ? '' : String(firework.heightMeters),
  );
  const initialColourStops = useMemo(
    () => buildInitialColourStops(firework, initialOverrides),
    [firework, initialOverrides],
  );
  const [colourStops, setColourStops] = useState<ColourStop[]>(initialColourStops);
  const [colourMode, setColourMode] = useState<StarColourMode>(() => {
    const initialMode = initialColourMode(initialOverrides);
    return initialMode === 'solid' && initialColourStops.length > 1 ? 'random' : initialMode;
  });
  const [colourAxis, setColourAxis] = useState<StarColourAxis>(() =>
    initialColourAxis(initialOverrides),
  );
  const nextColourStopIdRef = useRef(initialColourStops.length);
  const [overridesText, setOverridesText] = useState(
    JSON.stringify(firework.renderOverridesJson ?? {}, null, 2),
  );

  const parsedOverrides = useMemo(() => parseJsonObject(overridesText), [overridesText]);
  const overridesRecord = useMemo<JsonRecord>(
    () => (parsedOverrides.ok ? parsedOverrides.value : {}),
    [parsedOverrides],
  );

  const validColourStops = useMemo(
    () =>
      normaliseColourShares(colourStops.filter((stop) => HEX.test(stop.hex))).slice(
        0,
        MAX_STAR_COLOURS,
      ),
    [colourStops],
  );
  const mainColor = validColourStops[0]?.hex ?? null;
  const accentColor = validColourStops[1]?.hex ?? null;
  const accentShare = validColourStops[1]?.share ?? 0;
  const positionalColourMode = colourMode === 'bands' || colourMode === 'stripes';
  const colourDefaults = readRecord(overridesRecord, 'colour');
  const colourEnabled = typeof colourDefaults.enabled === 'boolean' ? colourDefaults.enabled : true;

  const baseModel = useMemo(
    () => (firework.effectModels[effectId] ?? firework.effectModelJson) as Json,
    [effectId, firework.effectModels, firework.effectModelJson],
  );
  const calibrationDefaults = useMemo(() => {
    const model = isRecord(baseModel) ? baseModel : {};
    return readRecord(canonicaliseEffectModelJson(model), 'renderDefaults');
  }, [baseModel]);

  const palette = useMemo(
    () =>
      Array.from(
        new Set(
          validColourStops
            .map((stop) => stop.hex)
            .filter((hex): hex is string => Boolean(hex))
            .map((hex) => hex.toLowerCase()),
        ),
      ),
    [validColourStops],
  );

  /** Overrides merged with the colour choices, used for both preview and save. */
  const mergedOverrides = useMemo<JsonRecord>(() => {
    const base = cloneRecord(overridesRecord);
    delete base.pistil;
    if (accentColor && colourMode === 'random')
      base.secondaryColorRatio = Number((accentShare / 100).toFixed(3));
    else delete base.secondaryColorRatio;

    const stars = ensureRecord(base, 'stars');
    const outer = ensureRecord(stars, 'outer');
    if (mainColor) outer.color = hexToRgbObject(mainColor);
    else delete outer.color;
    outer.colourPattern = {
      mode: colourMode,
      axis: colourAxis,
      count: clampStarPatternCount(validColourStops.length),
      colours: validColourStops.map((stop) => ({
        color: hexToRgbObject(stop.hex),
        weight: stop.share,
      })),
    };
    if (isRecord(stars.core)) {
      const core = { ...stars.core };
      delete core.color;
      delete core.colourPattern;
      stars.core = core;
    }
    return base;
  }, [
    overridesRecord,
    mainColor,
    accentColor,
    accentShare,
    colourMode,
    colourAxis,
    validColourStops,
  ]);

  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel,
        variantOverrides: mergedOverrides,
        primaryColor: mainColor,
        colorPalette: palette.length ? palette : null,
      }),
    [baseModel, mergedOverrides, mainColor, palette],
  );

  // Head-orb appearance is saved into the firework's render overrides, so the
  // sliders read from the compiled design and write straight back. A firework
  // inherits its effect's saved look and customises it from here.
  const heads = previewDesign.stars.outer.head;
  const glowPadding = heads.glowPadding;
  const whiteCoreSizePercent = heads.whiteCoreSizePercent;
  const whiteCoreBlurPercent = heads.whiteCoreBlurPercent;
  const coreSoftness = heads.coreSoftness;
  const coreBrightness = heads.coreBrightness;
  const coreOpacityFalloff = heads.coreOpacityFalloff;
  const glowSize = heads.glowSize;
  const glowSoftness = heads.glowSoftness;
  const glowOpacityFalloff = heads.glowOpacityFalloff;
  const glowBlur = heads.glowBlur;
  const backgroundGlowOpacityFalloff = heads.backgroundGlowOpacityFalloff;
  const backgroundGlowSoftness = heads.backgroundGlowSoftness;

  const previewDuration = useMemo(() => {
    const estimated = PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(4, Math.ceil(estimated * 2) / 2);
  }, [previewDesign]);

  const selectedEffect = firework.effectOptions.find((option) => option.id === effectId) ?? null;

  const previewCue = useMemo<ReplayCue>(
    () => ({
      id: `${firework.id}-preview`,
      position: 1,
      timeSeconds: PREVIEW_CUE_TIME_SECONDS,
      description: name,
      productId: firework.id,
      launchPositionIndex: 0,
      firework: {
        id: firework.id,
        slug: firework.slug,
        name,
        description: description || null,
        sortOrder: 0,
        durationSeconds: previewDuration,
        heightMeters: null,
        caliber: caliber || null,
        shotCount: 1,
        spec: DEFAULT_FIREWORK_SPEC,
        rawSpec: mergedOverrides,
        renderDesign: previewDesign,
        baseEffect: selectedEffect
          ? {
              id: selectedEffect.id,
              slug: selectedEffect.slug,
              name: selectedEffect.name,
              patternKey: selectedEffect.patternKey,
            }
          : null,
        variant: null,
      },
    }),
    [
      caliber,
      description,
      firework.id,
      firework.slug,
      name,
      mergedOverrides,
      previewDesign,
      previewDuration,
      selectedEffect,
    ],
  );

  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    let lastUiUpdate = 0;
    startedAtRef.current = performance.now() - playbackRef.current * 1000;

    function tick(now: number) {
      const raw = (now - startedAtRef.current) / 1000;
      let next = raw;
      if (raw >= previewDuration) {
        if (!isLooping) {
          playbackRef.current = previewDuration;
          setElapsed(previewDuration);
          setIsPlaying(false);
          return;
        }
        next = raw % previewDuration;
        startedAtRef.current = now - next * 1000;
      }
      playbackRef.current = next;
      if (now - lastUiUpdate > 90) {
        setElapsed(next);
        lastUiUpdate = now;
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, isLooping, previewDuration]);

  function setPreviewTime(seconds: number) {
    startedAtRef.current = performance.now() - seconds * 1000;
    playbackRef.current = seconds;
    setElapsed(seconds);
  }

  function mutateOverrides(updater: (defaults: JsonRecord) => void) {
    if (!parsedOverrides.ok) return;
    const draft = cloneRecord(parsedOverrides.value);
    updater(draft);
    setOverridesText(JSON.stringify(draft, null, 2));
  }

  function setColourEnabled(value: boolean) {
    mutateOverrides((draft) => {
      const colour = ensureRecord(draft, 'colour');
      colour.enabled = value;
    });
  }

  function updateColourStopHex(id: string, hex: string) {
    setColourStops((stops) =>
      stops.map((stop) => (stop.id === id ? { ...stop, hex: hex.toLowerCase() } : stop)),
    );
  }

  function updateColourStopShare(id: string, share: number) {
    setColourStops((stops) => rebalanceColourShare(stops, id, share));
  }

  function updateColourStopShares(nextStops: ColourStop[]) {
    const shareById = new Map(nextStops.map((stop) => [stop.id, stop.share]));
    setColourStops((stops) =>
      normaliseColourShares(
        stops.map((stop) => ({
          ...stop,
          share: shareById.get(stop.id) ?? stop.share,
        })),
      ),
    );
  }

  function updateColourMode(value: string) {
    if (!isStarColourMode(value)) return;
    setColourMode(value);
  }

  function updateColourAxis(value: string) {
    if (isStarColourAxis(value)) setColourAxis(value);
  }

  function removeColourStop(id: string) {
    setColourStops((stops) => normaliseColourShares(stops.filter((stop) => stop.id !== id)));
  }

  function addColor() {
    const id = `added-${nextColourStopIdRef.current}`;
    nextColourStopIdRef.current += 1;
    setColourStops((stops) => {
      if (stops.length >= MAX_STAR_COLOURS) return stops;
      const newShare = Math.max(10, Math.round(100 / (stops.length + 1)));
      const next = stops.map((stop) => ({
        ...stop,
        share: stop.share * ((100 - newShare) / 100),
      }));
      return normaliseColourShares([
        ...next,
        { id, hex: nextDefaultColour(stops, mainColor), share: newShare },
      ]);
    });
    if (colourMode === 'solid') setColourMode('random');
  }

  function save() {
    setError(null);
    if (!parsedOverrides.ok) {
      setError(parsedOverrides.error);
      return;
    }
    if (!effectId) {
      setError('Choose a base effect.');
      return;
    }
    if (!mainColor) {
      setError('Pick a main colour.');
      return;
    }
    startTransition(async () => {
      const result = await updateFirework({
        id: firework.id,
        name,
        description,
        fireworkEffectId: effectId,
        caliber,
        durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
        heightMeters: heightMeters === '' ? null : Number(heightMeters),
        primaryColor: mainColor,
        secondaryColor: accentColor,
        colorPalette: palette,
        renderOverridesJson: JSON.stringify(mergedOverrides, null, 2),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Firework saved');
      router.refresh();
    });
  }

  const effectOptions = firework.effectOptions.map((option) => ({
    value: option.id,
    label: option.name,
    description: option.family,
  }));
  const canAddColor = colourStops.length < MAX_STAR_COLOURS;
  const starColourControls = (
    <SubSection
      title="Colour"
      defaultExpanded={false}
      action={
        <Switch
          id={colourToggleId}
          aria-label="Colour"
          checked={colourEnabled}
          onCheckedChange={setColourEnabled}
          disabled={!parsedOverrides.ok}
        />
      }
    >
      <div
        className={['space-y-4 pt-1', !colourEnabled ? 'opacity-55' : ''].filter(Boolean).join(' ')}
      >
        <div
          className={[
            'grid gap-3 sm:items-end',
            positionalColourMode
              ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
              : 'sm:grid-cols-[minmax(0,1fr)_auto]',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Field>
            <FieldLabel>Pattern</FieldLabel>
            <SelectField
              value={colourMode}
              onChange={updateColourMode}
              options={STAR_COLOUR_MODE_OPTIONS}
              ariaLabel="Star colour pattern"
              disabled={!colourEnabled}
            />
          </Field>
          {positionalColourMode ? (
            <Field>
              <FieldLabel>{colourPatternQuestion(colourMode)}</FieldLabel>
              <SelectField
                value={colourAxis}
                onChange={updateColourAxis}
                options={STAR_COLOUR_AXIS_OPTIONS}
                ariaLabel={colourPatternQuestion(colourMode)}
                disabled={!colourEnabled}
              />
            </Field>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={addColor}
              aria-label="Add colour"
              disabled={!canAddColor || !colourEnabled}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>

        <ColourPatternBar
          stops={validColourStops}
          disabled={!colourEnabled || validColourStops.length <= 1}
          onChange={updateColourStopShares}
        />

        <div className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)]">
          {colourStops.map((stop, index) => {
            const title = colourStopLabel(colourMode, index, colourStops.length);
            return (
              <div
                key={stop.id}
                className="space-y-3 border-t border-[color:var(--color-border-subtle)] p-3 first:border-t-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-[color:var(--color-border-subtle)]"
                      style={{ backgroundColor: HEX.test(stop.hex) ? stop.hex : '#ffffff' }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                      {title}
                    </span>
                    {colourStops.length > 1 ? (
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        {Math.round(stop.share)}%
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove colour"
                    className="text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]"
                    onClick={() => removeColourStop(stop.id)}
                    disabled={!colourEnabled || colourStops.length <= 1}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div
                  className={
                    colourMode === 'random'
                      ? 'grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]'
                      : 'flex flex-wrap items-start gap-4'
                  }
                >
                  <CompactColourInput
                    value={stop.hex}
                    disabled={!colourEnabled}
                    onChange={(hex) => updateColourStopHex(stop.id, hex)}
                  />
                  {colourMode === 'random' ? (
                    <SliderField
                      label={index === 1 ? 'Accent share' : 'Share'}
                      min={1}
                      max={95}
                      step={1}
                      value={Math.round(stop.share)}
                      formatValue={(value) => `${value}%`}
                      disabled={!colourEnabled || colourStops.length <= 1}
                      onChange={(value) => updateColourStopShare(stop.id, value)}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SubSection>
  );

  return (
    <div className="flex flex-col gap-5 xl:h-[calc(100vh-6.5rem)] xl:flex-row xl:items-stretch">
      <Card radius="lg" className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="relative h-[min(62vw,560px)] min-h-[360px] bg-[#05070d] xl:h-auto xl:min-h-0 xl:flex-1">
          <LazyFireworkReplayCanvas
            cues={[previewCue]}
            elapsed={elapsed}
            playbackRef={playbackRef}
            launchPositions={PREVIEW_LAUNCH_POSITIONS}
            muted={!isPlaying}
            interactive
            controlsVisible
            showFps
            renderTuning={{ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent }}
            headStyle={{
              coreSoftness,
              coreBrightness,
              coreOpacityFalloff,
              glowSize,
              glowSoftness,
              glowOpacityFalloff,
              glowBlur,
              backgroundGlowOpacityFalloff,
              backgroundGlowSoftness,
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => {
                if (!isPlaying && playbackRef.current >= previewDuration - 0.05) {
                  setPreviewTime(PREVIEW_START_SECONDS);
                }
                setIsPlaying((playing) => !playing);
              }}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => {
                setIsPlaying(false);
                setPreviewTime(PREVIEW_START_SECONDS);
              }}
              aria-label="Reset preview"
            >
              <RotateCcw size={16} />
            </Button>
            <Button
              variant={isLooping ? 'primary' : 'secondary'}
              size="icon"
              onClick={() => setIsLooping((looping) => !looping)}
              aria-pressed={isLooping}
              aria-label={isLooping ? 'Disable looping' : 'Enable looping'}
            >
              <Repeat size={16} />
            </Button>
          </div>
          <Slider
            value={[Math.min(elapsed, previewDuration)]}
            min={0}
            max={previewDuration}
            step={0.05}
            onValueChange={(next) => {
              setIsPlaying(false);
              setPreviewTime(next[0] ?? 0);
            }}
            aria-label="Preview timeline"
            className="min-w-40 flex-1"
          />
          <div className="font-mono text-sm text-[color:var(--color-content-subtle)] tabular-nums">
            {elapsed.toFixed(1)}s / {previewDuration.toFixed(1)}s
          </div>
        </div>
      </Card>

      <Card
        radius="lg"
        className="flex w-full min-w-0 flex-col p-0 xl:w-[460px] xl:shrink-0 xl:self-stretch"
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 pb-8">
          {error ? (
            <InlineAlert tone="danger" title="Could not save">
              {error}
            </InlineAlert>
          ) : null}

          <PanelSection title="Details" collapsible defaultExpanded={false}>
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="fw-name">Name</FieldLabel>
                <Input id="fw-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Base effect</FieldLabel>
                <SelectField
                  value={effectId}
                  onChange={setEffectId}
                  options={effectOptions}
                  ariaLabel="Base effect"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="fw-caliber">Calibre</FieldLabel>
                  <Input
                    id="fw-caliber"
                    placeholder="30mm"
                    value={caliber}
                    onChange={(e) => setCaliber(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fw-duration">Duration (s)</FieldLabel>
                  <Input
                    id="fw-duration"
                    inputMode="decimal"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fw-height">Height (m)</FieldLabel>
                  <Input
                    id="fw-height"
                    inputMode="decimal"
                    value={heightMeters}
                    onChange={(e) => setHeightMeters(e.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="fw-description">Description</FieldLabel>
                <Textarea
                  id="fw-description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
          </PanelSection>

          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            starControls={starColourControls}
            mutate={mutateOverrides}
            disabled={!parsedOverrides.ok}
            showLaunch
            showStarCount
          />
        </div>

        <div className="border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <Button
            className="w-full"
            onClick={save}
            loading={isPending}
            disabled={!parsedOverrides.ok}
          >
            <Save size={16} />
            Save firework
          </Button>
        </div>
      </Card>
    </div>
  );
}
