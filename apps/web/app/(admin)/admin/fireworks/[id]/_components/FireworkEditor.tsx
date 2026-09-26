'use client';
import { validateCatalogueRender } from '@/lib/admin/renderer-validation';
import { fireworkColourMetadata } from '@showcrafter/firework-editor/colour-metadata';
import { rendererTabs } from '@/ui/firework-editor/renderer-tabs';
import { applyCopiedPreset, resetCopiedPreset } from '@showcrafter/firework-editor/presets';

import { useDraftHistory } from '@showcrafter/firework-editor/use-draft-history';

import {
  createStyleDefaultAndUpdateFirework,
  restoreFireworkEditorVersion,
  updateFirework,
} from '@/app/(admin)/admin/fireworks/actions';
import type {
  AdminEditorVersion,
  AdminFireworkDetail,
  AdminStyleDefaultOption,
} from '@/lib/admin.types';
import { canApplySavedEditorSnapshot } from '@/lib/admin/editor-save-state';
import { parseFireworkEditorSnapshot } from '@/lib/admin/editor-snapshots';
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
import { type JsonRecord } from '@/ui/firework-editor/FireworkRenderControls';
import { FireworkTimelineControls } from '@/ui/firework-editor/FireworkTimelineControls';
import { usePreviewFullscreen } from '@/ui/firework-editor/previewFullscreen';
import {
  makeOptimisticEditorVersion,
  useEditorHistory,
} from '@/ui/firework-editor/useEditorHistory';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';
import { SelectField, type SelectOption } from '@/ui/patterns/SelectField';
import { toast } from '@/ui/patterns/toast';
import { ReplayStageBackdrop } from '@/ui/replay/ReplayStageBackdrop';
import { useAdminBreadcrumbOverride } from '@/ui/shell/AdminShell';
import {
  DEFAULT_DESIGN,
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
import { isGroundFireworkEffect, roundTimelineSeconds } from '@showcrafter/fireworks/timing';
import {
  Braces,
  CircleDot,
  GanttChartSquare,
  History,
  Repeat,
  SlidersHorizontal,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';

type ParsedJson = { ok: true; value: JsonRecord } | { ok: false; error: string };

type LocalStyleDefaultOptions = Partial<
  Record<FireworkStyleDefaultKind, AdminStyleDefaultOption[]>
>;

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/ui/replay/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayStageBackdrop /> },
);

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

type FireworkEditorSavedSnapshot = {
  id: string;
  updatedAt: string;
  name: string;
  description: string;
  effectId: string;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
  caliber: string;
  durationSeconds: string;
  heightMeters: string;
  overridesText: string;
  signature: string;
};

type FireworkEditorSnapshotFields = {
  id: string;
  updatedAt: string;
  name: string;
  description: string | null;
  effectId: string;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
  caliber: string | null;
  durationSeconds: number | null;
  heightMeters: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  renderOverridesJson: unknown;
};

type UpdateFireworkSuccess = Extract<Awaited<ReturnType<typeof updateFirework>>, { ok: true }>;

function fireworkSavedSnapshotFromFields(
  fields: FireworkEditorSnapshotFields,
): FireworkEditorSavedSnapshot {
  const overrides = isRecord(fields.renderOverridesJson) ? fields.renderOverridesJson : {};
  const {
    primaryColor: mainColor,
    secondaryColor: accentColor,
    colorPalette: palette,
  } = fireworkColourMetadata(overrides);
  const caliber = fields.caliber ?? '';
  const durationSeconds = fields.durationSeconds == null ? '' : String(fields.durationSeconds);
  const heightMeters = fields.heightMeters == null ? '' : String(fields.heightMeters);

  return {
    id: fields.id,
    updatedAt: fields.updatedAt,
    name: fields.name,
    description: fields.description ?? '',
    effectId: fields.effectId,
    styleDefaultIds: fields.styleDefaultIds,
    caliber,
    durationSeconds,
    heightMeters,
    overridesText: JSON.stringify(fields.renderOverridesJson, null, 2),
    signature: fireworkEditorSignature({
      name: fields.name,
      description: fields.description ?? '',
      effectId: fields.effectId,
      caliber,
      durationSeconds,
      heightMeters,
      primaryColor: mainColor,
      secondaryColor: accentColor,
      colorPalette: palette,
      styleDefaultIds: toSaveStyleDefaultIds(fields.styleDefaultIds),
      renderOverridesJson: overrides,
    }),
  };
}

