'use client';
import { validateCatalogueRender } from '@/lib/admin/renderer-validation';
import { rendererTabs } from '@/ui/firework-editor/renderer-tabs';
import { applyCopiedPreset, resetCopiedPreset } from '@showcrafter/firework-editor/presets';

import { useDraftHistory } from '@showcrafter/firework-editor/use-draft-history';

import {
  createStyleDefaultAndUpdateEffect,
  restoreEffectEditorVersion,
  updateEffect,
} from '@/app/(admin)/admin/effects/actions';
import type {
  AdminEditorVersion,
  AdminEffectDetail,
  AdminStyleDefaultOption,
} from '@/lib/admin.types';
import { canApplySavedEditorSnapshot } from '@/lib/admin/editor-save-state';
import { parseEffectEditorSnapshot } from '@/lib/admin/editor-snapshots';
import type { Json } from '@/lib/database.types';
import type { ReplayCue } from '@/lib/show-domain';
import {
  PREVIEW_LAUNCH_POSITIONS,
  estimatePreviewTicks,
} from '@/ui/firework-editor/editor-preview-timing';
import { EditorHistoryPanel, JsonReadOnlyPanel } from '@/ui/firework-editor/EditorInspectorPanels';
import { EditorStyleDefaultControls } from '@/ui/firework-editor/EditorSectionPanels';
import {
  EditorPreviewTransport,
  FireworkEditorShell,
  type FireworkEditorShellTab,
} from '@/ui/firework-editor/FireworkEditorShell';
import { FireworkTimelineControls } from '@/ui/firework-editor/FireworkTimelineControls';
import { usePreviewFullscreen } from '@/ui/firework-editor/previewFullscreen';
import {
  makeOptimisticEditorVersion,
  useEditorHistory,
} from '@/ui/firework-editor/useEditorHistory';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';
import type { SelectOption } from '@/ui/patterns/SelectField';
import { toast } from '@/ui/patterns/toast';
import { ReplayStageBackdrop } from '@/ui/replay/ReplayStageBackdrop';
import { useAdminBreadcrumbOverride } from '@/ui/shell/AdminShell';
import {
  DEFAULT_DESIGN,
  canonicaliseEffectModelJson,
  estimateDesignDurationSeconds,
  validateFireworkDesign,
} from '@showcrafter/fireworks/design';
import { DEFAULT_FIREWORK_SPEC } from '@showcrafter/fireworks/spec';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  NO_STYLE_DEFAULT_VALUE,
  emptyStyleDefaultIdMap,
  extractStyleDefaultsFromDesign,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@showcrafter/fireworks/style-defaults';
import { isGroundFireworkEffect } from '@showcrafter/fireworks/timing';
import { Braces, GanttChartSquare, History, SlidersHorizontal } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';

type ParsedJson = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type JsonRecord = Record<string, unknown>;
type LocalStyleDefaultOptions = Partial<
  Record<FireworkStyleDefaultKind, AdminStyleDefaultOption[]>
>;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/ui/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
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

type EffectEditorSavedSnapshot = {
  id: string;
  updatedAt: string;
  name: string;
  description: string;
  patternKey: string;
  sortOrder: string;
  modelText: string;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
  signature: string;
};

type EffectEditorSnapshotFields = {
  id: string;
  updatedAt: string;
  name: string;
  description: string | null;
  patternKey: string;
  sortOrder: number;
  modelJson: unknown;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
};

type UpdateEffectSuccess = Extract<Awaited<ReturnType<typeof updateEffect>>, { ok: true }>;

function effectSavedSnapshotFromFields(
  fields: EffectEditorSnapshotFields,
): EffectEditorSavedSnapshot {
  const modelJson = canonicaliseEffectModelJson(fields.modelJson);
  const sortOrder = String(fields.sortOrder);
  return {
    id: fields.id,
    updatedAt: fields.updatedAt,
    name: fields.name,
    description: fields.description ?? '',
    patternKey: fields.patternKey,
    sortOrder,
    modelText: JSON.stringify(
      validateCatalogueRender({ kind: 'effect', recordId: fields.id, settings: fields.modelJson })
        .ok
        ? modelJson
        : fields.modelJson,
      null,
      2,
    ),
    styleDefaultIds: fields.styleDefaultIds,
    signature: effectEditorSignature({
      name: fields.name,
      description: fields.description ?? '',
      patternKey: fields.patternKey,
      sortOrder: fields.sortOrder,
      styleDefaultIds: toSaveStyleDefaultIds(fields.styleDefaultIds),
      modelJson,
    }),
  };
}

