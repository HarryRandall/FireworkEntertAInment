'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Braces,
  Circle,
  CircleDot,
  Cloud,
  GanttChartSquare,
  History,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { restoreEffectEditorVersion, updateEffect } from '@/app/actions/admin-effects';
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
import { FireworkRenderControls } from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import type { SelectOption } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import type {
  AdminEditorVersion,
  AdminEffectDetail,
  AdminStyleDefaultOption,
} from '@/lib/admin.types';
import { parseEffectEditorSnapshot } from '@/lib/admin/editor-snapshots';
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
import { DEFAULT_FIREWORK_SPEC } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type JsonRecord = Record<string, unknown>;
type LocalStyleDefaultOptions = Partial<
  Record<FireworkStyleDefaultKind, AdminStyleDefaultOption[]>
>;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayStageBackdrop />,
  },
);

// Effects are colourless shapes, so the preview uses a neutral cyan.
const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
// Coalesce heavyweight `elapsed` commits during a timeline drag to ~15Hz so a
// fast scrub does not re-render the whole editor on every input event. The
// engine ref and the transport's local thumb still update at full input rate.
const SCRUB_COMMIT_INTERVAL_MS = 67;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse JSON.',
    };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  if (!isRecord(parent[key])) parent[key] = {};
  return parent[key] as JsonRecord;
}

function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
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

function effectEditorSignature(fields: {
  name: string;
  description: string;
  patternKey: string;
  sortOrder: number;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string | null>;
  modelJson: JsonRecord | string;
}): string {
  return JSON.stringify({
    name: fields.name,
    description: fields.description,
    patternKey: fields.patternKey,
    sortOrder: fields.sortOrder,
    styleDefaultIds: fields.styleDefaultIds,
    modelJson: fields.modelJson,
  });
}

function hasConcreteRendererColor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const renderDefaults = readRecord(value, 'renderDefaults');
  const color = renderDefaults.color ?? value.color;
  return color !== undefined && color !== 'random';
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
  effect: AdminEffectDetail,
): Record<FireworkStyleDefaultKind, string> {
  const ids = emptyStyleDefaultIdMap();
  for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
    ids[kind] = effect.styleDefaultIds[kind] ?? effect.styleDefaultLinks[kind]?.id ?? ids[kind];
  }
  ids.star = effect.starStyleDefaultId ?? ids.star;
  ids.trail = effect.trailStyleDefaultId ?? ids.trail;
  return ids;
}

