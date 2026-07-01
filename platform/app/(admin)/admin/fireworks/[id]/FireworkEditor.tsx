'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Braces,
  CircleDot,
  Cloud,
  History,
  Palette,
  Plus,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { restoreFireworkEditorVersion, updateFirework } from '@/app/actions/admin-fireworks';
import { createStyleDefault } from '@/app/actions/admin-style-defaults';
import {
  EditorHistoryPanel,
  JsonReadOnlyPanel,
} from '@/app/components/admin/EditorInspectorPanels';
import { EditorStyleDefaultControls } from '@/app/components/admin/EditorSectionPanels';
import { estimatePreviewTicks } from '@/app/components/admin/editor-preview-timing';
import {
  EditorPreviewTransport,
  FireworkEditorShell,
  type FireworkEditorShellTab,
} from '@/app/components/admin/FireworkEditorShell';
import { usePreviewFullscreen } from '@/app/components/admin/previewFullscreen';
import { useAdminBreadcrumbOverride } from '@/app/components/admin/AdminShell';
import { ReplayStageBackdrop } from '@/app/components/app/ReplayStageBackdrop';
import {
  FireworkRenderControls,
  type JsonRecord,
} from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { ColorPicker } from '@/app/components/ui/ColorPicker';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField, type SelectOption } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/app/components/ui/toast';
import type {
  AdminEditorVersion,
  AdminFireworkDetail,
  AdminStyleDefaultOption,
} from '@/lib/admin.types';
import { parseFireworkEditorSnapshot } from '@/lib/admin/editor-snapshots';
import type { Json } from '@/lib/database.types';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  extractStyleDefaultsFromDesign,
  NO_STYLE_DEFAULT_VALUE,
  emptyStyleDefaultIdMap,
  orderedStyleDefaultValues,
  removeStyleDefaultOverridesFromRecord,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { DEFAULT_FIREWORK_SPEC, FIREWORK_COLOR_VALUES, hexToRgb } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: JsonRecord } | { ok: false; error: string };

type StarColourMode = 'solid' | 'random' | 'bands' | 'stripes';
type StarColourAxis = 'vertical' | 'horizontal';
type ColourStop = { id: string; hex: string; share: number };
type LocalStyleDefaultOptions = Partial<
  Record<FireworkStyleDefaultKind, AdminStyleDefaultOption[]>
>;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
// Coalesce heavyweight `elapsed` commits during a timeline drag to ~15Hz so a
// fast scrub does not re-render the whole editor on every input event. The
// engine ref and the transport's local thumb still update at full input rate.
const SCRUB_COMMIT_INTERVAL_MS = 67;
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

function styleDefaultOptions(
  options: AdminStyleDefaultOption[],
  selected: AdminStyleDefaultOption | null,
): SelectOption[] {
  const seen = new Set<string>();
  const source = selected ? [selected, ...options] : options;
  return [
    { value: NO_STYLE_DEFAULT_VALUE, label: 'Custom' },
    ...source
      .filter((option) => {
        if (seen.has(option.id)) return false;
        seen.add(option.id);
        return true;
      })
      .map((option) => ({
        value: option.id,
        label: option.name,
        description: option.description ?? undefined,
      })),
  ];
}

function findStyleDefault(
  id: string,
  options: AdminStyleDefaultOption[],
  fallback: AdminStyleDefaultOption | null,
  localOptions: AdminStyleDefaultOption[] = [],
): AdminStyleDefaultOption | null {
  if (id === NO_STYLE_DEFAULT_VALUE) return null;
  return (
    localOptions.find((option) => option.id === id) ??
    options.find((option) => option.id === id) ??
    (fallback?.id === id ? fallback : null)
  );
}

function initialStyleDefaultIds(
  firework: AdminFireworkDetail,
): Record<FireworkStyleDefaultKind, string> {
  const ids = emptyStyleDefaultIdMap();
  for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
    ids[kind] =
      firework.styleDefaultIds[kind] ?? firework.fireworkStyleDefaultLinks[kind]?.id ?? ids[kind];
  }
  ids.star = firework.starStyleDefaultId ?? ids.star;
  ids.trail = firework.trailStyleDefaultId ?? ids.trail;
  return ids;
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeRecordInto(target: JsonRecord, source: JsonRecord) {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value)) {
      mergeRecordInto(ensureRecord(target, key), value);
    } else {
      target[key] = cloneJsonValue(value);
    }
  }
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