function fireworkSavedSnapshotFromDetail(
  firework: AdminFireworkDetail,
): FireworkEditorSavedSnapshot {
  return fireworkSavedSnapshotFromFields({
    id: firework.id,
    updatedAt: firework.updatedAt,
    name: firework.name,
    description: firework.description,
    effectId: firework.effectId ?? firework.effectOptions[0]?.id ?? '',
    styleDefaultIds: initialStyleDefaultIds(firework),
    caliber: firework.caliber,
    durationSeconds: firework.durationSeconds,
    heightMeters: firework.heightMeters,
    primaryColor: firework.primaryColor,
    secondaryColor: firework.secondaryColor,
    colorPalette: firework.colorPalette,
    renderOverridesJson: firework.renderOverridesJson,
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

export function FireworkEditor({ firework }: { firework: AdminFireworkDetail }) {
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [isPending, startTransition] = useTransition();
  const incomingSavedSnapshot = useMemo(
    () => fireworkSavedSnapshotFromDetail(firework),
    [firework],
  );
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
  const [overridesText, setOverridesText] = useState(
    JSON.stringify(firework.renderOverridesJson, null, 2),
  );
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(firework.updatedAt);
  const [savedSignature, setSavedSignature] = useState(() => incomingSavedSnapshot.signature);
  const savedSnapshotRef = useRef<FireworkEditorSavedSnapshot>(incomingSavedSnapshot);
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState(incomingSavedSnapshot);
  const savedSignatureRef = useRef(savedSignature);
  const editorTargetIdRef = useRef(firework.id);
  const [activeTab, setActiveTab] = useState('colour');
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const timelineDurationSyncPendingRef = useRef(false);
  const editorHistory = useEditorHistory({
    targetKey: firework.id,
    initialVersions: firework.history,
  });

  const parsedOverrides = useMemo(() => parseJsonObject(overridesText), [overridesText]);
  const overridesRecord = useMemo<JsonRecord>(
    () => (parsedOverrides.ok ? parsedOverrides.value : {}),
    [parsedOverrides],
  );

  const {
    primaryColor: mainColor,
    secondaryColor: accentColor,
    colorPalette: palette,
  } = useMemo(() => fireworkColourMetadata(overridesRecord), [overridesRecord]);

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
  function copySelectedStyleDefaultsIntoOverrides(source: JsonRecord): JsonRecord {
    return cloneRecord(source);
  }

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
        renderOverridesJson: overridesRecord,
      }),
    [
      accentColor,
      caliber,
      description,
      durationSeconds,
      effectId,
      heightMeters,
      mainColor,
      overridesRecord,
      name,
      palette,
      saveStyleDefaultIds,
    ],
  );
  const currentSignatureRef = useRef(currentSignature);
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useLayoutEffect(() => {
    currentSignatureRef.current = currentSignature;
    savedSignatureRef.current = savedSignature;
    editorTargetIdRef.current = firework.id;
  }, [currentSignature, firework.id, savedSignature]);

  useEffect(() => {
    const incomingSnapshot = incomingSavedSnapshot;
    const savedSnapshot = savedSnapshotRef.current;
    const sameFirework = incomingSnapshot.id === savedSnapshot.id;
    if (sameFirework && incomingSnapshot.updatedAt === savedSnapshot.updatedAt) return;
    if (sameFirework && isEarlierUpdatedAt(incomingSnapshot.updatedAt, savedSnapshot.updatedAt)) {
      return;
    }
    if (sameFirework && currentSignatureRef.current !== savedSignatureRef.current) return;

    savedSnapshotRef.current = incomingSnapshot;
    setSavedPreviewSnapshot(incomingSnapshot);
    savedSignatureRef.current = incomingSnapshot.signature;
    setName(incomingSnapshot.name);
    setDescription(incomingSnapshot.description);
    setEffectId(incomingSnapshot.effectId);
    setStyleDefaultIds({ ...incomingSnapshot.styleDefaultIds });
    setCreatedStyleDefaults({});
    setCaliber(incomingSnapshot.caliber);
    setDurationSeconds(incomingSnapshot.durationSeconds);
    setHeightMeters(incomingSnapshot.heightMeters);
    setOverridesText(incomingSnapshot.overridesText);
    setLastSavedUpdatedAt(incomingSnapshot.updatedAt);
    setRestoringVersionId(null);
    setSavedSignature(incomingSnapshot.signature);
  }, [incomingSavedSnapshot]);

  const renderResult = useMemo(
    () =>
      validateCatalogueRender({
        kind: 'firework',
        recordId: firework.id,
        settings: parsedOverrides.ok ? parsedOverrides.value : null,
      }),
    [firework.id, parsedOverrides],
  );

  // Invalid settings remain editable, but never become preview particles.
  const previewDesign = renderResult.ok ? renderResult.design : DEFAULT_DESIGN;
  const renderError = !parsedOverrides.ok
    ? parsedOverrides.error
    : !renderResult.ok
      ? renderResult.diagnostics
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      : null;

  const [showSaved, setShowSaved] = useState(false);
  const savedRenderResult = useMemo(
    () =>
      validateCatalogueRender({
        kind: 'firework',
        recordId: firework.id,
        settings: JSON.parse(savedPreviewSnapshot.overridesText),
      }),
    [firework.id, savedPreviewSnapshot],
  );
  const displayedDesign =
    showSaved && savedRenderResult.ok ? savedRenderResult.design : previewDesign;

  // Head-orb appearance is saved into the firework's render overrides, so the
  // sliders read from the compiled design and write straight back. A firework
  // inherits its effect's saved look and customises it from here.
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
  useEffect(() => {
    if (!timelineDurationSyncPendingRef.current) return;
    timelineDurationSyncPendingRef.current = false;
    setDurationSeconds(String(roundTimelineSeconds(estimateDesignDurationSeconds(previewDesign))));
  }, [previewDesign]);
  const previewTicks = useMemo(
    () =>
      estimatePreviewTicks({
        design: displayedDesign,
        cueTimeSeconds: PREVIEW_CUE_TIME_SECONDS,
        previewDuration,
      }),
    [displayedDesign, previewDuration],
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
        rawSpec: overridesRecord,
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
      overridesRecord,
      previewDesign,
      previewDuration,
      selectedEffect,
    ],
  );
  const previewCues = useMemo(() => {
    if (showSaved)
      return savedRenderResult.ok
        ? [
            {
              ...previewCue,
              firework: {
                ...previewCue.firework,
                caliber: savedPreviewSnapshot.caliber || null,
                renderDesign: savedRenderResult.design,
              },
            },
          ]
        : [];
    return renderError ? [] : [previewCue];
  }, [previewCue, renderError, showSaved, savedRenderResult, savedPreviewSnapshot.caliber]);

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

  function markStyleDefaultCustom(kind: FireworkStyleDefaultKind) {
    setStyleDefaultIds((current) => {
      if (current[kind] === NO_STYLE_DEFAULT_VALUE) return current;
      return { ...current, [kind]: NO_STYLE_DEFAULT_VALUE };
    });
  }

  function mutateOverridesForStyle(
    kind: FireworkStyleDefaultKind,
    updater: (defaults: JsonRecord) => void,
  ) {
    if (!parsedOverrides.ok) return;
    const draft = cloneRecord(parsedOverrides.value);
    updater(draft);
    setOverridesText(JSON.stringify(draft, null, 2));
    markStyleDefaultCustom(kind);
  }

  function mutateOverridesForTimeline(
    kinds: readonly FireworkStyleDefaultKind[],
    updater: (defaults: JsonRecord) => void,
  ) {
    if (!parsedOverrides.ok) return;
    const draft = cloneRecord(parsedOverrides.value);
    const customKinds = kinds.filter((kind) => styleDefaultIds[kind] !== NO_STYLE_DEFAULT_VALUE);
    updater(draft);
    timelineDurationSyncPendingRef.current = true;
    setOverridesText(JSON.stringify(draft, null, 2));
    if (customKinds.length > 0) {
      setStyleDefaultIds((current) => {
        const next = { ...current };
        for (const kind of customKinds) next[kind] = NO_STYLE_DEFAULT_VALUE;
        return next;
      });
    }
  }

  function resetLocalStyleDefaults(kind: FireworkStyleDefaultKind) {
    mutateOverridesForStyle(kind, (defaults) => {
      resetCopiedPreset(defaults, kind);
    });
  }

  function handleStyleDefaultChange(kind: FireworkStyleDefaultKind, value: string) {
    const option = [...firework.styleDefaults[kind], ...(createdStyleDefaults[kind] ?? [])].find(
      (item) => item.id === value,
    );
    if (option) {
      const checked = validateFireworkDesign({ variantOverrides: option.defaultsJson });
      if (!checked.ok) {
        setError(checked.diagnostics.map((issue) => issue.message).join('; '));
        return;
      }
      mutateOverridesForStyle(kind, (defaults) => applyCopiedPreset(defaults, kind, option));
    }
    setError(null);
    setStyleDefaultIds((current) => ({ ...current, [kind]: value }));
  }

  function handleEffectIdChange(nextEffectId: string) {
    if (nextEffectId === effectId) return;
    const model = firework.effectModels[nextEffectId];
    if (!model) {
      setError('This effect has no render settings and cannot be applied.');
      return;
    }
    const copied = validateFireworkDesign({ baseModel: model });
    if (!copied.ok) {
      setError(copied.diagnostics.map((issue) => issue.message).join('; '));
      return;
    }
    setError(null);
    setEffectId(nextEffectId);
    setStyleDefaultIds(emptyStyleDefaultIdMap());
    setOverridesText(JSON.stringify(copied.design, null, 2));
  }

  async function persistFirework(args: {
    targetId: string;
    styleDefaultIdsMap: Record<FireworkStyleDefaultKind, string | null>;
    overrides: JsonRecord;
    historyVersionId: string;
  }): Promise<UpdateFireworkSuccess | null> {
    let result: Awaited<ReturnType<typeof updateFirework>>;
    try {
      result = await updateFirework({
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
        historyVersionId: args.historyVersionId,
      });
    } catch {
      if (editorTargetIdRef.current === args.targetId) {
        setError('Could not save the firework. Try again.');
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

  function currentLocalSnapshot(): FireworkEditorSavedSnapshot {
    return {
      id: firework.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      effectId,
      styleDefaultIds: { ...styleDefaultIds },
      caliber,
      durationSeconds,
      heightMeters,
      overridesText,
      signature: currentSignature,
    };
  }

  function applySnapshot(snapshot: FireworkEditorSavedSnapshot) {
    setName(snapshot.name);
    setDescription(snapshot.description);
    setEffectId(snapshot.effectId);
    setStyleDefaultIds({ ...snapshot.styleDefaultIds });
    setCaliber(snapshot.caliber);
    setDurationSeconds(snapshot.durationSeconds);
    setHeightMeters(snapshot.heightMeters);
    setOverridesText(snapshot.overridesText);
  }

  function beginOptimisticMutation(
    optimisticSnapshot: FireworkEditorSavedSnapshot,
    action: 'update' | 'restore',
  ) {
    const historyVersionId = crypto.randomUUID();
    const localSnapshot = currentLocalSnapshot();
    currentSignatureRef.current = optimisticSnapshot.signature;
    applySnapshot(optimisticSnapshot);
    editorHistory.begin(
      makeOptimisticEditorVersion({
        id: historyVersionId,
        targetKind: 'firework',
        targetId: firework.id,
        action,
      }),
    );
    return {
      targetId: firework.id,
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
    if (!effectId || renderError || !parsedOverrides.ok) {
      setError(renderError ?? 'Choose a base effect before saving this preset.');
      return;
    }
    const copiedOverrides = copySelectedStyleDefaultsIntoOverrides(overridesRecord);
    const clearedStyleDefaultIds = emptyStyleDefaultIdMap();
    const clearedSaveMap = toSaveStyleDefaultIds(clearedStyleDefaultIds);
    const nextMerged = copiedOverrides;
    const optimisticSnapshot = fireworkSavedSnapshotFromFields({
      id: firework.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      effectId,
      styleDefaultIds: clearedStyleDefaultIds,
      caliber: caliber || null,
      durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
      heightMeters: heightMeters === '' ? null : Number(heightMeters),
      primaryColor: mainColor,
      secondaryColor: accentColor,
      colorPalette: palette,
      renderOverridesJson: nextMerged,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'update');
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createStyleDefaultAndUpdateFirework>>;
      try {
        result = await createStyleDefaultAndUpdateFirework({
          firework: {
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
            styleDefaultIds: clearedSaveMap,
            renderOverridesJson: JSON.stringify(nextMerged, null, 2),
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
      const savedSnapshot = fireworkSavedSnapshotFromFields({
        ...result.saved,
        effectId: result.saved.fireworkEffectId,
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
        toast.success('Saved; newer firework edits remain unsaved');
      }
    });
  }

  function save() {
    if (isPending) return;
    setError(null);
    if (renderError || !parsedOverrides.ok) {
      setError(renderError ?? (!parsedOverrides.ok ? parsedOverrides.error : null));
      return;
    }
    if (!effectId) {
      setError('Choose a base effect.');
      return;
    }
    const copiedOverrides = copySelectedStyleDefaultsIntoOverrides(overridesRecord);
    const clearedStyleDefaultIds = emptyStyleDefaultIdMap();
    const clearedSaveMap = toSaveStyleDefaultIds(clearedStyleDefaultIds);
    const optimisticSnapshot = fireworkSavedSnapshotFromFields({
      id: firework.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      effectId,
      styleDefaultIds: clearedStyleDefaultIds,
      caliber: caliber || null,
      durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
      heightMeters: heightMeters === '' ? null : Number(heightMeters),
      primaryColor: mainColor,
      secondaryColor: accentColor,
      colorPalette: palette,
      renderOverridesJson: copiedOverrides,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'update');
    startTransition(async () => {
      const persisted = await persistFirework({
        targetId: mutation.targetId,
        styleDefaultIdsMap: clearedSaveMap,
        overrides: copiedOverrides,
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
      const savedSnapshot = fireworkSavedSnapshotFromFields({
        ...persisted.saved,
        effectId: persisted.saved.fireworkEffectId,
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
        toast.success('Firework saved');
      } else {
        toast.success('Firework saved; newer edits remain unsaved');
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
    const snapshot = parseFireworkEditorSnapshot(version.snapshotJson);
    if (!snapshot || snapshot.id !== firework.id) {
      setError('That version cannot be restored.');
      return;
    }
    const optimisticSnapshot = fireworkSavedSnapshotFromFields({
      id: snapshot.id,
      updatedAt: lastSavedUpdatedAt,
      name: snapshot.name,
      description: snapshot.description,
      effectId: snapshot.fireworkEffectId,
      styleDefaultIds: emptyStyleDefaultIdMap(),
      caliber: snapshot.caliber,
      durationSeconds: snapshot.durationSeconds,
      heightMeters: snapshot.heightMeters,
      primaryColor: snapshot.primaryColor,
      secondaryColor: snapshot.secondaryColor,
      colorPalette: snapshot.colorPalette,
      renderOverridesJson: snapshot.renderOverridesJson,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'restore');
    setRestoringVersionId(version.id);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreFireworkEditorVersion>>;
      try {
        result = await restoreFireworkEditorVersion({
          fireworkId: firework.id,
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
      const restoredSnapshot = fireworkSavedSnapshotFromFields({
        ...result.saved,
        effectId: result.saved.fireworkEffectId,
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
        toast.success('Version restored; newer firework edits remain unsaved');
      }
    });
  }

  const effectOptions = firework.effectOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const previewMenuActions = useMemo(
    () => [
      {
        id: 'loop',
        label: isLooping ? 'Disable looping' : 'Enable looping',
        active: isLooping,
        onClick: () => setIsLooping((looping) => !looping),
        icon: <Repeat size={16} strokeWidth={2} />,
      },
    ],
    [isLooping],
  );
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
      cameraMenuActions={previewMenuActions}
      showFps
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
  function renderStyleDefaultControls(kind: FireworkStyleDefaultKind) {
    return (
      <EditorStyleDefaultControls
        label={`${styleDefaultKindLabel(kind)} style`}
        value={styleDefaultIds[kind]}
        onChange={(value) => handleStyleDefaultChange(kind, value)}
        options={styleDefaultOptions(
          firework.styleDefaults[kind],
          selectedFireworkStyleDefaults[kind] ?? firework.fireworkStyleDefaultLinks[kind] ?? null,
        )}
        disabled={!parsedOverrides.ok}
        saveDisabled={isPending || Boolean(renderError)}
        onSave={(styleName) => saveCurrentStyleAsDefault(kind, styleName)}
        resetDisabled={
          !isRecord(overridesRecord.presetSources) || !overridesRecord.presetSources[kind]
        }
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
        defaults: overridesRecord,
        disabled: !parsedOverrides.ok,
      },
      mutate: mutateOverridesForStyle,
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
          disabled={!parsedOverrides.ok}
          onMutate={mutateOverridesForTimeline}
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
      title: 'Render overrides JSON',
      content: <JsonReadOnlyPanel value={overridesRecord as Json} />,
    },
  ].filter((tab) => !isGroundEmitter || (tab.id !== 'launch-dot' && tab.id !== 'launch-trail'));

  const draftHistory = useDraftHistory({
    recordKey: firework.id,
    value: currentLocalSnapshot(),
    signature: currentSignature,
    restore: applySnapshot,
  });

  return (
    <FireworkEditorShell
      history={draftHistory}
      comparison={{ saved: showSaved, onChange: setShowSaved }}
      title={name || firework.name}
      chips={[{ label: 'Calibre', value: caliber.trim() || firework.caliber, icon: CircleDot }]}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={Boolean(renderError) || isPending}
      revertDisabled={!isDirty || isPending}
      onSave={save}
      onRevert={revertLocalChanges}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      tabs={tabs}
      preview={preview}
      transport={transport}
      transportPlaying={isPlaying}
      error={error}
      renderDiagnostics={{
        recordId: firework.id,
        issues: !parsedOverrides.ok
          ? [{ path: [], message: parsedOverrides.error }]
          : !renderResult.ok
            ? renderResult.diagnostics
            : [],
      }}
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