export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const router = useRouter();
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoadingProgress, setPreviewLoadingProgress] = useState<number | null>(null);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? '');
  const [patternKey, setPatternKey] = useState(effect.patternKey);
  const [sortOrder, setSortOrder] = useState(String(effect.sortOrder));
  const [modelText, setModelText] = useState(() =>
    JSON.stringify(canonicaliseEffectModelJson(effect.modelJson), null, 2),
  );
  const [styleDefaultIds, setStyleDefaultIds] = useState(() => initialStyleDefaultIds(effect));
  const [createdStyleDefaults, setCreatedStyleDefaults] = useState<LocalStyleDefaultOptions>({});
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [previewVersion, setPreviewVersion] = useState<AdminEditorVersion | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);
  const lastScrubCommitRef = useRef(0);
  const pendingScrubRef = useRef<number | null>(null);
  const parsedModel = useMemo(() => parseJsonObject(modelText), [modelText]);
  const baseModel = useMemo(
    () =>
      parsedModel.ok
        ? canonicaliseEffectModelJson(parsedModel.value)
        : canonicaliseEffectModelJson(effect.modelJson),
    [effect.modelJson, parsedModel],
  );
  const calibrationDefaults = useMemo(
    () => readRecord(canonicaliseEffectModelJson(effect.modelJson), 'renderDefaults'),
    [effect.modelJson],
  );
  const modelRecord = parsedModel.ok ? baseModel : {};
  const renderDefaults = readRecord(modelRecord, 'renderDefaults');
  const selectedStyleDefaults = useMemo(() => {
    const selected: Partial<Record<FireworkStyleDefaultKind, AdminStyleDefaultOption | null>> = {};
    for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
      selected[kind] = findStyleDefault(
        styleDefaultIds[kind],
        effect.styleDefaults[kind],
        effect.styleDefaultLinks[kind] ?? null,
        createdStyleDefaults[kind] ?? [],
      );
    }
    return selected;
  }, [createdStyleDefaults, effect.styleDefaultLinks, effect.styleDefaults, styleDefaultIds]);
  const saveStyleDefaultIds = useMemo(
    () => toSaveStyleDefaultIds(styleDefaultIds),
    [styleDefaultIds],
  );
  const sortOrderNumber = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
  const currentSignature = useMemo(
    () =>
      effectEditorSignature({
        name,
        description,
        patternKey,
        sortOrder: sortOrderNumber,
        styleDefaultIds: saveStyleDefaultIds,
        modelJson: parsedModel.ok ? baseModel : modelText,
      }),
    [
      baseModel,
      description,
      modelText,
      name,
      parsedModel.ok,
      patternKey,
      saveStyleDefaultIds,
      sortOrderNumber,
    ],
  );
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useEffect(() => {
    if (savedSignature === null) setSavedSignature(currentSignature);
  }, [currentSignature, savedSignature]);

  useEffect(() => {
    setName(effect.name);
    setDescription(effect.description ?? '');
    setPatternKey(effect.patternKey);
    setSortOrder(String(effect.sortOrder));
    setModelText(JSON.stringify(canonicaliseEffectModelJson(effect.modelJson), null, 2));
    setStyleDefaultIds(initialStyleDefaultIds(effect));
    setCreatedStyleDefaults({});
    setLastSavedUpdatedAt(effect.updatedAt);
    setPreviewVersion(null);
    setRestoringVersionId(null);
    setSavedSignature(null);
  }, [effect]);
  const modelHasColour = hasConcreteRendererColor(baseModel);

  useEffect(() => {
    setAdminBreadcrumb({ label: name || effect.name });
    return () => setAdminBreadcrumb(null);
  }, [effect.name, name, setAdminBreadcrumb]);
  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel,
        effectStyleDefaults: orderedStyleDefaultValues(selectedStyleDefaults).map(
          (item) => item?.defaultsJson,
        ),
        primaryColor: modelHasColour ? null : PREVIEW_COLOR,
      }),
    [baseModel, modelHasColour, selectedStyleDefaults],
  );

  // Head-orb appearance is saved on the effect's renderDefaults, so the sliders
  // read from the compiled design and write straight back into the model. The
  // canvas preview reflects the saved look, and fireworks built on this effect
  // inherit it as their starting point.
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

  const previewCue = useMemo<ReplayCue>(
    () => ({
      id: `${effect.id}-base-preview`,
      position: 1,
      timeSeconds: PREVIEW_CUE_TIME_SECONDS,
      description: description || name,
      productId: effect.id,
      launchPositionIndex: 0,
      firework: {
        id: effect.id,
        slug: effect.slug,
        name,
        description: description || null,
        sortOrder: sortOrderNumber,
        durationSeconds: previewDuration,
        heightMeters: null,
        caliber: null,
        shotCount: 1,
        spec: DEFAULT_FIREWORK_SPEC,
        rawSpec: baseModel,
        renderDesign: previewDesign,
        baseEffect: {
          id: effect.id,
          slug: effect.slug,
          name,
          patternKey,
        },
        variant: null,
      },
    }),
    [
      baseModel,
      description,
      effect.id,
      effect.slug,
      name,
      patternKey,
      previewDesign,
      previewDuration,
      sortOrderNumber,
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
    // Re-anchor the play loop so scrubbing works mid-playback too.
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

  function updateModelDefaults(updater: (defaults: JsonRecord) => void) {
    if (!parsedModel.ok) return;
    const draft = cloneRecord(canonicaliseEffectModelJson(parsedModel.value));
    const defaults = ensureRecord(draft, 'renderDefaults');
    updater(defaults);
    setModelText(JSON.stringify(draft, null, 2));
  }

  function markStyleDefaultCustom(kind: FireworkStyleDefaultKind) {
    setStyleDefaultIds((current) => {
      if (current[kind] === NO_STYLE_DEFAULT_VALUE) return current;
      return { ...current, [kind]: NO_STYLE_DEFAULT_VALUE };
    });
  }

  function materialiseStyleDefault(kind: FireworkStyleDefaultKind, defaults: JsonRecord) {
    if (styleDefaultIds[kind] === NO_STYLE_DEFAULT_VALUE) return false;
    mergeRecordInto(defaults, extractStyleDefaultsFromDesign(previewDesign, kind));
    return true;
  }

  function updateModelDefaultsForStyle(
    kind: FireworkStyleDefaultKind,
    updater: (defaults: JsonRecord) => void,
  ) {
    if (!parsedModel.ok) return;
    const draft = cloneRecord(canonicaliseEffectModelJson(parsedModel.value));
    const defaults = ensureRecord(draft, 'renderDefaults');
    const shouldMarkCustom = materialiseStyleDefault(kind, defaults);
    updater(defaults);
    setModelText(JSON.stringify(draft, null, 2));
    if (shouldMarkCustom) markStyleDefaultCustom(kind);
  }

  function resetLocalStyleDefaults(kind: FireworkStyleDefaultKind) {
    updateModelDefaults((defaults) => {
      removeStyleDefaultOverridesFromRecord(defaults, kind);
    });
  }

  function handleStyleDefaultChange(kind: FireworkStyleDefaultKind, value: string) {
    if (value !== NO_STYLE_DEFAULT_VALUE) {
      updateModelDefaults((defaults) => {
        removeStyleDefaultOverridesFromRecord(defaults, kind);
      });
    }
    setStyleDefaultIds((current) => ({ ...current, [kind]: value }));
  }

  async function persistEffect(args: {
    styleDefaultIdsMap: Record<FireworkStyleDefaultKind, string | null>;
    modelJson: string;
  }): Promise<boolean> {
    const result = await updateEffect({
      id: effect.id,
      expectedUpdatedAt: lastSavedUpdatedAt,
      name,
      description,
      patternKey,
      sortOrder: sortOrderNumber,
      starStyleDefaultId: args.styleDefaultIdsMap.star ?? null,
      trailStyleDefaultId: args.styleDefaultIdsMap.trail ?? null,
      styleDefaultIds: args.styleDefaultIdsMap,
      modelJson: args.modelJson,
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setLastSavedUpdatedAt(result.updatedAt);
    return true;
  }

  function saveCurrentStyleAsDefault(kind: FireworkStyleDefaultKind, name: string) {
    setError(null);
    if (!parsedModel.ok) {
      setError(parsedModel.error);
      return;
    }
    startTransition(async () => {
      const result = await createStyleDefault({
        kind,
        name,
        description: '',
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
      const nextModel = cloneRecord(canonicaliseEffectModelJson(parsedModel.value));
      const nextRenderDefaults = ensureRecord(nextModel, 'renderDefaults');
      removeStyleDefaultOverridesFromRecord(nextRenderDefaults, kind);
      const nextModelText = JSON.stringify(nextModel, null, 2);

      // Select the new preset and clear its inline overrides so the preset drives the preview
      // instead of being shadowed by stale renderDefaults.
      setStyleDefaultIds(nextStyleDefaultIds);
      setModelText(nextModelText);

      const nextSaveMap = toSaveStyleDefaultIds(nextStyleDefaultIds);
      const ok = await persistEffect({
        styleDefaultIdsMap: nextSaveMap,
        modelJson: nextModelText,
      });
      if (!ok) return;
      setSavedSignature(
        effectEditorSignature({
          name,
          description,
          patternKey,
          sortOrder: sortOrderNumber,
          styleDefaultIds: nextSaveMap,
          modelJson: nextModel,
        }),
      );
      toast.success('Style default created and saved');
      router.refresh();
    });
  }

  function saveEffect() {
    setError(null);
    if (!parsedModel.ok) {
      setError(parsedModel.error);
      return;
    }
    const canonicalModelText = JSON.stringify(
      canonicaliseEffectModelJson(parsedModel.value),
      null,
      2,
    );

    startTransition(async () => {
      const ok = await persistEffect({
        styleDefaultIdsMap: saveStyleDefaultIds,
        modelJson: canonicalModelText,
      });
      if (!ok) return;
      setModelText(canonicalModelText);
      setSavedSignature(currentSignature);
      toast.success('Effect saved');
      router.refresh();
    });
  }

  function revertLocalChanges() {
    setName(effect.name);
    setDescription(effect.description ?? '');
    setPatternKey(effect.patternKey);
    setSortOrder(String(effect.sortOrder));
    setModelText(JSON.stringify(canonicaliseEffectModelJson(effect.modelJson), null, 2));
    setStyleDefaultIds(initialStyleDefaultIds(effect));
    setPreviewVersion(null);
    setError(null);
    setSavedSignature(null);
  }

  function restoreVersion(version: AdminEditorVersion) {
    setError(null);
    setRestoringVersionId(version.id);
    startTransition(async () => {
      const result = await restoreEffectEditorVersion({
        effectId: effect.id,
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

  const previewSnapshot = previewVersion
    ? parseEffectEditorSnapshot(previewVersion.snapshotJson)
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
      controlsVisible
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
  const detailsContent = (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="fx-name">Name</FieldLabel>
        <Input id="fx-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="fx-description">Description</FieldLabel>
        <Textarea
          id="fx-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fx-pattern">Pattern key</FieldLabel>
          <Input
            id="fx-pattern"
            value={patternKey}
            onChange={(event) => setPatternKey(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="fx-sort">Sort order</FieldLabel>
          <Input
            id="fx-sort"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
  function renderStyleDefaultControls(kind: FireworkStyleDefaultKind) {
    return (
      <EditorStyleDefaultControls
        label={`${styleDefaultKindLabel(kind)} style`}
        value={styleDefaultIds[kind]}
        onChange={(value) => handleStyleDefaultChange(kind, value)}
        options={styleDefaultOptions(
          effect.styleDefaults[kind],
          selectedStyleDefaults[kind] ?? effect.styleDefaultLinks[kind] ?? null,
        )}
        disabled={!parsedModel.ok}
        onSave={(styleName) => saveCurrentStyleAsDefault(kind, styleName)}
        onReset={() => resetLocalStyleDefaults(kind)}
      />
    );
  }

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
      id: 'launch-dot',
      label: 'Launch Dot',
      icon: Circle,
      eyebrow: 'Ascent',
      title: 'Launch dot',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('launch', updater)}
            disabled={!parsedModel.ok}
            showLaunch
            controlScope="launchShell"
          />
          {renderStyleDefaultControls('launch')}
        </div>
      ),
    },
    {
      id: 'launch-trail',
      label: 'Launch Trail',
      icon: Waves,
      eyebrow: 'Ascent',
      title: 'Launch trail',
      content: (
        <FireworkRenderControls
          design={previewDesign}
          defaults={renderDefaults}
          calibrationDefaults={calibrationDefaults}
          mutate={(updater) => updateModelDefaultsForStyle('launch', updater)}
          disabled={!parsedModel.ok}
          showLaunch
          controlScope="launchTrail"
        />
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
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('smoke', updater)}
            disabled={!parsedModel.ok}
            controlScope="smoke"
          />
          {renderStyleDefaultControls('smoke')}
        </div>
      ),
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
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('star', updater)}
            disabled={!parsedModel.ok}
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
          defaults={renderDefaults}
          calibrationDefaults={calibrationDefaults}
          mutate={updateModelDefaults}
          disabled={!parsedModel.ok}
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
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('trail', updater)}
            disabled={!parsedModel.ok}
            controlScope="trail"
          />
          {renderStyleDefaultControls('trail')}
        </div>
      ),
    },
    {
      id: 'fx-strobe',
      label: 'Strobe',
      icon: Zap,
      eyebrow: 'Effects',
      title: 'Strobe',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('strobe', updater)}
            disabled={!parsedModel.ok}
            controlScope="strobe"
          />
          {renderStyleDefaultControls('strobe')}
        </div>
      ),
    },
    {
      id: 'fx-crackle',
      label: 'Crackle',
      icon: Zap,
      eyebrow: 'Effects',
      title: 'Crackle',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('crackle', updater)}
            disabled={!parsedModel.ok}
            controlScope="crackle"
          />
          {renderStyleDefaultControls('crackle')}
        </div>
      ),
    },
    {
      id: 'fx-split',
      label: 'Split',
      icon: Zap,
      eyebrow: 'Effects',
      title: 'Split',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('split', updater)}
            disabled={!parsedModel.ok}
            controlScope="split"
          />
          {previewDesign.split.enabled ? renderStyleDefaultControls('split') : null}
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
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={(updater) => updateModelDefaultsForStyle('sound', updater)}
            disabled={!parsedModel.ok}
            controlScope="sound"
          />
          {renderStyleDefaultControls('sound')}
        </div>
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: GanttChartSquare,
      eyebrow: 'Timing',
      title: 'Timeline',
      content: (
        <InlineAlert tone="info" title="Coming soon">
          A master timeline for extending individual sections and the overall firework length will
          live here.
        </InlineAlert>
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
          versions={effect.history}
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
      title: 'Canonical model JSON',
      content: <JsonReadOnlyPanel value={baseModel as Json} />,
    },
  ];

  return (
    <FireworkEditorShell
      title={name || effect.name}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={!parsedModel.ok || isPending}
      revertDisabled={!isDirty || isPending}
      onSave={saveEffect}
      onRevert={revertLocalChanges}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      tabs={tabs}
      preview={preview}
      transport={transport}
      transportPlaying={isPlaying}
      error={error}
      previewNotice={previewNotice}
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