function applyColourToOverrides(
  record: JsonRecord,
  colour: {
    mainColor: string | null;
    accentColor: string | null;
    accentShare: number;
    colourMode: StarColourMode;
    colourAxis: StarColourAxis;
    validColourStops: ColourStop[];
  },
): JsonRecord {
  const base = cloneRecord(record);
  delete base.pistil;
  if (colour.accentColor && colour.colourMode === 'random')
    base.secondaryColorRatio = Number((colour.accentShare / 100).toFixed(3));
  else delete base.secondaryColorRatio;

  const stars = ensureRecord(base, 'stars');
  const outer = ensureRecord(stars, 'outer');
  if (colour.mainColor) outer.color = hexToRgbObject(colour.mainColor);
  else delete outer.color;
  outer.colourPattern = {
    mode: colour.colourMode,
    axis: colour.colourAxis,
    count: clampStarPatternCount(colour.validColourStops.length),
    colours: colour.validColourStops.map((stop) => ({
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
}

function toSaveStyleDefaultIds(
  ids: Record<FireworkStyleDefaultKind, string>,
): Record<FireworkStyleDefaultKind, string | null> {
  return Object.fromEntries(
    FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => [
      kind,
      ids[kind] === NO_STYLE_DEFAULT_VALUE ? null : ids[kind],
    ]),
  ) as Record<FireworkStyleDefaultKind, string | null>;
}

function fireworkEditorSignature(fields: {
  name: string;
  description: string;
  effectId: string;
  caliber: string;
  durationSeconds: string;
  heightMeters: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  styleDefaultIds: Record<FireworkStyleDefaultKind, string | null>;
  renderOverridesJson: JsonRecord;
}): string {
  return JSON.stringify({
    name: fields.name,
    description: fields.description,
    effectId: fields.effectId,
    caliber: fields.caliber,
    durationSeconds: fields.durationSeconds,
    heightMeters: fields.heightMeters,
    primaryColor: fields.primaryColor,
    secondaryColor: fields.secondaryColor,
    colorPalette: fields.colorPalette,
    styleDefaultIds: fields.styleDefaultIds,
    renderOverridesJson: fields.renderOverridesJson,
  });
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
  const picker = HEX.test(value) ? value.toLowerCase() : '#ffffff';
  return (
    <ColorPicker
      label="Colour"
      value={picker}
      disabled={disabled}
      showValue={false}
      className="h-8 w-8 justify-center rounded-full border-0 bg-transparent p-0 shadow-none hover:border-transparent"
      swatchClassName="h-7 w-7 rounded-full"
      onChange={onChange}
    />
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
        className="relative flex h-8 touch-none overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] select-none"
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
  return <ReplayStageBackdrop />;
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
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const colourToggleId = useId();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoadingProgress, setPreviewLoadingProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);
  const lastScrubCommitRef = useRef(0);
  const pendingScrubRef = useRef<number | null>(null);
  const initialOverrides = useMemo<JsonRecord>(
    () => (isRecord(firework.renderOverridesJson) ? firework.renderOverridesJson : {}),
    [firework.renderOverridesJson],
  );

  const [name, setName] = useState(firework.name);
  const [description, setDescription] = useState(firework.description ?? '');
  const [effectId, setEffectId] = useState(
    firework.effectId ?? firework.effectOptions[0]?.id ?? '',
  );
  const [styleDefaultIds, setStyleDefaultIds] = useState(() => initialStyleDefaultIds(firework));
  const [createdStyleDefaults, setCreatedStyleDefaults] = useState<LocalStyleDefaultOptions>({});
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
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(firework.updatedAt);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('colour');
  const [previewVersion, setPreviewVersion] = useState<AdminEditorVersion | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

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
  const selectedEffectStyleDefaults = useMemo(
    () => firework.effectStyleDefaultLinksByEffect[effectId] ?? firework.effectStyleDefaultLinks,
    [effectId, firework.effectStyleDefaultLinks, firework.effectStyleDefaultLinksByEffect],
  );
  const selectedFireworkStyleDefaults = useMemo(() => {
    const selected: Partial<Record<FireworkStyleDefaultKind, AdminStyleDefaultOption | null>> = {};
    for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
      selected[kind] = findStyleDefault(
        styleDefaultIds[kind],
        firework.styleDefaults[kind],
        firework.fireworkStyleDefaultLinks[kind] ?? null,
        createdStyleDefaults[kind] ?? [],
      );
    }
    return selected;
  }, [
    createdStyleDefaults,
    firework.fireworkStyleDefaultLinks,
    firework.styleDefaults,
    styleDefaultIds,
  ]);
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
  const mergedOverrides = useMemo<JsonRecord>(
    () =>
      applyColourToOverrides(overridesRecord, {
        mainColor,
        accentColor,
        accentShare,
        colourMode,
        colourAxis,
        validColourStops,
      }),
    [
      overridesRecord,
      mainColor,
      accentColor,
      accentShare,
      colourMode,
      colourAxis,
      validColourStops,
    ],
  );
  const saveStyleDefaultIds = useMemo(
    () => toSaveStyleDefaultIds(styleDefaultIds),
    [styleDefaultIds],
  );
  const currentSignature = useMemo(
    () =>
      fireworkEditorSignature({
        name,
        description,
        effectId,
        caliber,
        durationSeconds,
        heightMeters,
        primaryColor: mainColor,
        secondaryColor: accentColor,
        colorPalette: palette,
        styleDefaultIds: saveStyleDefaultIds,
        renderOverridesJson: mergedOverrides,
      }),
    [
      accentColor,
      caliber,
      description,
      durationSeconds,
      effectId,
      heightMeters,
      mainColor,
      mergedOverrides,
      name,
      palette,
      saveStyleDefaultIds,
    ],
  );
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useEffect(() => {
    if (savedSignature === null) setSavedSignature(currentSignature);
  }, [currentSignature, savedSignature]);

  useEffect(() => {
    setName(firework.name);
    setDescription(firework.description ?? '');
    setEffectId(firework.effectId ?? firework.effectOptions[0]?.id ?? '');
    setStyleDefaultIds(initialStyleDefaultIds(firework));
    setCreatedStyleDefaults({});
    setCaliber(firework.caliber ?? '');
    setDurationSeconds(firework.durationSeconds == null ? '' : String(firework.durationSeconds));
    setHeightMeters(firework.heightMeters == null ? '' : String(firework.heightMeters));
    setColourStops(initialColourStops);
    setColourMode(() => {
      const initialMode = initialColourMode(initialOverrides);
      return initialMode === 'solid' && initialColourStops.length > 1 ? 'random' : initialMode;
    });
    setColourAxis(initialColourAxis(initialOverrides));
    nextColourStopIdRef.current = initialColourStops.length;
    setOverridesText(JSON.stringify(firework.renderOverridesJson ?? {}, null, 2));
    setLastSavedUpdatedAt(firework.updatedAt);
    setPreviewVersion(null);
    setRestoringVersionId(null);
    setSavedSignature(null);
  }, [firework, initialColourStops, initialOverrides]);

  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel,
        effectStyleDefaults: orderedStyleDefaultValues(selectedEffectStyleDefaults).map(
          (item) => item?.defaultsJson,
        ),
        fireworkStyleDefaults: orderedStyleDefaultValues(selectedFireworkStyleDefaults).map(
          (item) => item?.defaultsJson,
        ),
        variantOverrides: mergedOverrides,
        primaryColor: mainColor,
        colorPalette: palette.length ? palette : null,
      }),
    [
      baseModel,
      mergedOverrides,
      mainColor,
      palette,
      selectedEffectStyleDefaults,
      selectedFireworkStyleDefaults,
    ],
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
  const previewTicks = useMemo(
    () =>
      estimatePreviewTicks({
        design: previewDesign,
        cueTimeSeconds: PREVIEW_CUE_TIME_SECONDS,
        previewDuration,
      }),
    [previewDesign, previewDuration],
  );

  const selectedEffect = firework.effectOptions.find((option) => option.id === effectId) ?? null;

  useEffect(() => {
    setAdminBreadcrumb({ label: name || firework.name });
    return () => setAdminBreadcrumb(null);
  }, [firework.name, name, setAdminBreadcrumb]);

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
  const previewCues = useMemo(() => [previewCue], [previewCue]);

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
      if (now - lastUiUpdate > 32) {
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

  function scrubTo(seconds: number) {
    const next = Math.max(0, Math.min(previewDuration, seconds));
    // Engine ref + play-loop anchor track the drag at full rate; the
    // heavyweight `elapsed` state (which re-renders the whole editor) is
    // coalesced to ~15Hz. The transport's local thumb covers the visual gap.
    playbackRef.current = next;
    startedAtRef.current = performance.now() - next * 1000;
    pendingScrubRef.current = next;
    const now = performance.now();
    if (now - lastScrubCommitRef.current >= SCRUB_COMMIT_INTERVAL_MS) {
      lastScrubCommitRef.current = now;
      setElapsed(next);
    }
  }

  function commitScrub() {
    const pending = pendingScrubRef.current;
    if (pending == null) return;
    pendingScrubRef.current = null;
    lastScrubCommitRef.current = 0;
    setPreviewTime(pending);
  }

  function mutateOverrides(updater: (defaults: JsonRecord) => void) {
    if (!parsedOverrides.ok) return;
    const draft = cloneRecord(parsedOverrides.value);
    updater(draft);
    setOverridesText(JSON.stringify(draft, null, 2));
  }

  function markStyleDefaultCustom(kind: FireworkStyleDefaultKind) {
    setStyleDefaultIds((current) => {
      if (current[kind] === NO_STYLE_DEFAULT_VALUE) return current;
      return { ...current, [kind]: NO_STYLE_DEFAULT_VALUE };
    });
  }

  function shouldMaterialiseStyleDefault(kind: FireworkStyleDefaultKind): boolean {
    return (
      styleDefaultIds[kind] !== NO_STYLE_DEFAULT_VALUE || selectedEffectStyleDefaults[kind] != null
    );
  }

  function materialiseStyleDefault(kind: FireworkStyleDefaultKind, defaults: JsonRecord) {
    if (!shouldMaterialiseStyleDefault(kind)) return false;
    mergeRecordInto(defaults, extractStyleDefaultsFromDesign(previewDesign, kind));
    return styleDefaultIds[kind] !== NO_STYLE_DEFAULT_VALUE;
  }

  function mutateOverridesForStyle(
    kind: FireworkStyleDefaultKind,
    updater: (defaults: JsonRecord) => void,
  ) {
    if (!parsedOverrides.ok) return;
    const draft = cloneRecord(parsedOverrides.value);
    const shouldMarkCustom = materialiseStyleDefault(kind, draft);
    updater(draft);
    setOverridesText(JSON.stringify(draft, null, 2));
    if (shouldMarkCustom) markStyleDefaultCustom(kind);
  }

  function materialiseStyleDefaultInOverrides(kind: FireworkStyleDefaultKind) {
    mutateOverridesForStyle(kind, () => {});
  }

  function setColourEnabled(value: boolean) {
    mutateOverrides((draft) => {
      const colour = ensureRecord(draft, 'colour');
      colour.enabled = value;
    });
  }

  function updateColourStopHex(id: string, hex: string) {
    materialiseStyleDefaultInOverrides('star');
    setColourStops((stops) =>
      stops.map((stop) => (stop.id === id ? { ...stop, hex: hex.toLowerCase() } : stop)),
    );
  }

  function updateColourStopShare(id: string, share: number) {
    materialiseStyleDefaultInOverrides('star');
    setColourStops((stops) => rebalanceColourShare(stops, id, share));
  }

  function updateColourStopShares(nextStops: ColourStop[]) {
    materialiseStyleDefaultInOverrides('star');
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
    materialiseStyleDefaultInOverrides('star');
    setColourMode(value);
  }

  function updateColourAxis(value: string) {
    if (!isStarColourAxis(value)) return;
    materialiseStyleDefaultInOverrides('star');
    setColourAxis(value);
  }

  function removeColourStop(id: string) {
    materialiseStyleDefaultInOverrides('star');
    setColourStops((stops) => normaliseColourShares(stops.filter((stop) => stop.id !== id)));
  }

  function addColor() {
    materialiseStyleDefaultInOverrides('star');
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

  function resetLocalStyleDefaults(kind: FireworkStyleDefaultKind) {
    mutateOverrides((draft) => {
      removeStyleDefaultOverridesFromRecord(draft, kind);
    });
  }

  function handleStyleDefaultChange(kind: FireworkStyleDefaultKind, value: string) {
    if (value !== NO_STYLE_DEFAULT_VALUE) {
      mutateOverrides((draft) => {
        removeStyleDefaultOverridesFromRecord(draft, kind);
      });
    }
    setStyleDefaultIds((current) => ({ ...current, [kind]: value }));
  }

  function handleEffectIdChange(nextEffectId: string) {
    if (nextEffectId === effectId) return;
    setEffectId(nextEffectId);
    // Swap to the new effect's template: drop firework-level preset selections so the
    // new effect's inherited defaults drive the preview, and clear overrides tuned for
    // the previous effect so they do not shadow the new base model.
    setStyleDefaultIds(emptyStyleDefaultIdMap());
    setOverridesText(JSON.stringify({}, null, 2));
  }

  async function persistFirework(args: {
    styleDefaultIdsMap: Record<FireworkStyleDefaultKind, string | null>;
    overrides: JsonRecord;
  }): Promise<boolean> {
    const result = await updateFirework({
      id: firework.id,
      expectedUpdatedAt: lastSavedUpdatedAt,
      name,
      description,
      fireworkEffectId: effectId,
      caliber,
      durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
      heightMeters: heightMeters === '' ? null : Number(heightMeters),
      primaryColor: mainColor,
      secondaryColor: accentColor,
      colorPalette: palette,
      starStyleDefaultId: args.styleDefaultIdsMap.star ?? null,
      trailStyleDefaultId: args.styleDefaultIdsMap.trail ?? null,
      styleDefaultIds: args.styleDefaultIdsMap,
      renderOverridesJson: JSON.stringify(args.overrides, null, 2),
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setLastSavedUpdatedAt(result.updatedAt);
    return true;
  }

  function saveCurrentStyleAsDefault(kind: FireworkStyleDefaultKind) {
    setError(null);
    startTransition(async () => {
      const result = await createStyleDefault({
        kind,
        name: `${name || firework.name} ${styleDefaultKindLabel(kind).toLowerCase()} style`,
        description: `Created from ${name || firework.name}.`,
        defaultsJson: JSON.stringify(extractStyleDefaultsFromDesign(previewDesign, kind), null, 2),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCreatedStyleDefaults((current) => ({
        ...current,
        [kind]: [
          result.styleDefault,
          ...(current[kind] ?? []).filter((option) => option.id !== result.styleDefault.id),
        ],
      }));

      const nextStyleDefaultIds = { ...styleDefaultIds, [kind]: result.id };
      const nextOverridesRecord = cloneRecord(overridesRecord);
      removeStyleDefaultOverridesFromRecord(nextOverridesRecord, kind);

      // Select the new preset and clear its inline overrides so the preset drives the preview
      // instead of being shadowed by stale render_overrides_json.
      setStyleDefaultIds(nextStyleDefaultIds);
      setOverridesText(JSON.stringify(nextOverridesRecord, null, 2));

      if (!effectId || !mainColor || !parsedOverrides.ok) {
        setError('Pick a base effect and main colour, then click Save to keep this preset.');
        return;
      }

      const nextSaveMap = toSaveStyleDefaultIds(nextStyleDefaultIds);
      const nextMerged = applyColourToOverrides(nextOverridesRecord, {
        mainColor,
        accentColor,
        accentShare,
        colourMode,
        colourAxis,
        validColourStops,
      });

      const ok = await persistFirework({
        styleDefaultIdsMap: nextSaveMap,
        overrides: nextMerged,
      });
      if (!ok) return;
      setSavedSignature(
        fireworkEditorSignature({
          name,
          description,
          effectId,
          caliber,
          durationSeconds,
          heightMeters,
          primaryColor: mainColor,
          secondaryColor: accentColor,
          colorPalette: palette,
          styleDefaultIds: nextSaveMap,
          renderOverridesJson: nextMerged,
        }),
      );
      toast.success('Style default created and saved');
      router.refresh();
    });
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
      const ok = await persistFirework({
        styleDefaultIdsMap: saveStyleDefaultIds,
        overrides: mergedOverrides,
      });
      if (!ok) return;
      setSavedSignature(currentSignature);
      toast.success('Firework saved');
      router.refresh();
    });
  }

  function revertLocalChanges() {
    setName(firework.name);
    setDescription(firework.description ?? '');
    setEffectId(firework.effectId ?? firework.effectOptions[0]?.id ?? '');
    setStyleDefaultIds(initialStyleDefaultIds(firework));
    setCaliber(firework.caliber ?? '');
    setDurationSeconds(firework.durationSeconds == null ? '' : String(firework.durationSeconds));
    setHeightMeters(firework.heightMeters == null ? '' : String(firework.heightMeters));
    setColourStops(initialColourStops);
    setColourMode(() => {
      const initialMode = initialColourMode(initialOverrides);
      return initialMode === 'solid' && initialColourStops.length > 1 ? 'random' : initialMode;
    });
    setColourAxis(initialColourAxis(initialOverrides));
    nextColourStopIdRef.current = initialColourStops.length;
    setOverridesText(JSON.stringify(firework.renderOverridesJson ?? {}, null, 2));
    setPreviewVersion(null);
    setError(null);
    setSavedSignature(null);
  }

  function restoreVersion(version: AdminEditorVersion) {
    setError(null);
    setRestoringVersionId(version.id);
    startTransition(async () => {
      const result = await restoreFireworkEditorVersion({
        fireworkId: firework.id,
        versionId: version.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
      });
      setRestoringVersionId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLastSavedUpdatedAt(result.updatedAt);
      setPreviewVersion(null);
      setSavedSignature(null);
      toast.success('Version restored');
      router.refresh();
    });
  }

  const effectOptions = firework.effectOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const canAddColor = colourStops.length < MAX_STAR_COLOURS;
  const starColourControls = (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <FieldLabel htmlFor={colourToggleId}>Colour</FieldLabel>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-content-muted)]">
            Use saved star colours for this firework.
          </p>
        </div>
        <Switch
          id={colourToggleId}
          aria-label="Colour"
          checked={colourEnabled}
          onCheckedChange={setColourEnabled}
          disabled={!parsedOverrides.ok}
        />
      </div>
      <div className={['space-y-6', !colourEnabled ? 'opacity-55' : ''].filter(Boolean).join(' ')}>
        <div className="space-y-4">
          <Field>
            <FieldLabel>Pattern</FieldLabel>
            <div
              role="radiogroup"
              aria-label="Star colour pattern"
              className="grid grid-cols-4 gap-1 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] p-1"
            >
              {STAR_COLOUR_MODE_OPTIONS.map((option) => {
                const selected = colourMode === option.value;
                const label =
                  option.value === 'random'
                    ? 'Random'
                    : option.value === 'bands'
                      ? 'Bands'
                      : option.label;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!colourEnabled}
                    onClick={() => updateColourMode(option.value)}
                    className={[
                      'min-h-9 rounded-md px-2 text-sm font-medium transition',
                      selected
                        ? 'bg-[color:var(--color-bg-default)] text-[color:var(--color-content-emphasis)] shadow-xs'
                        : 'text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
          {positionalColourMode ? (
            <Field>
              <FieldLabel>{colourPatternQuestion(colourMode)}</FieldLabel>
              <div
                role="radiogroup"
                aria-label={colourPatternQuestion(colourMode)}
                className="grid grid-cols-2 gap-1 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] p-1"
              >
                {STAR_COLOUR_AXIS_OPTIONS.map((option) => {
                  const selected = colourAxis === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!colourEnabled}
                      onClick={() => updateColourAxis(option.value)}
                      className={[
                        'min-h-9 rounded-md px-2 text-sm font-medium transition',
                        selected
                          ? 'bg-[color:var(--color-bg-default)] text-[color:var(--color-content-emphasis)] shadow-xs'
                          : 'text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : null}
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
                    <CompactColourInput
                      value={stop.hex}
                      disabled={!colourEnabled}
                      onChange={(hex) => updateColourStopHex(stop.id, hex)}
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
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={addColor}
          className="w-fit"
          disabled={!canAddColor || !colourEnabled}
        >
          <Plus size={16} />
          Add colour
        </Button>

        {colourMode === 'random' && colourStops.length === 2 ? (
          <div className="border-t border-[color:var(--color-border-subtle)] pt-5">
            <SliderField
              label="Accent share"
              min={1}
              max={95}
              step={1}
              value={Math.round(colourStops[1]?.share ?? 0)}
              formatValue={(value) => `${value}%`}
              disabled={!colourEnabled}
              onChange={(value) => {
                const accent = colourStops[1];
                if (accent) updateColourStopShare(accent.id, value);
              }}
            />
          </div>
        ) : null}

        {colourMode === 'random' && colourStops.length > 2 ? (
          <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-5">
            {colourStops.map((stop, index) => (
              <SliderField
                key={stop.id}
                label={
                  index === 1
                    ? 'Accent share'
                    : `${colourStopLabel(colourMode, index, colourStops.length)} share`
                }
                min={1}
                max={95}
                step={1}
                value={Math.round(stop.share)}
                formatValue={(value) => `${value}%`}
                disabled={!colourEnabled || colourStops.length <= 1}
                onChange={(value) => updateColourStopShare(stop.id, value)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  const previewSnapshot = previewVersion
    ? parseFireworkEditorSnapshot(previewVersion.snapshotJson)
    : null;
  const previewNotice = previewVersion ? (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--hl)] bg-black/60 p-3 text-sm text-white shadow-lg">
      <div className="min-w-0">
        <p className="font-semibold">Viewing earlier version</p>
        <p className="truncate text-white/68">
          {previewSnapshot?.name ?? previewVersion.summary} by {previewVersion.createdByLabel}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="border-white/15 bg-white/8 text-white hover:bg-white/14 hover:text-white"
        onClick={() => setPreviewVersion(null)}
      >
        Live version
      </Button>
    </div>
  ) : null;
  const preview = (
    <LazyFireworkReplayCanvas
      cues={previewCues}
      elapsed={elapsed}
      playbackRef={playbackRef}
      launchPositions={PREVIEW_LAUNCH_POSITIONS}
      muted={!isPlaying}
      interactive
      controlsVisible={previewReady}
      showStarfield={false}
      showFps
      primeSnapshots
      primeOnCueChanges={false}
      showLoadingBar={false}
      onPrimeProgress={(progress) => {
        setPreviewLoadingProgress(progress);
        if (progress !== null) setPreviewReady(false);
      }}
      onReady={() => {
        setPreviewReady(true);
        setPreviewLoadingProgress(null);
      }}
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
  );
  const transport = (
    <EditorPreviewTransport
      elapsed={elapsed}
      duration={previewDuration}
      isPlaying={isPlaying}
      isLooping={isLooping}
      fullscreen={isFullscreen}
      loading={!previewReady}
      loadingProgress={previewLoadingProgress}
      ticks={previewTicks}
      onPlayPause={() => {
        if (!isPlaying && playbackRef.current >= previewDuration - 0.05) {
          setPreviewTime(PREVIEW_START_SECONDS);
        }
        setIsPlaying((playing) => !playing);
      }}
      onReset={() => {
        setIsPlaying(false);
        setPreviewTime(PREVIEW_START_SECONDS);
      }}
      onLoopToggle={() => setIsLooping((looping) => !looping)}
      onFullscreenToggle={toggleFullscreen}
      onScrub={(seconds) => {
        setIsPlaying(false);
        scrubTo(seconds);
      }}
      onScrubEnd={commitScrub}
    />
  );
  function renderStyleDefaultControls(kind: FireworkStyleDefaultKind) {
    const inherited = selectedEffectStyleDefaults[kind] ?? null;
    return (
      <EditorStyleDefaultControls
        label={`${styleDefaultKindLabel(kind)} style`}
        value={styleDefaultIds[kind]}
        onChange={(value) => handleStyleDefaultChange(kind, value)}
        options={styleDefaultOptions(
          firework.styleDefaults[kind],
          selectedFireworkStyleDefaults[kind] ?? firework.fireworkStyleDefaultLinks[kind] ?? null,
        )}
        inheritedLabel={inherited ? `Effect default: ${inherited.name}` : null}
        disabled={!parsedOverrides.ok}
        saveDisabled={kind === 'star' && !mainColor}
        onSave={() => saveCurrentStyleAsDefault(kind)}
        onReset={() => resetLocalStyleDefaults(kind)}
      />
    );
  }

  const detailsContent = (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="fw-name">Name</FieldLabel>
        <Input id="fw-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Base effect</FieldLabel>
        <SelectField
          value={effectId}
          onChange={handleEffectIdChange}
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
  );
  const tabs: FireworkEditorShellTab[] = [
    {
      id: 'details',
      label: 'Details',
      icon: SlidersHorizontal,
      eyebrow: 'Catalogue',
      title: 'Details',
      content: detailsContent,
    },
    {
      id: 'colour',
      label: 'Colour',
      icon: Palette,
      eyebrow: 'Appearance',
      title: 'Colour',
      content: starColourControls,
    },
    {
      id: 'star',
      label: 'Star',
      icon: Sparkles,
      eyebrow: 'Appearance',
      title: 'Star & glow',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('star', updater)}
            disabled={!parsedOverrides.ok}
            showStarCount
            controlScope="star"
          />
          {renderStyleDefaultControls('star')}
        </div>
      ),
    },
    {
      id: 'star-inner',
      label: 'Star Inner',
      icon: CircleDot,
      eyebrow: 'Appearance',
      title: 'Star Inner',
      content: (
        <FireworkRenderControls
          design={previewDesign}
          defaults={overridesRecord}
          calibrationDefaults={calibrationDefaults}
          mutate={mutateOverrides}
          disabled={!parsedOverrides.ok}
          showStarCount
          controlScope="starInner"
        />
      ),
    },
    {
      id: 'trail',
      label: 'Trail',
      icon: Wind,
      eyebrow: 'Appearance',
      title: 'Trail',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('trail', updater)}
            disabled={!parsedOverrides.ok}
            controlScope="trail"
          />
          {renderStyleDefaultControls('trail')}
        </div>
      ),
    },
    {
      id: 'launch',
      label: 'Launch',
      icon: Rocket,
      eyebrow: 'Ascent',
      title: 'Launch',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('launch', updater)}
            disabled={!parsedOverrides.ok}
            showLaunch
            controlScope="launch"
          />
          {renderStyleDefaultControls('launch')}
        </div>
      ),
    },
    {
      id: 'fx',
      label: 'FX',
      icon: Zap,
      eyebrow: 'Effects',
      title: 'Spark effects',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('strobe', updater)}
            disabled={!parsedOverrides.ok}
            controlScope="strobe"
          />
          {renderStyleDefaultControls('strobe')}
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('crackle', updater)}
            disabled={!parsedOverrides.ok}
            controlScope="crackle"
          />
          {renderStyleDefaultControls('crackle')}
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('split', updater)}
            disabled={!parsedOverrides.ok}
            controlScope="split"
          />
          {renderStyleDefaultControls('split')}
        </div>
      ),
    },
    {
      id: 'smoke',
      label: 'Smoke',
      icon: Cloud,
      eyebrow: 'Atmosphere',
      title: 'Smoke',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('smoke', updater)}
            disabled={!parsedOverrides.ok}
            controlScope="smoke"
          />
          {renderStyleDefaultControls('smoke')}
        </div>
      ),
    },
    {
      id: 'sound',
      label: 'Sound',
      icon: Volume2,
      eyebrow: 'Audio',
      title: 'Sound',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => mutateOverridesForStyle('sound', updater)}
            disabled={!parsedOverrides.ok}
            controlScope="sound"
          />
          {renderStyleDefaultControls('sound')}
        </div>
      ),
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      eyebrow: 'Versions',
      title: 'Version history',
      content: (
        <EditorHistoryPanel
          versions={firework.history}
          selectedVersionId={previewVersion?.id ?? null}
          restoringVersionId={restoringVersionId}
          onPreview={setPreviewVersion}
          onClearPreview={() => setPreviewVersion(null)}
          onRestore={restoreVersion}
        />
      ),
    },
    {
      id: 'json',
      label: 'JSON',
      icon: Braces,
      eyebrow: 'Advanced',
      title: 'Render overrides JSON',
      content: <JsonReadOnlyPanel value={mergedOverrides as Json} />,
    },
  ];

  return (
    <FireworkEditorShell
      title={name || firework.name}
      chips={[{ label: 'Calibre', value: caliber.trim() || firework.caliber, icon: CircleDot }]}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={!parsedOverrides.ok || isPending}
      revertDisabled={!isDirty || isPending}
      onSave={save}
      onRevert={revertLocalChanges}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      tabs={tabs}
      preview={preview}
      transport={transport}
      error={error}
      previewNotice={previewNotice}
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
