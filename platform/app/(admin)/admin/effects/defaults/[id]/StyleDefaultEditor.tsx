'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Archive, Pause, Play, Repeat, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { archiveStyleDefault, updateStyleDefault } from '@/app/actions/admin-style-defaults';
import {
  FireworkRenderControls,
  PanelSection,
} from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/app/components/ui/toast';
import type { AdminStyleDefaultDetail } from '@/lib/admin.types';
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
    loading: () => <ReplayCanvasSkeleton />,
  },
);

const PREVIEW_COLOR = '#22d3ee';
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
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

function ReplayCanvasSkeleton() {
  return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#0b1020]" />;
}

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

export function StyleDefaultEditor({ styleDefault }: { styleDefault: AdminStyleDefaultDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
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
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);

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

  const heads = previewDesign.stars.outer.head;
  const previewDuration = useMemo(() => {
    const estimated = PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(4, Math.ceil(estimated * 2) / 2);
  }, [previewDesign]);

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

    startTransition(async () => {
      const result = await updateStyleDefault({
        id: styleDefault.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description,
        kind,
        sortOrder: Number(sortOrder),
        isArchived,
        defaultsJson: defaultsText,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLastSavedUpdatedAt(result.updatedAt);
      toast.success('Style default saved');
      router.refresh();
    });
  }

  function archiveDefault() {
    setError(null);
    startTransition(async () => {
      const result = await archiveStyleDefault({ id: styleDefault.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsArchived(true);
      toast.success('Style default archived');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 xl:h-[calc(100vh-6.5rem)] xl:flex-row xl:items-stretch">
      <Card radius="lg" className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="relative h-[min(62vw,560px)] min-h-[360px] bg-[#05070d] xl:h-auto xl:min-h-0 xl:flex-1">
          <LazyFireworkReplayCanvas
            cues={previewCues}
            elapsed={elapsed}
            playbackRef={playbackRef}
            launchPositions={PREVIEW_LAUNCH_POSITIONS}
            muted={!isPlaying}
            interactive
            controlsVisible
            showFps
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
        className="flex w-full min-w-0 flex-col p-0 xl:w-[440px] xl:shrink-0 xl:self-stretch"
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
                <FieldLabel htmlFor="style-name">Name</FieldLabel>
                <Input
                  id="style-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
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
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            </div>
          </PanelSection>

          {kind === 'trail' ? (
            <PanelSection
              title="Preview"
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
            showLaunch={kind === 'launch' || kind === 'smoke'}
            controlScope={kind}
          />
        </div>

        <div className="grid gap-3 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4 sm:grid-cols-[1fr_auto]">
          <Button
            className="w-full"
            onClick={save}
            loading={isPending}
            disabled={!parsedDefaults.ok}
          >
            <Save size={16} />
            Save default
          </Button>
          <Button
            variant="secondary"
            onClick={archiveDefault}
            loading={isPending}
            disabled={isArchived}
          >
            <Archive size={16} />
            Archive
          </Button>
        </div>
      </Card>
    </div>
  );
}
