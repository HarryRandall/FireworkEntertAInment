'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Braces,
  CircleDot,
  Cloud,
  History,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Volume2,
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
import {
  EditorStyleDefaultControls,
  EditorTrailPanel,
} from '@/app/components/admin/EditorSectionPanels';
import { estimatePreviewTicks } from '@/app/components/admin/editor-preview-timing';
import {
  EditorPreviewTransport,
  FireworkEditorShell,
  type FireworkEditorShellTab,
} from '@/app/components/admin/FireworkEditorShell';
import { useAdminBreadcrumbOverride } from '@/app/components/admin/AdminShell';
import { FireworkRenderControls } from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { Skeleton } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField, type SelectOption } from '@/app/components/ui/SelectField';
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
  type FireworkStarLayer,
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
type BaseEffectFamily = 'aerial_burst' | 'ascending' | 'ground' | 'noise' | 'compound';
type BurstTrail = FireworkStarLayer['burstTrail'];
type LocalStyleDefaultOptions = Partial<
  Record<FireworkStyleDefaultKind, AdminStyleDefaultOption[]>
>;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayCanvasSkeleton />,
  },
);

// Effects are colourless shapes, so the preview uses a neutral cyan.
const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];
const FAMILY_OPTIONS: SelectOption[] = [
  { value: 'aerial_burst', label: 'Aerial burst' },
  { value: 'ascending', label: 'Ascending' },
  { value: 'ground', label: 'Ground' },
  { value: 'noise', label: 'Noise' },
  { value: 'compound', label: 'Compound' },
];

function normaliseFamily(value: string): BaseEffectFamily {
  if (
    value === 'aerial_burst' ||
    value === 'ascending' ||
    value === 'ground' ||
    value === 'noise' ||
    value === 'compound'
  ) {
    return value;
  }
  return 'aerial_burst';
}

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

function ensureRecord(parent: JsonRecord, key: string): JsonRecord {
  if (!isRecord(parent[key])) parent[key] = {};
  return parent[key] as JsonRecord;
}

function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
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

function ReplayCanvasSkeleton() {
  return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#0b1020]" />;
}