function effectSavedSnapshotFromDetail(effect: AdminEffectDetail): EffectEditorSavedSnapshot {
  return effectSavedSnapshotFromFields({
    id: effect.id,
    updatedAt: effect.updatedAt,
    name: effect.name,
    description: effect.description,
    patternKey: effect.patternKey,
    sortOrder: effect.sortOrder,
    modelJson: effect.modelJson,
    styleDefaultIds: initialStyleDefaultIds(effect),
  });
}

function isEarlierUpdatedAt(candidate: string, reference: string): boolean {
  const candidateTime = Date.parse(candidate);
  const referenceTime = Date.parse(reference);
  return (
    Number.isFinite(candidateTime) &&
    Number.isFinite(referenceTime) &&
    candidateTime < referenceTime
  );
}

export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [isPending, startTransition] = useTransition();
  const incomingSavedSnapshot = useMemo(() => effectSavedSnapshotFromDetail(effect), [effect]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoadingProgress, setPreviewLoadingProgress] = useState<number | null>(null);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? '');
  const [patternKey, setPatternKey] = useState(effect.patternKey);
  const [sortOrder, setSortOrder] = useState(String(effect.sortOrder));
  const [modelText, setModelText] = useState(() => incomingSavedSnapshot.modelText);
  const [styleDefaultIds, setStyleDefaultIds] = useState(() => initialStyleDefaultIds(effect));
  const [createdStyleDefaults, setCreatedStyleDefaults] = useState<LocalStyleDefaultOptions>({});
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [savedSignature, setSavedSignature] = useState(() => incomingSavedSnapshot.signature);
  const savedSnapshotRef = useRef<EffectEditorSavedSnapshot>(incomingSavedSnapshot);
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState(incomingSavedSnapshot);
  const savedSignatureRef = useRef(savedSignature);
  const editorTargetIdRef = useRef(effect.id);
  const [activeTab, setActiveTab] = useState('details');
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const editorHistory = useEditorHistory({ targetKey: effect.id, initialVersions: effect.history });
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
  function copySelectedStyleDefaultsIntoModel(source: JsonRecord): JsonRecord {
    return cloneRecord(canonicaliseEffectModelJson(source));
  }

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
  const currentSignatureRef = useRef(currentSignature);
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useLayoutEffect(() => {
    currentSignatureRef.current = currentSignature;
    savedSignatureRef.current = savedSignature;
    editorTargetIdRef.current = effect.id;
  }, [currentSignature, effect.id, savedSignature]);

  useEffect(() => {
    const incomingSnapshot = incomingSavedSnapshot;
    const savedSnapshot = savedSnapshotRef.current;
    const sameEffect = incomingSnapshot.id === savedSnapshot.id;
    if (sameEffect && incomingSnapshot.updatedAt === savedSnapshot.updatedAt) return;
    if (sameEffect && isEarlierUpdatedAt(incomingSnapshot.updatedAt, savedSnapshot.updatedAt))
      return;
    if (sameEffect && currentSignatureRef.current !== savedSignatureRef.current) return;

    savedSnapshotRef.current = incomingSnapshot;
    setSavedPreviewSnapshot(incomingSnapshot);
    savedSignatureRef.current = incomingSnapshot.signature;
    setName(incomingSnapshot.name);
    setDescription(incomingSnapshot.description);
    setPatternKey(incomingSnapshot.patternKey);
    setSortOrder(incomingSnapshot.sortOrder);
    setModelText(incomingSnapshot.modelText);
    setStyleDefaultIds({ ...incomingSnapshot.styleDefaultIds });
    setCreatedStyleDefaults({});
    setLastSavedUpdatedAt(incomingSnapshot.updatedAt);
    setRestoringVersionId(null);
    setSavedSignature(incomingSnapshot.signature);
  }, [incomingSavedSnapshot]);

  const modelHasColour = hasConcreteRendererColor(baseModel);

  useEffect(() => {
    setAdminBreadcrumb({ label: name || effect.name });
    return () => setAdminBreadcrumb(null);
  }, [effect.name, name, setAdminBreadcrumb]);
  const renderResult = useMemo(() => {
    const source = validateCatalogueRender({
      kind: 'effect',
      recordId: effect.id,
      settings: parsedModel.ok ? parsedModel.value : null,
    });
    return source.ok
      ? validateFireworkDesign({ baseModel, primaryColor: modelHasColour ? null : PREVIEW_COLOR })
      : source;
  }, [effect.id, parsedModel, baseModel, modelHasColour]);

  // Invalid settings remain editable, but never become preview particles.
  const previewDesign = renderResult.ok ? renderResult.design : DEFAULT_DESIGN;
  const renderError = !parsedModel.ok
    ? parsedModel.error
    : !renderResult.ok
      ? renderResult.diagnostics
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      : null;

  const [showSaved, setShowSaved] = useState(false);
  const savedRenderResult = useMemo(() => {
    const model = JSON.parse(savedPreviewSnapshot.modelText);
    const source = validateCatalogueRender({
      kind: 'effect',
      recordId: effect.id,
      settings: model,
    });
    return source.ok
      ? validateFireworkDesign({
          baseModel: model,
          primaryColor: hasConcreteRendererColor(model) ? null : PREVIEW_COLOR,
        })
      : source;
  }, [effect.id, savedPreviewSnapshot]);
  const displayedDesign =
    showSaved && savedRenderResult.ok ? savedRenderResult.design : previewDesign;

  // Head-orb appearance is saved on the effect's renderDefaults, so the sliders
  // read from the compiled design and write straight back into the model. The
  // canvas preview reflects the saved look, and fireworks built on this effect
  // inherit it as their starting point.
  const heads = displayedDesign.stars.outer.head;
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
    const estimated =
      PREVIEW_CUE_TIME_SECONDS +
      Math.max(
        estimateDesignDurationSeconds(previewDesign),
        savedRenderResult.ok ? estimateDesignDurationSeconds(savedRenderResult.design) : 0,
      );
    return Math.max(4, Math.ceil(estimated * 2) / 2);
  }, [previewDesign, savedRenderResult]);
  const previewTicks = useMemo(
    () =>
      estimatePreviewTicks({
        design: displayedDesign,
        cueTimeSeconds: PREVIEW_CUE_TIME_SECONDS,
        previewDuration,
      }),
    [displayedDesign, previewDuration],
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
  const previewCues = useMemo(() => {
    if (showSaved)
      return savedRenderResult.ok
        ? [
            {
              ...previewCue,
              firework: { ...previewCue.firework, renderDesign: savedRenderResult.design },
            },
          ]
        : [];
    return renderError ? [] : [previewCue];
  }, [previewCue, renderError, showSaved, savedRenderResult]);

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

  function updateModelDefaultsForTimeline(
    kinds: readonly FireworkStyleDefaultKind[],
    updater: (defaults: JsonRecord) => void,
  ) {
    if (!parsedModel.ok) return;
    const draft = cloneRecord(canonicaliseEffectModelJson(parsedModel.value));
    const defaults = ensureRecord(draft, 'renderDefaults');
    const customKinds = kinds.filter((kind) => materialiseStyleDefault(kind, defaults));
    updater(defaults);
    setModelText(JSON.stringify(draft, null, 2));
    if (customKinds.length > 0) {
      setStyleDefaultIds((current) => {
        const next = { ...current };
        for (const kind of customKinds) next[kind] = NO_STYLE_DEFAULT_VALUE;
        return next;
      });
    }
  }

  function resetLocalStyleDefaults(kind: FireworkStyleDefaultKind) {
    updateModelDefaults((defaults) => {
      resetCopiedPreset(defaults, kind);
    });
  }

  function handleStyleDefaultChange(kind: FireworkStyleDefaultKind, value: string) {
    const option = [...effect.styleDefaults[kind], ...(createdStyleDefaults[kind] ?? [])].find(
      (item) => item.id === value,
    );
    if (option) {
      const checked = validateFireworkDesign({ variantOverrides: option.defaultsJson });
      if (!checked.ok) {
        setError(checked.diagnostics.map((issue) => issue.message).join('; '));
        return;
      }
      updateModelDefaults((defaults) => applyCopiedPreset(defaults, kind, option));
    }
    setError(null);
    setStyleDefaultIds((current) => ({ ...current, [kind]: value }));
  }

  async function persistEffect(args: {
    targetId: string;
    styleDefaultIdsMap: Record<FireworkStyleDefaultKind, string | null>;
    modelJson: string;
    historyVersionId: string;
  }): Promise<UpdateEffectSuccess | null> {
    let result: Awaited<ReturnType<typeof updateEffect>>;
    try {
      result = await updateEffect({
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
        historyVersionId: args.historyVersionId,
      });
    } catch {
      if (editorTargetIdRef.current === args.targetId) {
        setError('Could not save the effect. Try again.');
      }
      return null;
    }
    if (editorTargetIdRef.current !== args.targetId) return null;
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setLastSavedUpdatedAt(result.saved.updatedAt);
    return result;
  }

  function currentLocalSnapshot(): EffectEditorSavedSnapshot {
    return {
      id: effect.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      patternKey,
      sortOrder,
      modelText,
      styleDefaultIds: { ...styleDefaultIds },
      signature: currentSignature,
    };
  }

  function applySnapshot(snapshot: EffectEditorSavedSnapshot) {
    setName(snapshot.name);
    setDescription(snapshot.description);
    setPatternKey(snapshot.patternKey);
    setSortOrder(snapshot.sortOrder);
    setStyleDefaultIds({ ...snapshot.styleDefaultIds });
    setModelText(snapshot.modelText);
  }

  function beginOptimisticMutation(
    optimisticSnapshot: EffectEditorSavedSnapshot,
    action: 'update' | 'restore',
  ) {
    const historyVersionId = crypto.randomUUID();
    const localSnapshot = currentLocalSnapshot();
    currentSignatureRef.current = optimisticSnapshot.signature;
    applySnapshot(optimisticSnapshot);
    editorHistory.begin(
      makeOptimisticEditorVersion({
        id: historyVersionId,
        targetKind: 'effect',
        targetId: effect.id,
        action,
      }),
    );
    return {
      targetId: effect.id,
      historyVersionId,
      localSnapshot,
      optimisticSnapshot,
    };
  }

  function rollbackOptimisticMutation(mutation: ReturnType<typeof beginOptimisticMutation>) {
    if (editorTargetIdRef.current !== mutation.targetId) return;
    editorHistory.discard(mutation.historyVersionId);
    if (currentSignatureRef.current === mutation.optimisticSnapshot.signature) {
      currentSignatureRef.current = mutation.localSnapshot.signature;
      applySnapshot(mutation.localSnapshot);
    }
  }

  function saveCurrentStyleAsDefault(kind: FireworkStyleDefaultKind, styleName: string) {
    if (isPending) return;
    setError(null);
    if (renderError || !parsedModel.ok) {
      setError(renderError ?? (!parsedModel.ok ? parsedModel.error : null));
      return;
    }
    const savedModel = copySelectedStyleDefaultsIntoModel(parsedModel.value);
    const savedModelText = JSON.stringify(savedModel, null, 2);
    const clearedStyleDefaultIds = emptyStyleDefaultIdMap();
    const clearedSaveMap = toSaveStyleDefaultIds(clearedStyleDefaultIds);
    const optimisticSnapshot = effectSavedSnapshotFromFields({
      id: effect.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      patternKey,
      sortOrder: sortOrderNumber,
      modelJson: savedModel,
      styleDefaultIds: clearedStyleDefaultIds,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'update');
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createStyleDefaultAndUpdateEffect>>;
      try {
        result = await createStyleDefaultAndUpdateEffect({
          effect: {
            id: effect.id,
            expectedUpdatedAt: lastSavedUpdatedAt,
            name,
            description,
            patternKey,
            sortOrder: sortOrderNumber,
            styleDefaultIds: clearedSaveMap,
            modelJson: savedModelText,
            historyVersionId: mutation.historyVersionId,
          },
          styleDefault: {
            kind,
            name: styleName,
            description: '',
            defaultsJson: JSON.stringify(
              extractStyleDefaultsFromDesign(previewDesign, kind),
              null,
              2,
            ),
          },
        });
      } catch {
        rollbackOptimisticMutation(mutation);
        if (editorTargetIdRef.current === mutation.targetId) {
          setError('Could not create the style default. Try again.');
        }
        return;
      }

      if (editorTargetIdRef.current !== mutation.targetId) return;

      if (!result.ok) {
        rollbackOptimisticMutation(mutation);
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
      setLastSavedUpdatedAt(result.saved.updatedAt);
      const applySavedSnapshot = canApplySavedEditorSnapshot(
        mutation.optimisticSnapshot.signature,
        currentSignatureRef.current,
      );
      const savedSnapshot = effectSavedSnapshotFromFields({
        ...result.saved,
        styleDefaultIds: clearedStyleDefaultIds,
      });
      savedSnapshotRef.current = savedSnapshot;
      setSavedPreviewSnapshot(savedSnapshot);
      savedSignatureRef.current = savedSnapshot.signature;
      setSavedSignature(savedSnapshot.signature);
      editorHistory.settle({
        optimisticId: mutation.historyVersionId,
        persistedVersion: result.historyVersion,
        recorded: result.historyRecorded,
      });
      if (applySavedSnapshot) {
        currentSignatureRef.current = savedSnapshot.signature;
        applySnapshot(savedSnapshot);
        toast.success('Style default created and saved');
      } else {
        toast.success('Saved; newer effect edits remain unsaved');
      }
    });
  }

  function saveEffect() {
    if (isPending) return;
    setError(null);
    if (renderError || !parsedModel.ok) {
      setError(renderError ?? (!parsedModel.ok ? parsedModel.error : null));
      return;
    }
    const savedModel = copySelectedStyleDefaultsIntoModel(parsedModel.value);
    const savedModelText = JSON.stringify(savedModel, null, 2);
    const clearedStyleDefaultIds = emptyStyleDefaultIdMap();
    const clearedSaveMap = toSaveStyleDefaultIds(clearedStyleDefaultIds);
    const optimisticSnapshot = effectSavedSnapshotFromFields({
      id: effect.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      patternKey,
      sortOrder: sortOrderNumber,
      modelJson: savedModel,
      styleDefaultIds: clearedStyleDefaultIds,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'update');
    startTransition(async () => {
      const persisted = await persistEffect({
        targetId: mutation.targetId,
        styleDefaultIdsMap: clearedSaveMap,
        modelJson: savedModelText,
        historyVersionId: mutation.historyVersionId,
      });
      if (!persisted) {
        rollbackOptimisticMutation(mutation);
        return;
      }
      const applySavedSnapshot = canApplySavedEditorSnapshot(
        mutation.optimisticSnapshot.signature,
        currentSignatureRef.current,
      );
      const savedSnapshot = effectSavedSnapshotFromFields({
        ...persisted.saved,
        styleDefaultIds: clearedStyleDefaultIds,
      });
      savedSnapshotRef.current = savedSnapshot;
      setSavedPreviewSnapshot(savedSnapshot);
      savedSignatureRef.current = savedSnapshot.signature;
      setSavedSignature(savedSnapshot.signature);
      editorHistory.settle({
        optimisticId: mutation.historyVersionId,
        persistedVersion: persisted.historyVersion,
        recorded: persisted.historyRecorded,
      });
      if (applySavedSnapshot) {
        currentSignatureRef.current = savedSnapshot.signature;
        applySnapshot(savedSnapshot);
        toast.success('Effect saved');
      } else {
        toast.success('Effect saved; newer edits remain unsaved');
      }
    });
  }

  function revertLocalChanges() {
    const savedSnapshot = savedSnapshotRef.current;
    applySnapshot(savedSnapshot);
    setLastSavedUpdatedAt(savedSnapshot.updatedAt);
    setError(null);
    savedSignatureRef.current = savedSnapshot.signature;
    setSavedSignature(savedSnapshot.signature);
  }

  function restoreVersion(version: AdminEditorVersion) {
    if (isPending) return;
    setError(null);
    const snapshot = parseEffectEditorSnapshot(version.snapshotJson);
    if (!snapshot || snapshot.id !== effect.id) {
      setError('That version cannot be restored.');
      return;
    }
    const optimisticSnapshot = effectSavedSnapshotFromFields({
      id: snapshot.id,
      updatedAt: lastSavedUpdatedAt,
      name: snapshot.name,
      description: snapshot.description,
      patternKey: snapshot.patternKey,
      sortOrder: snapshot.sortOrder,
      modelJson: snapshot.modelJson,
      styleDefaultIds: emptyStyleDefaultIdMap(),
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'restore');
    setRestoringVersionId(version.id);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreEffectEditorVersion>>;
      try {
        result = await restoreEffectEditorVersion({
          effectId: effect.id,
          versionId: version.id,
          expectedUpdatedAt: lastSavedUpdatedAt,
          historyVersionId: mutation.historyVersionId,
        });
      } catch {
        rollbackOptimisticMutation(mutation);
        if (editorTargetIdRef.current === mutation.targetId) {
          setRestoringVersionId(null);
          setError('Could not restore that version. Try again.');
        }
        return;
      }
      if (editorTargetIdRef.current !== mutation.targetId) return;
      setRestoringVersionId(null);
      if (!result.ok) {
        rollbackOptimisticMutation(mutation);
        setError(result.error);
        return;
      }
      const restoredSnapshot = effectSavedSnapshotFromFields({
        ...result.saved,
        styleDefaultIds: emptyStyleDefaultIdMap(),
      });
      const applyRestoredSnapshot = canApplySavedEditorSnapshot(
        mutation.optimisticSnapshot.signature,
        currentSignatureRef.current,
      );
      savedSnapshotRef.current = restoredSnapshot;
      setSavedPreviewSnapshot(restoredSnapshot);
      savedSignatureRef.current = restoredSnapshot.signature;
      setLastSavedUpdatedAt(restoredSnapshot.updatedAt);
      setSavedSignature(restoredSnapshot.signature);
      editorHistory.settle({
        optimisticId: mutation.historyVersionId,
        persistedVersion: result.historyVersion,
        recorded: result.historyRecorded,
      });
      if (applyRestoredSnapshot) {
        currentSignatureRef.current = restoredSnapshot.signature;
        applySnapshot(restoredSnapshot);
        toast.success('Version restored');
      } else {
        toast.success('Version restored; newer effect edits remain unsaved');
      }
    });
  }

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
      showFps={false}
      showCameraControls={false}
      primeSnapshots
      primeOnCueChanges={false}
      showLoadingBar
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
      fullscreen={isFullscreen}
      isLooping={isLooping}
      onLoopToggle={() => setIsLooping((looping) => !looping)}
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
        saveDisabled={isPending}
        onSave={(styleName) => saveCurrentStyleAsDefault(kind, styleName)}
        resetDisabled={
          !isRecord(renderDefaults.presetSources) || !renderDefaults.presetSources[kind]
        }
        onReset={() => resetLocalStyleDefaults(kind)}
      />
    );
  }

  const isGroundEmitter = isGroundFireworkEffect(previewDesign);
  const tabs: FireworkEditorShellTab[] = [
    {
      id: 'details',
      label: 'Details',
      icon: SlidersHorizontal,
      eyebrow: 'Catalogue',
      title: 'Details',
      content: detailsContent,
    },
    ...rendererTabs({
      saved: savedRenderResult.ok ? savedRenderResult.design : undefined,
      controls: {
        design: previewDesign,
        defaults: renderDefaults,

        disabled: !parsedModel.ok,
      },
      mutate: updateModelDefaultsForStyle,
      preset: renderStyleDefaultControls,
    }),
    {
      id: 'timeline',
      label: 'Timeline',
      icon: GanttChartSquare,
      eyebrow: 'Timing',
      title: 'Timeline',
      content: (
        <FireworkTimelineControls
          design={previewDesign}
          disabled={!parsedModel.ok}
          durationLabel="Render duration"
          durationHint="Scale timing stored on this effect. Catalogue firework durations remain independently editable for scheduling safety."
          onMutate={updateModelDefaultsForTimeline}
        />
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
          versions={editorHistory.versions}
          pendingVersionIds={editorHistory.pendingIds}
          warning={editorHistory.warning}
          restoringVersionId={restoringVersionId}
          mutationPending={isPending}
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
  ].filter((tab) => !isGroundEmitter || (tab.id !== 'launch-dot' && tab.id !== 'launch-trail'));

  const draftHistory = useDraftHistory({
    recordKey: effect.id,
    value: currentLocalSnapshot(),
    signature: currentSignature,
    restore: applySnapshot,
  });

  return (
    <FireworkEditorShell
      history={draftHistory}
      comparison={{ saved: showSaved, onChange: setShowSaved }}
      title={name || effect.name}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={Boolean(renderError) || isPending}
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
      renderDiagnostics={{
        recordId: effect.id,
        issues: !parsedModel.ok
          ? [{ path: [], message: parsedModel.error }]
          : !renderResult.ok
            ? renderResult.diagnostics
            : [],
      }}
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
