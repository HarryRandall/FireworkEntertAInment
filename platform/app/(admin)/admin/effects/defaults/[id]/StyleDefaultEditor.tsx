'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Braces,
  Cloud,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { archiveStyleDefault, updateStyleDefault } from '@/app/actions/admin-style-defaults';
import { JsonReadOnlyPanel } from '@/app/components/admin/EditorInspectorPanels';
import {
  estimateLaunchPreviewDurationSeconds,
  estimateLaunchPreviewTicks,
  estimatePreviewTicks,
} from '@/app/components/admin/editor-preview-timing';
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
  PanelSection,
} from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import { canApplySavedEditorSnapshot } from '@/lib/admin/editor-save-state';
import type { AdminStyleDefaultDetail } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  extractStyleDefaultsFromDesign,
  makeStyleDefaultPreviewBaseModel,
  makeTrailPreviewStarDefaults,
  normaliseStyleDefaultJson,
  styleDefaultKindLabel,
  type FireworkStyleDefaultKind,
} from '@/lib/fireworks/style-defaults';
import { DEFAULT_FIREWORK_SPEC } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type TrailPreviewStarMode = 'none' | 'default' | 'custom';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <ReplayStageBackdrop />,
  },
);

const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
// Coalesce heavyweight `elapsed` commits during a timeline drag to ~15Hz so a
// fast scrub does not re-render the whole editor on every input event. The
// engine ref and the transport's local thumb still update at full input rate.
const SCRUB_COMMIT_INTERVAL_MS = 67;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];

const KIND_OPTIONS = FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => ({
  value: kind,
  label: styleDefaultKindLabel(kind),
}));

const TRAIL_PREVIEW_STAR_OPTIONS = [
  { value: 'none', label: 'No star' },
  { value: 'default', label: 'Default star' },
  { value: 'custom', label: 'Custom star' },
];

const KIND_ICON: Record<FireworkStyleDefaultKind, LucideIcon> = {
  star: Sparkles,
  trail: Wind,
  launch: Rocket,
  smoke: Cloud,
  strobe: Zap,
  crackle: Zap,
  split: Sparkles,
  sound: Volume2,
};

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse JSON.' };
  }
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function compileStyleDefaultPreviewDesign(
  kind: FireworkStyleDefaultKind,
  defaultsJson: unknown,
  trailPreviewStarDefaults?: unknown,
) {
  const normalisedDefaults = normaliseStyleDefaultJson(kind, defaultsJson);
  return compileFireworkDesign({
    baseModel: makeStyleDefaultPreviewBaseModel(kind),
    fireworkStyleDefaults:
      kind === 'trail' && trailPreviewStarDefaults ? [trailPreviewStarDefaults] : undefined,
    variantOverrides: normalisedDefaults,
    primaryColor: kind === 'trail' || kind === 'smoke' || kind === 'launch' ? PREVIEW_COLOR : null,
  });
}

function styleDefaultEditorSignature(fields: {
  name: string;
  description: string;
  kind: FireworkStyleDefaultKind;
  sortOrder: number;
  isArchived: boolean;
  defaultsJson: Record<string, unknown> | string;
}): string {
  return JSON.stringify({
    name: fields.name,
    description: fields.description,
    kind: fields.kind,
    sortOrder: fields.sortOrder,
    isArchived: fields.isArchived,
    defaultsJson: fields.defaultsJson,
  });
}

type StyleDefaultEditorSavedSnapshot = {
  id: string;
  updatedAt: string;
  name: string;
  description: string;
  kind: FireworkStyleDefaultKind;
  sortOrder: string;
  isArchived: boolean;
  defaultsText: string;
  signature: string;
};

type StyleDefaultEditorSnapshotFields = {
  id: string;
  updatedAt: string;
  name: string;
  description: string | null;
  kind: FireworkStyleDefaultKind;
  sortOrder: number;
  isArchived: boolean;
  defaultsJson: unknown;
};