export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const router = useRouter();
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? '');
  const [family, setFamily] = useState<BaseEffectFamily>(() => normaliseFamily(effect.family));
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
    () =>
      Object.fromEntries(
        FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => [
          kind,
          styleDefaultIds[kind] === NO_STYLE_DEFAULT_VALUE ? null : styleDefaultIds[kind],
        ]),
      ),
    [styleDefaultIds],
  );
  const sortOrderNumber = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
  const currentSignature = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        family,
        patternKey,
        sortOrder: sortOrderNumber,
        styleDefaultIds: saveStyleDefaultIds,
        modelJson: parsedModel.ok ? baseModel : modelText,
      }),
    [
      baseModel,
      description,
      family,
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
    setFamily(normaliseFamily(effect.family));
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

  function updateModelDefaults(updater: (defaults: JsonRecord) => void) {
    if (!parsedModel.ok) return;
    const draft = cloneRecord(canonicaliseEffectModelJson(parsedModel.value));
    const defaults = ensureRecord(draft, 'renderDefaults');
    updater(defaults);
    setModelText(JSON.stringify(draft, null, 2));
  }

  function resetLocalStyleDefaults(kind: FireworkStyleDefaultKind) {
    updateModelDefaults((defaults) => {
      removeStyleDefaultOverridesFromRecord(defaults, kind);
    });
  }

  function saveCurrentStyleAsDefault(kind: FireworkStyleDefaultKind) {
    setError(null);
    startTransition(async () => {
      const result = await createStyleDefault({
        kind,
        name: `${effect.name} ${styleDefaultKindLabel(kind).toLowerCase()} style`,
        description: `Created from ${effect.name}.`,
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
      setStyleDefaultIds((current) => ({ ...current, [kind]: result.id }));
      toast.success('Style default created and selected');
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
      const result = await updateEffect({
        id: effect.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description,
        family,
        patternKey,
        sortOrder: sortOrderNumber,
        starStyleDefaultId:
          styleDefaultIds.star === NO_STYLE_DEFAULT_VALUE ? null : styleDefaultIds.star,
        trailStyleDefaultId:
          styleDefaultIds.trail === NO_STYLE_DEFAULT_VALUE ? null : styleDefaultIds.trail,
        styleDefaultIds: saveStyleDefaultIds,
        modelJson: canonicalModelText,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setLastSavedUpdatedAt(result.updatedAt);
      setModelText(canonicalModelText);
      setSavedSignature(currentSignature);
      toast.success('Effect saved');
      router.refresh();
    });
  }

  function revertLocalChanges() {
    setName(effect.name);
    setDescription(effect.description ?? '');
    setFamily(normaliseFamily(effect.family));
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

  function updateBurstTrail(updater: (trail: BurstTrail) => BurstTrail, custom = true) {
    const next = updater(JSON.parse(JSON.stringify(previewDesign.burstTrail)) as BurstTrail);
    updateModelDefaults((defaults) => {
      defaults.burstTrail = custom ? { ...next, preset: 'custom' } : next;
    });
  }

  function setBurstTrail(next: BurstTrail, custom = true) {
    updateBurstTrail(() => next, custom);
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
  );
  const transport = (
    <EditorPreviewTransport
      elapsed={elapsed}
      duration={previewDuration}
      isPlaying={isPlaying}
      isLooping={isLooping}
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
      onScrub={(seconds) => {
        setIsPlaying(false);
        setPreviewTime(seconds);
      }}
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
          <FieldLabel>Family</FieldLabel>
          <SelectField
            value={family}
            onChange={(value) => setFamily(normaliseFamily(value))}
            options={FAMILY_OPTIONS}
            ariaLabel="Effect family"
          />
        </Field>
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
        onChange={(value) => setStyleDefaultIds((current) => ({ ...current, [kind]: value }))}
        options={styleDefaultOptions(
          effect.styleDefaults[kind],
          selectedStyleDefaults[kind] ?? effect.styleDefaultLinks[kind] ?? null,
        )}
        disabled={!parsedModel.ok}
        onSave={() => saveCurrentStyleAsDefault(kind)}
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
      description: 'Name, effect family and renderer key for this base effect.',
      content: detailsContent,
    },
    {
      id: 'star',
      label: 'Star',
      icon: Sparkles,
      eyebrow: 'Appearance',
      title: 'Star & glow',
      description: 'Size, life and the glow around each burning star.',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
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
      description: 'The smaller core burst inside the main star break.',
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
      description: 'The brocade streaks that hang behind each star.',
      content: (
        <div className="space-y-5">
          <EditorTrailPanel
            trail={previewDesign.burstTrail}
            disabled={!parsedModel.ok}
            onChange={setBurstTrail}
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
      description: 'How the shell rises before it bursts.',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
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
      description: 'Optional strobe, crackle and split-shell effects.',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
            controlScope="strobe"
          />
          {renderStyleDefaultControls('strobe')}
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
            controlScope="crackle"
          />
          {renderStyleDefaultControls('crackle')}
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
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
      description: 'Launch smoke that lingers after the lift.',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
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
      description: 'The report heard on launch and at the burst.',
      content: (
        <div className="space-y-5">
          <FireworkRenderControls
            design={previewDesign}
            defaults={renderDefaults}
            calibrationDefaults={calibrationDefaults}
            mutate={updateModelDefaults}
            disabled={!parsedModel.ok}
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
      content: (
        <JsonReadOnlyPanel
          label="Read-only v1 view of the canonical firework_effects.model_json payload."
          value={baseModel as Json}
        />
      ),
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
      error={error}
      previewNotice={previewNotice}
    />
  );
}