function styleDefaultSavedSnapshotFromFields(
  fields: StyleDefaultEditorSnapshotFields,
): StyleDefaultEditorSavedSnapshot {
  const defaultsJson = normaliseStyleDefaultJson(fields.kind, fields.defaultsJson);
  return {
    id: fields.id,
    updatedAt: fields.updatedAt,
    name: fields.name,
    description: fields.description ?? '',
    kind: fields.kind,
    sortOrder: String(fields.sortOrder),
    isArchived: fields.isArchived,
    defaultsText: JSON.stringify(defaultsJson, null, 2),
    signature: styleDefaultEditorSignature({
      name: fields.name,
      description: fields.description ?? '',
      kind: fields.kind,
      sortOrder: fields.sortOrder,
      isArchived: fields.isArchived,
      defaultsJson,
    }),
  };
}

function styleDefaultSavedSnapshotFromDetail(
  styleDefault: AdminStyleDefaultDetail,
): StyleDefaultEditorSavedSnapshot {
  return styleDefaultSavedSnapshotFromFields({
    id: styleDefault.id,
    updatedAt: styleDefault.updatedAt,
    name: styleDefault.name,
    description: styleDefault.description,
    kind: styleDefault.kind,
    sortOrder: styleDefault.sortOrder,
    isArchived: styleDefault.isArchived,
    defaultsJson: styleDefault.defaultsJson,
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

export function StyleDefaultEditor({ styleDefault }: { styleDefault: AdminStyleDefaultDetail }) {
  const router = useRouter();
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [isPending, startTransition] = useTransition();
  const incomingSavedSnapshot = useMemo(
    () => styleDefaultSavedSnapshotFromDetail(styleDefault),
    [styleDefault],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoadingProgress, setPreviewLoadingProgress] = useState<number | null>(null);
  const [name, setName] = useState(styleDefault.name);
  const [description, setDescription] = useState(styleDefault.description ?? '');
  const [kind, setKind] = useState<FireworkStyleDefaultKind>(styleDefault.kind);
  const [sortOrder, setSortOrder] = useState(String(styleDefault.sortOrder));
  const [isArchived, setIsArchived] = useState(styleDefault.isArchived);
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(styleDefault.updatedAt);
  const [trailPreviewStarMode, setTrailPreviewStarMode] = useState<TrailPreviewStarMode>('none');
  const [customTrailPreviewStarDefaults, setCustomTrailPreviewStarDefaults] = useState<
    Record<string, unknown>
  >(() => makeTrailPreviewStarDefaults());
  const [defaultsText, setDefaultsText] = useState(() =>
    JSON.stringify(
      normaliseStyleDefaultJson(styleDefault.kind, styleDefault.defaultsJson),
      null,
      2,
    ),
  );
  const [savedSignature, setSavedSignature] = useState(() => incomingSavedSnapshot.signature);
  const savedSnapshotRef = useRef<StyleDefaultEditorSavedSnapshot>(incomingSavedSnapshot);
  const savedSignatureRef = useRef(savedSignature);
  const [activeTab, setActiveTab] = useState<string>(styleDefault.kind);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);
  const lastScrubCommitRef = useRef(0);
  const pendingScrubRef = useRef<number | null>(null);

  const parsedDefaults = useMemo(() => parseJsonObject(defaultsText), [defaultsText]);
  const defaultsRecord = useMemo<Record<string, unknown>>(
    () => (parsedDefaults.ok ? parsedDefaults.value : {}),
    [parsedDefaults],
  );
  const defaultTrailPreviewStarDefaults = useMemo(() => makeTrailPreviewStarDefaults(), []);
  const trailPreviewStarDefaults =
    trailPreviewStarMode === 'custom'
      ? customTrailPreviewStarDefaults
      : trailPreviewStarMode === 'default'
        ? defaultTrailPreviewStarDefaults
        : undefined;
  const previewDesign = useMemo(
    () =>
      compileStyleDefaultPreviewDesign(
        kind,
        parsedDefaults.ok ? parsedDefaults.value : styleDefault.defaultsJson,
        trailPreviewStarDefaults,
      ),
    [kind, parsedDefaults, styleDefault.defaultsJson, trailPreviewStarDefaults],
  );
  const sortOrderNumber = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
  const currentSignature = useMemo(
    () =>
      styleDefaultEditorSignature({
        name,
        description,
        kind,
        sortOrder: sortOrderNumber,
        isArchived,
        defaultsJson: parsedDefaults.ok
          ? normaliseStyleDefaultJson(kind, parsedDefaults.value)
          : defaultsText,
      }),
    [defaultsText, description, isArchived, kind, name, parsedDefaults, sortOrderNumber],
  );
  const currentSignatureRef = useRef(currentSignature);
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useLayoutEffect(() => {
    currentSignatureRef.current = currentSignature;
    savedSignatureRef.current = savedSignature;
  }, [currentSignature, savedSignature]);

  useEffect(() => {
    const incomingSnapshot = incomingSavedSnapshot;
    const savedSnapshot = savedSnapshotRef.current;
    const sameStyleDefault = incomingSnapshot.id === savedSnapshot.id;
    if (sameStyleDefault && incomingSnapshot.updatedAt === savedSnapshot.updatedAt) return;
    if (
      sameStyleDefault &&
      isEarlierUpdatedAt(incomingSnapshot.updatedAt, savedSnapshot.updatedAt)
    ) {
      return;
    }
    if (sameStyleDefault && currentSignatureRef.current !== savedSignatureRef.current) return;

    savedSnapshotRef.current = incomingSnapshot;
    savedSignatureRef.current = incomingSnapshot.signature;
    setName(incomingSnapshot.name);
    setDescription(incomingSnapshot.description);
    setKind(incomingSnapshot.kind);
    setSortOrder(incomingSnapshot.sortOrder);
    setIsArchived(incomingSnapshot.isArchived);
    setLastSavedUpdatedAt(incomingSnapshot.updatedAt);
    setTrailPreviewStarMode('none');
    setCustomTrailPreviewStarDefaults(makeTrailPreviewStarDefaults());
    setDefaultsText(incomingSnapshot.defaultsText);
    setActiveTab(incomingSnapshot.kind);
    setError(null);
    setSavedSignature(incomingSnapshot.signature);
  }, [incomingSavedSnapshot]);

  useEffect(() => {
    setAdminBreadcrumb({ label: name || styleDefault.name });
    return () => setAdminBreadcrumb(null);
  }, [name, setAdminBreadcrumb, styleDefault.name]);

  const heads = previewDesign.stars.outer.head;
  const previewDuration = useMemo(() => {
    const estimated =
      kind === 'launch'
        ? estimateLaunchPreviewDurationSeconds({
            design: previewDesign,
            cueTimeSeconds: PREVIEW_CUE_TIME_SECONDS,
          })
        : PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(kind === 'launch' ? 2.5 : 4, Math.ceil(estimated * 2) / 2);
  }, [kind, previewDesign]);
  const previewTicks = useMemo(() => {
    const params = {
      design: previewDesign,
      cueTimeSeconds: PREVIEW_CUE_TIME_SECONDS,
      previewDuration,
    };
    return kind === 'launch' ? estimateLaunchPreviewTicks(params) : estimatePreviewTicks(params);
  }, [kind, previewDesign, previewDuration]);

  const previewCue = useMemo<ReplayCue>(
    () => ({
      id: `${styleDefault.id}-style-preview`,
      position: 1,
      timeSeconds: PREVIEW_CUE_TIME_SECONDS,
      description: description || name,
      productId: styleDefault.id,
      launchPositionIndex: 0,
      firework: {
        id: styleDefault.id,
        slug: styleDefault.slug,
        name,
        description: description || null,
        sortOrder: 0,
        durationSeconds: previewDuration,
        heightMeters: null,
        caliber: null,
        shotCount: 1,
        spec: DEFAULT_FIREWORK_SPEC,
        rawSpec: defaultsRecord,
        renderDesign: previewDesign,
        baseEffect: null,
        variant: null,
      },
    }),
    [
      defaultsRecord,
      description,
      name,
      previewDesign,
      previewDuration,
      styleDefault.id,
      styleDefault.slug,
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

  function mutateDefaults(updater: (defaults: Record<string, unknown>) => void) {
    if (!parsedDefaults.ok) return;
    const draft = cloneRecord(parsedDefaults.value);
    updater(draft);
    setDefaultsText(
      JSON.stringify(
        extractStyleDefaultsFromDesign(
          compileStyleDefaultPreviewDesign(kind, draft, trailPreviewStarDefaults),
          kind,
        ),
        null,
        2,
      ),
    );
  }

  function changeKind(value: string) {
    const nextKind =
      FIREWORK_STYLE_DEFAULT_KINDS.find((candidate) => candidate === value) ?? 'star';
    setKind(nextKind);
    if (!parsedDefaults.ok) return;
    const nextDesign = compileStyleDefaultPreviewDesign(
      nextKind,
      parsedDefaults.value,
      trailPreviewStarDefaults,
    );
    setDefaultsText(JSON.stringify(extractStyleDefaultsFromDesign(nextDesign, nextKind), null, 2));
  }

  function changeTrailPreviewStarMode(value: string) {
    setTrailPreviewStarMode(
      value === 'custom' ? 'custom' : value === 'default' ? 'default' : 'none',
    );
  }

  function mutateTrailPreviewStarDefaults(updater: (defaults: Record<string, unknown>) => void) {
    const draft = cloneRecord(customTrailPreviewStarDefaults);
    updater(draft);
    setCustomTrailPreviewStarDefaults(
      extractStyleDefaultsFromDesign(
        compileStyleDefaultPreviewDesign('trail', defaultsRecord, draft),
        'star',
      ),
    );
  }

  function save() {
    setError(null);
    if (!parsedDefaults.ok) {
      setError(parsedDefaults.error);
      return;
    }
    const saveStartedFromSignature = currentSignature;
    const savedDefaultsText = JSON.stringify(parsedDefaults.value, null, 2);

    startTransition(async () => {
      const result = await updateStyleDefault({
        id: styleDefault.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description,
        kind,
        sortOrder: sortOrderNumber,
        isArchived,
        defaultsJson: savedDefaultsText,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const savedSnapshot = styleDefaultSavedSnapshotFromFields(result.saved);
      setLastSavedUpdatedAt(savedSnapshot.updatedAt);
      savedSnapshotRef.current = savedSnapshot;
      savedSignatureRef.current = savedSnapshot.signature;
      setSavedSignature(savedSnapshot.signature);
      if (canApplySavedEditorSnapshot(saveStartedFromSignature, currentSignatureRef.current)) {
        setName(savedSnapshot.name);
        setDescription(savedSnapshot.description);
        setKind(savedSnapshot.kind);
        setSortOrder(savedSnapshot.sortOrder);
        setIsArchived(savedSnapshot.isArchived);
        setDefaultsText(savedSnapshot.defaultsText);
        setActiveTab(savedSnapshot.kind);
        toast.success('Style default saved');
      } else {
        toast.success('Style default saved; newer edits remain unsaved');
      }
      router.refresh();
    });
  }

  function archiveDefault() {
    setError(null);
    const archiveStartedFromSignature = currentSignature;
    const archiveStartedClean = archiveStartedFromSignature === savedSignatureRef.current;
    startTransition(async () => {
      const result = await archiveStyleDefault({
        id: styleDefault.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const savedSnapshot = styleDefaultSavedSnapshotFromFields(result.saved);
      const applySavedSnapshot =
        archiveStartedClean &&
        canApplySavedEditorSnapshot(archiveStartedFromSignature, currentSignatureRef.current);
      savedSnapshotRef.current = savedSnapshot;
      savedSignatureRef.current = savedSnapshot.signature;
      setLastSavedUpdatedAt(savedSnapshot.updatedAt);
      setSavedSignature(savedSnapshot.signature);
      if (applySavedSnapshot) {
        setName(savedSnapshot.name);
        setDescription(savedSnapshot.description);
        setKind(savedSnapshot.kind);
        setSortOrder(savedSnapshot.sortOrder);
        setIsArchived(savedSnapshot.isArchived);
        setDefaultsText(savedSnapshot.defaultsText);
        setActiveTab(savedSnapshot.kind);
        toast.success('Style default archived');
      } else {
        setIsArchived(savedSnapshot.isArchived);
        toast.success('Style default archived; newer edits remain unsaved');
      }
      router.refresh();
    });
  }

  function revertLocalChanges() {
    const savedSnapshot = savedSnapshotRef.current;
    setName(savedSnapshot.name);
    setDescription(savedSnapshot.description);
    setKind(savedSnapshot.kind);
    setSortOrder(savedSnapshot.sortOrder);
    setIsArchived(savedSnapshot.isArchived);
    setLastSavedUpdatedAt(savedSnapshot.updatedAt);
    setTrailPreviewStarMode('none');
    setCustomTrailPreviewStarDefaults(makeTrailPreviewStarDefaults());
    setDefaultsText(savedSnapshot.defaultsText);
    setActiveTab(savedSnapshot.kind);
    setError(null);
    savedSignatureRef.current = savedSnapshot.signature;
    setSavedSignature(savedSnapshot.signature);
  }

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
      renderTuning={{
        glowPadding: heads.glowPadding,
        whiteCoreSizePercent: heads.whiteCoreSizePercent,
        whiteCoreBlurPercent: heads.whiteCoreBlurPercent,
      }}
      headStyle={{
        coreSoftness: heads.coreSoftness,
        coreBrightness: heads.coreBrightness,
        coreOpacityFalloff: heads.coreOpacityFalloff,
        glowSize: heads.glowSize,
        glowSoftness: heads.glowSoftness,
        glowOpacityFalloff: heads.glowOpacityFalloff,
        glowBlur: heads.glowBlur,
        backgroundGlowOpacityFalloff: heads.backgroundGlowOpacityFalloff,
        backgroundGlowSoftness: heads.backgroundGlowSoftness,
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
    <div className="space-y-5">
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="style-name">Name</FieldLabel>
          <Input id="style-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel>Kind</FieldLabel>
          <SelectField
            value={kind}
            onChange={changeKind}
            options={KIND_OPTIONS}
            ariaLabel="Style default kind"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="style-sort">Sort order</FieldLabel>
          <Input
            id="style-sort"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="style-description">Description</FieldLabel>
          <Textarea
            id="style-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>

      <PanelSection title="Archive" collapsible defaultExpanded={false}>
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-[color:var(--color-content-muted)]">
            Archive this default when it should no longer be offered for new assignments.
          </p>
          <Button
            variant="destructive"
            onClick={archiveDefault}
            loading={isPending}
            disabled={isArchived}
          >
            <Archive size={16} />
            {isArchived ? 'Archived' : 'Archive default'}
          </Button>
        </div>
      </PanelSection>
    </div>
  );

  const kindControls = (
    <div className="space-y-5">
      {kind === 'trail' ? (
        <PanelSection
          title="Preview star"
          titleAccessory={
            <InfoTooltip text="Adds an optional star only for judging this trail in the preview. The saved default still contains only the trail settings." />
          }
          collapsible
          defaultExpanded={false}
        >
          <div className="space-y-5">
            <Field>
              <FieldLabel>Preview star</FieldLabel>
              <SelectField
                value={trailPreviewStarMode}
                onChange={changeTrailPreviewStarMode}
                options={TRAIL_PREVIEW_STAR_OPTIONS}
                ariaLabel="Preview star"
              />
            </Field>
            {trailPreviewStarMode === 'custom' ? (
              <FireworkRenderControls
                design={previewDesign}
                defaults={customTrailPreviewStarDefaults}
                calibrationDefaults={customTrailPreviewStarDefaults}
                mutate={mutateTrailPreviewStarDefaults}
                disabled={!parsedDefaults.ok}
                showStarCount
                controlScope="star"
              />
            ) : null}
          </div>
        </PanelSection>
      ) : null}

      <FireworkRenderControls
        design={previewDesign}
        defaults={defaultsRecord}
        calibrationDefaults={defaultsRecord}
        mutate={mutateDefaults}
        disabled={!parsedDefaults.ok}
        showStarCount={kind === 'star'}
        showLaunch={kind === 'launch'}
        controlScope={kind}
      />
    </div>
  );

  const jsonValue = (
    parsedDefaults.ok
      ? normaliseStyleDefaultJson(kind, parsedDefaults.value)
      : { error: parsedDefaults.error }
  ) as Json;
  const kindLabel = styleDefaultKindLabel(kind);
  const tabs: FireworkEditorShellTab[] = [
    {
      id: 'details',
      label: 'Details',
      icon: SlidersHorizontal,
      eyebrow: 'Style default',
      title: 'Details',
      content: detailsContent,
    },
    {
      id: kind,
      label: kindLabel,
      icon: KIND_ICON[kind],
      eyebrow: 'Defaults',
      title: `${kindLabel} defaults`,
      content: kindControls,
    },
    {
      id: 'json',
      label: 'JSON',
      icon: Braces,
      eyebrow: 'Advanced',
      title: 'Defaults JSON',
      content: <JsonReadOnlyPanel value={jsonValue} />,
    },
  ];

  return (
    <FireworkEditorShell
      title={name || styleDefault.name}
      chips={[{ label: 'Status', value: isArchived ? 'Archived' : null, icon: Archive }]}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={!parsedDefaults.ok || isPending}
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
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
