'use client';

/** Curated show preset editor: replay, timeline, catalogue insertion and publish controls. */

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  PackagePlus,
  Pencil,
  Search,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  replaceShowPresetCues,
  setShowPresetPublished,
  updateShowPresetDetails,
} from '@/app/actions/admin-show-presets';
import { useAdminBreadcrumbOverride } from '@/app/components/admin/AdminShell';
import { EditorPreviewTransport } from '@/app/components/admin/FireworkEditorShell';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/app/components/admin/previewFullscreen';
import { ReplayCanvasSkeleton } from '@/app/components/app/ReplayCanvasSkeleton';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AdminShowPresetDetail, ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

const PX_PER_SECOND = 72;
const MIN_CLIP_PX = 56;
const TIMELINE_ROW_COUNT = 3;
const TIMELINE_ROW_HEIGHT_PX = 34;
const TIMELINE_ROW_GAP_PX = 8;
const TIMELINE_INSET_PX = 2;
const MIN_TIMELINE_SECONDS = 10;
const DEFAULT_CUE_DURATION_SECONDS = 2.4;
const MAX_TIMELINE_SECONDS = 60 * 60;

const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

type CueEmphasis = 'normal' | 'accent' | 'peak';

type LocalCue = {
  uid: string;
  catalogueItemId: string;
  catalogueItemSlug: string;
  timeSeconds: number;
  description: string;
  launchPositionIndex: number;
  emphasis: CueEmphasis;
};

type ProductPickerMode = 'insert' | 'replace';
type ProductKindFilter = 'all' | 'firework' | 'multishot';

let cueUidCounter = 0;

function makeCueUid(): string {
  cueUidCounter += 1;
  return `preset-cue-${Date.now().toString(36)}-${cueUidCounter}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normaliseCueTime(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(Number(value.toFixed(2)), 0, MAX_TIMELINE_SECONDS);
}

function normaliseLaunchPositionIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(Math.round(value), 0, TIMELINE_ROW_COUNT - 1);
}

function cueDurationOf(spec: FireworkSpecification | undefined): number {
  const duration = spec?.occupancyDurationSeconds ?? spec?.durationSeconds;
  return duration && Number.isFinite(duration) && duration > 0
    ? duration
    : DEFAULT_CUE_DURATION_SECONDS;
}

function cueVisualSeconds(spec: FireworkSpecification | undefined): number {
  return Math.max(cueDurationOf(spec), MIN_CLIP_PX / PX_PER_SECOND);
}

function paletteOf(spec: FireworkSpecification | undefined): {
  primary: string;
  secondary: string;
} {
  const palette = spec?.variant?.colorPalette.filter(Boolean) ?? [];
  const primary = spec?.variant?.primaryColor ?? palette[0] ?? '#38bdf8';
  const secondary =
    spec?.variant?.secondaryColor ??
    palette.find((color) => color !== primary) ??
    (spec?.shotCount && spec.shotCount > 1 ? '#f97316' : '#a78bfa');
  return { primary, secondary };
}

function productKindOf(spec: FireworkSpecification): 'multishot' | 'firework' {
  return (spec.shotCount ?? 1) > 1 ? 'multishot' : 'firework';
}

function buildProductLookup(specs: FireworkSpecification[]): Map<string, FireworkSpecification> {
  const lookup = new Map<string, FireworkSpecification>();
  for (const spec of specs) {
    const keys = [
      spec.id,
      spec.slug,
      spec.variant?.id,
      spec.variant?.slug,
      spec.baseEffect?.id,
      spec.baseEffect?.slug,
    ].filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (!lookup.has(key)) lookup.set(key, spec);
    }
  }
  return lookup;
}

function resolveProduct(
  cue: ShowTemplateCue,
  lookup: Map<string, FireworkSpecification>,
): FireworkSpecification | null {
  const alias = cue.fireworkSlug ? FIREWORK_SLUG_ALIASES[cue.fireworkSlug] : undefined;
  const keys = [cue.catalogueItemId, cue.catalogueItemSlug, cue.fireworkSlug, alias].filter(
    (key): key is string => Boolean(key),
  );
  for (const key of keys) {
    const spec = lookup.get(key);
    if (spec) return spec;
  }
  return null;
}

function toLocalCue(
  cue: ShowTemplateCue,
  index: number,
  lookup: Map<string, FireworkSpecification>,
): LocalCue {
  const product = resolveProduct(cue, lookup);
  const unresolvedKey =
    cue.catalogueItemId ?? cue.catalogueItemSlug ?? cue.fireworkSlug ?? `unresolved-${index + 1}`;
  return {
    uid: makeCueUid(),
    catalogueItemId: product?.id ?? unresolvedKey,
    catalogueItemSlug: product?.slug ?? cue.catalogueItemSlug ?? cue.fireworkSlug ?? unresolvedKey,
    timeSeconds: normaliseCueTime(cue.timeSeconds),
    description: cue.description || product?.name || 'Unresolved catalogue item',
    launchPositionIndex: normaliseLaunchPositionIndex(cue.launchPositionIndex ?? index % 3),
    emphasis: cue.emphasis ?? 'normal',
  };
}

function serialiseCues(cues: LocalCue[]): string {
  return JSON.stringify(
    [...cues]
      .sort((a, b) => a.timeSeconds - b.timeSeconds)
      .map((cue) => ({
        catalogueItemId: cue.catalogueItemId,
        catalogueItemSlug: cue.catalogueItemSlug,
        timeSeconds: normaliseCueTime(cue.timeSeconds),
        description: cue.description.trim(),
        launchPositionIndex: normaliseLaunchPositionIndex(cue.launchPositionIndex),
        emphasis: cue.emphasis,
      })),
  );
}

function formatTimelineTimestamp(seconds: number): string {
  const totalTenths = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 10)) : 0;
  const minutes = Math.floor(totalTenths / 600);
  const secondsWithinMinute = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${secondsWithinMinute.toString().padStart(2, '0')}.${tenths}`;
}

function detailsSnapshot({
  title,
  slug,
  theme,
  description,
  durationSeconds,
  budgetDollars,
  timeOfDay,
  moodTagText,
  isFeatured,
  sortOrder,
}: {
  title: string;
  slug: string;
  theme: string;
  description: string;
  durationSeconds: string;
  budgetDollars: string;
  timeOfDay: string;
  moodTagText: string;
  isFeatured: boolean;
  sortOrder: string;
}): string {
  return JSON.stringify({
    title: title.trim(),
    slug: slug.trim(),
    theme: theme.trim(),
    description: description.trim(),
    durationSeconds: Number(durationSeconds),
    budgetDollars: budgetDollars.trim(),
    timeOfDay: timeOfDay.trim(),
    moodTagText: moodTagText.trim(),
    isFeatured,
    sortOrder: Number(sortOrder),
  });
}

function toMoodTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function toReplayCues(
  cues: LocalCue[],
  specsById: Map<string, FireworkSpecification>,
): ReplayCue[] {
  return [...cues]
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .flatMap((cue, index) => {
      const firework = specsById.get(cue.catalogueItemId);
      if (!firework) return [];
      return [
        {
          id: cue.uid,
          position: index + 1,
          timeSeconds: cue.timeSeconds,
          description: cue.description,
          productId: cue.catalogueItemId,
          launchPositionIndex: cue.launchPositionIndex,
          emphasis: cue.emphasis,
          firework,
        },
      ];
    });
}

function buildNewCue(
  product: FireworkSpecification,
  atSeconds: number,
  launchPositionIndex: number,
): LocalCue {
  return {
    uid: makeCueUid(),
    catalogueItemId: product.id,
    catalogueItemSlug: product.slug,
    timeSeconds: normaliseCueTime(atSeconds),
    description: product.name,
    launchPositionIndex: normaliseLaunchPositionIndex(launchPositionIndex),
    emphasis: 'normal',
  };
}

function productLabel(product: FireworkSpecification): string {
  return productKindOf(product) === 'multishot'
    ? `${product.name} (${product.shotCount ?? 1} shots)`
    : product.name;
}

function productSummary(product: FireworkSpecification): string {
  const shotCount = product.shotCount ?? 1;
  return `${productKindOf(product)} - ${formatDuration(product.durationSeconds)} - ${shotCount} shot${
    shotCount === 1 ? '' : 's'
  }`;
}

export function ShowPresetEditor({
  preset,
  fireworkSpecs,
}: {
  preset: AdminShowPresetDetail;
  fireworkSpecs: FireworkSpecification[];
}) {
  const router = useRouter();
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const lookup = useMemo(() => buildProductLookup(fireworkSpecs), [fireworkSpecs]);
  const specsById = useMemo(
    () => new Map(fireworkSpecs.map((spec) => [spec.id, spec])),
    [fireworkSpecs],
  );
  const initialCues = useMemo(
    () => preset.previewCues.map((cue, index) => toLocalCue(cue, index, lookup)),
    [lookup, preset.previewCues],
  );
  const initialCuesNeedCanonicalisation = useMemo(
    () =>
      preset.previewCues.some((cue, index) => {
        const resolved = initialCues[index];
        return (
          !cue.catalogueItemId ||
          !cue.catalogueItemSlug ||
          cue.catalogueItemId !== resolved.catalogueItemId ||
          cue.catalogueItemSlug !== resolved.catalogueItemSlug
        );
      }),
    [initialCues, preset.previewCues],
  );

  const [title, setTitle] = useState(preset.title);
  const [slug, setSlug] = useState(preset.slug);
  const [theme, setTheme] = useState(preset.theme);
  const [description, setDescription] = useState(preset.description ?? '');
  const [durationSeconds, setDurationSeconds] = useState(
    String(Math.max(1, preset.durationSeconds ?? 60)),
  );
  const [budgetDollars, setBudgetDollars] = useState(
    preset.budgetCents == null ? '' : String(preset.budgetCents / 100),
  );
  const [timeOfDay, setTimeOfDay] = useState(preset.timeOfDay ?? '');
  const [moodTagText, setMoodTagText] = useState(preset.moodTags.join(', '));
  const [isFeatured, setIsFeatured] = useState(preset.isFeatured);
  const [isPublished, setIsPublished] = useState(preset.isPublished);
  const [sortOrder, setSortOrder] = useState(String(preset.sortOrder));
  const [cues, setCues] = useState<LocalCue[]>(initialCues);
  const [selectedCueUid, setSelectedCueUid] = useState<string | null>(initialCues[0]?.uid ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<ProductPickerMode>('insert');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [insertAtSeconds, setInsertAtSeconds] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReplayReady, setIsReplayReady] = useState(false);
  const [isDetailsPending, startDetailsTransition] = useTransition();
  const [isCuesPending, startCuesTransition] = useTransition();
  const [isPublishPending, startPublishTransition] = useTransition();
  const [initialDetailsKey, setInitialDetailsKey] = useState(() =>
    detailsSnapshot({
      title: preset.title,
      slug: preset.slug,
      theme: preset.theme,
      description: preset.description ?? '',
      durationSeconds: String(Math.max(1, preset.durationSeconds ?? 60)),
      budgetDollars: preset.budgetCents == null ? '' : String(preset.budgetCents / 100),
      timeOfDay: preset.timeOfDay ?? '',
      moodTagText: preset.moodTags.join(', '),
      isFeatured: preset.isFeatured,
      sortOrder: String(preset.sortOrder),
    }),
  );
  const [initialCuesKey, setInitialCuesKey] = useState(() =>
    initialCuesNeedCanonicalisation ? '__needs-canonical-cue-save__' : serialiseCues(initialCues),
  );
  const playbackRef = useRef(0);
  const {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    fullscreenContainerRef,
    fullscreenContainerProps,
  } = usePreviewFullscreen<HTMLElement>({ dialogLabel: `${preset.title} preview` });

  const parsedDuration = Number(durationSeconds);
  const lastCueEnd = cues.reduce((latest, cue) => {
    const spec = specsById.get(cue.catalogueItemId);
    return Math.max(latest, cue.timeSeconds + cueDurationOf(spec));
  }, 0);
  const duration = Math.max(
    MIN_TIMELINE_SECONDS,
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60,
    lastCueEnd + 1,
  );
  const timelineSeconds = Math.max(duration, MIN_TIMELINE_SECONDS);
  const timelineWidth = Math.max(760, Math.ceil(timelineSeconds * PX_PER_SECOND));
  const timelineHeight =
    TIMELINE_ROW_COUNT * TIMELINE_ROW_HEIGHT_PX + (TIMELINE_ROW_COUNT - 1) * TIMELINE_ROW_GAP_PX;
  const selectedCue = cues.find((cue) => cue.uid === selectedCueUid) ?? null;
  const selectedProduct = selectedCue ? specsById.get(selectedCue.catalogueItemId) : undefined;
  const unresolvedCueCount = cues.filter((cue) => !specsById.has(cue.catalogueItemId)).length;
  const replayCues = useMemo(() => toReplayCues(cues, specsById), [cues, specsById]);
  const detailsKey = detailsSnapshot({
    title,
    slug,
    theme,
    description,
    durationSeconds,
    budgetDollars,
    timeOfDay,
    moodTagText,
    isFeatured,
    sortOrder,
  });
  const cuesKey = serialiseCues(cues);
  const detailsDirty = detailsKey !== initialDetailsKey;
  const cuesDirty = cuesKey !== initialCuesKey;
  const isBusy = isDetailsPending || isCuesPending || isPublishPending;
  const canPublish =
    !detailsDirty &&
    !cuesDirty &&
    title.trim().length > 0 &&
    theme.trim().length > 0 &&
    duration > 0 &&
    cues.length > 0 &&
    unresolvedCueCount === 0;
  const transportTicks = cues
    .slice()
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .map((cue, index) => ({ timeSeconds: cue.timeSeconds, label: String(index + 1) }));

  useEffect(() => {
    setAdminBreadcrumb({ label: preset.title });
    return () => setAdminBreadcrumb(null);
  }, [preset.title, setAdminBreadcrumb]);

  useEffect(() => {
    playbackRef.current = clamp(playbackRef.current, 0, duration);
    setElapsed((current) => clamp(current, 0, duration));
  }, [duration]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let previous = performance.now();

    function tick(now: number) {
      const delta = Math.max(0, (now - previous) / 1000);
      previous = now;
      const next = playbackRef.current + delta;
      if (next >= duration) {
        playbackRef.current = duration;
        setElapsed(duration);
        setIsPlaying(false);
        return;
      }
      playbackRef.current = next;
      setElapsed(next);
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying]);

  function scrubTo(seconds: number) {
    const next = clamp(seconds, 0, duration);
    playbackRef.current = next;
    setElapsed(next);
  }

  function resetPreview() {
    setIsPlaying(false);
    scrubTo(0);
  }

  function openInsertPicker(seconds = elapsed) {
    setInsertAtSeconds(normaliseCueTime(seconds));
    setPickerMode('insert');
    setPickerOpen(true);
  }

  function openReplacePicker() {
    setPickerMode('replace');
    setPickerOpen(true);
  }

  function handleTimelineDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const seconds = ((event.clientX - rect.left) / rect.width) * timelineSeconds;
    openInsertPicker(seconds);
  }

  function handlePickerSelect(product: FireworkSpecification) {
    if (pickerMode === 'replace' && selectedCue) {
      setCues((current) =>
        current.map((cue) =>
          cue.uid === selectedCue.uid
            ? {
                ...cue,
                catalogueItemId: product.id,
                catalogueItemSlug: product.slug,
                description: cue.description || product.name,
              }
            : cue,
        ),
      );
      setPickerOpen(false);
      return;
    }

    const nextCue = buildNewCue(product, insertAtSeconds, cues.length % TIMELINE_ROW_COUNT);
    setCues((current) => [...current, nextCue].sort((a, b) => a.timeSeconds - b.timeSeconds));
    setSelectedCueUid(nextCue.uid);
    scrubTo(nextCue.timeSeconds);
    setPickerOpen(false);
  }

  function updateSelectedCue(patch: Partial<LocalCue>) {
    if (!selectedCue) return;
    setCues((current) =>
      current.map((cue) =>
        cue.uid === selectedCue.uid
          ? {
              ...cue,
              ...patch,
              timeSeconds:
                patch.timeSeconds == null ? cue.timeSeconds : normaliseCueTime(patch.timeSeconds),
              launchPositionIndex:
                patch.launchPositionIndex == null
                  ? cue.launchPositionIndex
                  : normaliseLaunchPositionIndex(patch.launchPositionIndex),
            }
          : cue,
      ),
    );
  }

  function moveCue(uid: string, timeSeconds: number, commit: boolean) {
    const nextTime = normaliseCueTime(timeSeconds);
    setSelectedCueUid(uid);
    setCues((current) => {
      const updated = current.map((cue) =>
        cue.uid === uid ? { ...cue, timeSeconds: nextTime } : cue,
      );
      return commit ? updated.sort((a, b) => a.timeSeconds - b.timeSeconds) : updated;
    });
    scrubTo(nextTime);
  }

  function duplicateSelectedCue() {
    if (!selectedCue) return;
    const copy = {
      ...selectedCue,
      uid: makeCueUid(),
      timeSeconds: normaliseCueTime(selectedCue.timeSeconds + cueDurationOf(selectedProduct)),
    };
    setCues((current) => [...current, copy].sort((a, b) => a.timeSeconds - b.timeSeconds));
    setSelectedCueUid(copy.uid);
  }

  function deleteSelectedCue() {
    if (!selectedCue) return;
    setCues((current) => current.filter((cue) => cue.uid !== selectedCue.uid));
    const nextCue = cues.find((cue) => cue.uid !== selectedCue.uid) ?? null;
    setSelectedCueUid(nextCue?.uid ?? null);
  }

  function saveDetails() {
    startDetailsTransition(async () => {
      const budgetNumber = budgetDollars.trim() ? Number(budgetDollars) : null;
      const result = await updateShowPresetDetails({
        id: preset.id,
        title,
        slug,
        theme,
        description: description.trim() || null,
        durationSeconds: Math.max(1, Math.round(Number(durationSeconds) || 1)),
        budgetCents:
          budgetNumber == null || !Number.isFinite(budgetNumber)
            ? null
            : Math.max(0, Math.round(budgetNumber * 100)),
        timeOfDay: timeOfDay.trim() || null,
        moodTags: toMoodTags(moodTagText),
        isFeatured,
        sortOrder: Math.max(0, Math.round(Number(sortOrder) || 0)),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInitialDetailsKey(detailsKey);
      setDetailsDialogOpen(false);
      toast.success('Preset details saved');
      router.refresh();
    });
  }

  function saveCues() {
    startCuesTransition(async () => {
      const result = await replaceShowPresetCues({
        id: preset.id,
        cues: JSON.parse(serialiseCues(cues)),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInitialCuesKey(serialiseCues(cues));
      toast.success('Timeline saved');
      router.refresh();
    });
  }

  function publish(nextState: boolean) {
    startPublishTransition(async () => {
      const result = await setShowPresetPublished({ id: preset.id, isPublished: nextState });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIsPublished(nextState);
      toast.success(nextState ? 'Preset published' : 'Preset unpublished');
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="grid shrink-0 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section
          ref={fullscreenContainerRef}
          {...fullscreenContainerProps}
          className={cn(
            'bg-stage-night relative overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] text-white',
            isFullscreen
              ? 'fixed inset-[5vmin] z-[100] rounded-2xl border-white/12 shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)]'
              : 'h-[520px]',
          )}
        >
          <LazyFireworkReplayCanvas
            cues={replayCues}
            elapsed={elapsed}
            playbackRef={playbackRef}
            muted={!isPlaying}
            interactive
            controlsVisible={isReplayReady}
            primeSnapshots
            primeOnCueChanges={false}
            showLoadingBar
            onReady={() => setIsReplayReady(true)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30">
            <div className="pointer-events-auto">
              <EditorPreviewTransport
                elapsed={elapsed}
                duration={duration}
                isPlaying={isPlaying}
                fullscreen={isFullscreen}
                loading={!isReplayReady}
                ticks={transportTicks}
                onPlayPause={() => setIsPlaying((current) => !current)}
                onReset={resetPreview}
                onFullscreenToggle={toggleFullscreen}
                onScrub={scrubTo}
              />
            </div>
          </div>
          <div className="pointer-events-none absolute top-4 left-4 z-30 flex flex-wrap items-center gap-2">
            <Badge tone={isPublished ? 'success' : 'neutral'} solid>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
            {isFeatured ? (
              <Badge tone="accent" solid>
                Featured
              </Badge>
            ) : null}
          </div>
        </section>

        <CueInspector
          cue={selectedCue}
          product={selectedProduct}
          busy={isBusy}
          onCueChange={updateSelectedCue}
          onReplaceProduct={openReplacePicker}
          onDuplicate={duplicateSelectedCue}
          onDelete={deleteSelectedCue}
        />
      </div>

      {isFullscreen ? <PreviewFullscreenBackdrop onExit={exitFullscreen} /> : null}

      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
              Timeline
            </h2>
            <p className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
              {cues.length} cues across {formatDuration(duration)}. Drag a cue to change its timing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => openInsertPicker(elapsed)}>
              <PackagePlus size={15} /> Insert catalogue item
            </Button>
            <Button
              size="sm"
              onClick={saveCues}
              loading={isCuesPending}
              disabled={!cuesDirty || unresolvedCueCount > 0 || (isPublished && cues.length === 0)}
            >
              <Save size={15} /> Save timeline
            </Button>
          </div>
        </div>

        {unresolvedCueCount > 0 ? (
          <InlineAlert
            tone="warning"
            title="Some legacy cues need a catalogue item"
            className="mt-4"
          >
            {unresolvedCueCount} saved cue{unresolvedCueCount === 1 ? '' : 's'} could not be matched
            to a product. These cues remain on the timeline, and saving is blocked until each one is
            replaced or removed.
          </InlineAlert>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)]">
          <div
            className="relative"
            style={{ width: timelineWidth, height: timelineHeight + 38 }}
            onDoubleClick={handleTimelineDoubleClick}
          >
            {Array.from({ length: TIMELINE_ROW_COUNT }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="absolute inset-x-0 rounded-md bg-[color:var(--color-bg-surface)]"
                style={{
                  top: rowIndex * (TIMELINE_ROW_HEIGHT_PX + TIMELINE_ROW_GAP_PX),
                  height: TIMELINE_ROW_HEIGHT_PX,
                }}
              >
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-medium tracking-[0.08em] text-[color:var(--color-content-subtle)] uppercase">
                  Pos {rowIndex + 1}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.floor(timelineSeconds) + 1 }).map((_, second) => (
              <div
                key={second}
                className={cn(
                  'absolute top-0 bottom-[38px] border-l',
                  second % 5 === 0
                    ? 'border-[color:var(--color-border-strong)]'
                    : 'border-[color:var(--color-border-subtle)]',
                )}
                style={{ left: second * PX_PER_SECOND }}
              >
                {second % 5 === 0 ? (
                  <span className="absolute top-[calc(100%+6px)] -translate-x-1/2 font-mono text-[10px] text-[color:var(--color-content-subtle)]">
                    {formatTimelineTimestamp(second)}
                  </span>
                ) : null}
              </div>
            ))}
            <div
              className="absolute top-0 bottom-[38px] z-20 w-px bg-[color:var(--accent)] shadow-[0_0_18px_var(--accent)]"
              style={{ left: elapsed * PX_PER_SECOND }}
            />
            {cues.map((cue, index) => (
              <CueTimelineClip
                key={cue.uid}
                cue={cue}
                index={index}
                spec={specsById.get(cue.catalogueItemId)}
                duration={duration}
                selected={cue.uid === selectedCueUid}
                onSelect={() => {
                  setSelectedCueUid(cue.uid);
                  scrubTo(cue.timeSeconds);
                }}
                onMove={moveCue}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] px-4 py-3">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                {title || 'Untitled preset'}
              </h2>
              <Badge tone={isPublished ? 'success' : 'neutral'} solid>
                {isPublished ? 'Published' : 'Draft'}
              </Badge>
              {isFeatured ? (
                <Badge tone="accent" solid>
                  Featured
                </Badge>
              ) : null}
              {detailsDirty ? (
                <Badge tone="warning" solid icon={null}>
                  Unsaved details
                </Badge>
              ) : null}
            </div>
            {description ? (
              <p className="mt-1 truncate text-xs text-[color:var(--color-content-subtle)]">
                {description}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--color-content-subtle)]">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Clock3 size={13} /> {formatDuration(duration)}
              </span>
              <span>{theme || 'No theme'}</span>
              {timeOfDay ? <span>{timeOfDay}</span> : null}
              {budgetDollars.trim() ? <span>${budgetDollars}</span> : null}
              {toMoodTags(moodTagText).length > 0 ? (
                <span>{toMoodTags(moodTagText).length} mood tags</span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDetailsDialogOpen(true)}>
              <Pencil size={14} /> Edit details
            </Button>
            {isPublished ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => publish(false)}
                loading={isPublishPending}
                disabled={isBusy}
              >
                <EyeOff size={14} /> Unpublish
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => publish(true)}
                loading={isPublishPending}
                disabled={isBusy || !canPublish}
              >
                <Eye size={14} /> Publish
              </Button>
            )}
          </div>
        </div>

        {!canPublish && !isPublished ? (
          <InlineAlert tone="info" title="Not ready to publish" className="mt-3">
            Save the details and timeline, then resolve every catalogue cue.
          </InlineAlert>
        ) : null}
      </section>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] !gap-0 overflow-hidden p-0 sm:max-w-[760px]">
          <DialogHeader className="border-b border-[color:var(--color-border-subtle)] px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">Edit preset details</DialogTitle>
            <DialogDescription>
              Keep the public-facing information concise. Less common publishing controls are under
              More settings.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              saveDetails();
            }}
          >
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="preset-title">Title</FieldLabel>
                  <Input
                    id="preset-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="preset-theme">Theme</FieldLabel>
                  <Input
                    id="preset-theme"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="preset-description">Description</FieldLabel>
                <Textarea
                  id="preset-description"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Field>
                  <FieldLabel htmlFor="preset-duration">Duration seconds</FieldLabel>
                  <Input
                    id="preset-duration"
                    type="number"
                    min={1}
                    value={durationSeconds}
                    onChange={(event) => setDurationSeconds(event.target.value)}
                  />
                </Field>
                <label className="flex h-10 items-center gap-2 self-end rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] px-3 text-sm text-[color:var(--color-content-emphasis)]">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(event) => setIsFeatured(event.target.checked)}
                  />
                  Featured on Home
                </label>
              </div>

              <details className="group rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[color:var(--color-content-emphasis)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-strong)] focus-visible:outline-none">
                  <span className="inline-flex items-center gap-2">
                    <Settings2 size={15} /> More settings
                  </span>
                  <ChevronDown
                    size={16}
                    className="text-[color:var(--color-content-subtle)] transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="grid gap-4 border-t border-[color:var(--color-border-subtle)] p-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="preset-slug">Slug</FieldLabel>
                    <Input
                      id="preset-slug"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="preset-budget">Budget dollars</FieldLabel>
                    <Input
                      id="preset-budget"
                      type="number"
                      min={0}
                      step="0.01"
                      value={budgetDollars}
                      onChange={(event) => setBudgetDollars(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="preset-time-of-day">Time of day</FieldLabel>
                    <Input
                      id="preset-time-of-day"
                      value={timeOfDay}
                      onChange={(event) => setTimeOfDay(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="preset-sort-order">Sort order</FieldLabel>
                    <Input
                      id="preset-sort-order"
                      type="number"
                      min={0}
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="preset-mood-tags">Mood tags</FieldLabel>
                    <Input
                      id="preset-mood-tags"
                      value={moodTagText}
                      onChange={(event) => setMoodTagText(event.target.value)}
                    />
                    <FieldHint>Comma-separated tags shown on Home and Explore.</FieldHint>
                  </Field>
                </div>
              </details>
            </div>

            <DialogFooter className="border-t border-[color:var(--color-border-subtle)] px-6 py-4">
              <Button type="button" variant="secondary" onClick={() => setDetailsDialogOpen(false)}>
                Close
              </Button>
              <Button type="submit" loading={isDetailsPending} disabled={!detailsDirty}>
                <Save size={15} /> Save details
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProductPickerDialog
        open={pickerOpen}
        mode={pickerMode}
        products={fireworkSpecs}
        initialSelectedId={pickerMode === 'replace' ? selectedProduct?.id : undefined}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}

function CueTimelineClip({
  cue,
  index,
  spec,
  duration,
  selected,
  onSelect,
  onMove,
}: {
  cue: LocalCue;
  index: number;
  spec: FireworkSpecification | undefined;
  duration: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (uid: string, seconds: number, commit: boolean) => void;
}) {
  const dragRef = useRef<{ startX: number; startTime: number; moved: boolean } | null>(null);
  const palette = paletteOf(spec);

  function timeFromPointer(clientX: number): number {
    const drag = dragRef.current;
    if (!drag) return cue.timeSeconds;
    return clamp(drag.startTime + (clientX - drag.startX) / PX_PER_SECOND, 0, duration);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startTime: cue.timeSeconds, moved: false };
    onSelect();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const movedPixels = event.clientX - drag.startX;
    if (Math.abs(movedPixels) > 3) drag.moved = true;
    if (!drag.moved) return;
    onMove(cue.uid, timeFromPointer(event.clientX), false);
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const finalTime = drag
      ? clamp(drag.startTime + (event.clientX - drag.startX) / PX_PER_SECOND, 0, duration)
      : cue.timeSeconds;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (drag?.moved) onMove(cue.uid, finalTime, true);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn(
        'absolute z-10 flex cursor-grab touch-none items-center gap-2 overflow-hidden rounded-md border px-2 text-left text-xs font-medium text-white shadow-sm transition-[border-color,box-shadow] active:cursor-grabbing',
        selected ? 'border-white ring-2 ring-white/50' : 'border-white/15 hover:border-white/60',
      )}
      style={{
        left: cue.timeSeconds * PX_PER_SECOND,
        top:
          cue.launchPositionIndex * (TIMELINE_ROW_HEIGHT_PX + TIMELINE_ROW_GAP_PX) +
          TIMELINE_INSET_PX,
        width: Math.max(MIN_CLIP_PX, cueVisualSeconds(spec) * PX_PER_SECOND),
        height: TIMELINE_ROW_HEIGHT_PX - TIMELINE_INSET_PX * 2,
        background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`,
      }}
      title={`${formatTimelineTimestamp(cue.timeSeconds)} ${spec?.name ?? cue.description}`}
      aria-pressed={selected}
      aria-label={`${spec?.name ?? cue.description} at ${cue.timeSeconds.toFixed(1)} seconds`}
    >
      <span className="font-mono text-[10px] opacity-80">{index + 1}</span>
      <span className="truncate">{spec?.name ?? cue.description}</span>
    </button>
  );
}

function CueInspector({
  cue,
  product,
  busy,
  onCueChange,
  onReplaceProduct,
  onDuplicate,
  onDelete,
}: {
  cue: LocalCue | null;
  product: FireworkSpecification | undefined;
  busy: boolean;
  onCueChange: (patch: Partial<LocalCue>) => void;
  onReplaceProduct: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (!cue) {
    return (
      <aside className="flex max-h-[520px] min-h-0 flex-col justify-between rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            Cue inspector
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-content-subtle)]">
            Select a timeline clip or insert a catalogue item to start editing cue timing.
          </p>
        </div>
        <Badge tone="neutral">No cue selected</Badge>
      </aside>
    );
  }

  const palette = paletteOf(product);

  return (
    <aside className="flex max-h-[520px] min-h-0 flex-col overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)]">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
              Cue inspector
            </h2>
            <p className="mt-1 truncate text-xs text-[color:var(--color-content-subtle)]">
              {product ? productLabel(product) : 'Unresolved catalogue item'}
            </p>
          </div>
          {product ? (
            <Badge tone={productKindOf(product) === 'multishot' ? 'accent' : 'info'} solid>
              {productKindOf(product)}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-3">
          <span
            className="h-9 w-9 shrink-0 rounded-md border border-white/10"
            style={{
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
              {product?.name ?? cue.catalogueItemSlug}
            </p>
            <p className="mt-0.5 truncate text-xs text-[color:var(--color-content-subtle)]">
              {product ? productSummary(product) : 'Needs a catalogue item'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 px-2"
            onClick={onReplaceProduct}
          >
            <PackagePlus size={14} /> Change
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="cue-time">Fires at</FieldLabel>
            <Input
              id="cue-time"
              type="number"
              min={0}
              step="0.1"
              className="font-mono tabular-nums"
              value={cue.timeSeconds}
              onChange={(event) => onCueChange({ timeSeconds: Number(event.target.value) })}
            />
          </Field>

          <Field>
            <FieldLabel>Position</FieldLabel>
            <SelectField
              value={String(cue.launchPositionIndex)}
              onChange={(value) => onCueChange({ launchPositionIndex: Number(value) })}
              options={[
                { value: '0', label: 'Position 1' },
                { value: '1', label: 'Position 2' },
                { value: '2', label: 'Position 3' },
              ]}
            />
          </Field>
        </div>

        <details className="group rounded-lg border border-[color:var(--color-border-subtle)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-medium text-[color:var(--color-content-emphasis)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-strong)] focus-visible:outline-none">
            Cue options
            <ChevronDown
              size={15}
              className="text-[color:var(--color-content-subtle)] transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-[color:var(--color-border-subtle)] p-3">
            <Field>
              <FieldLabel>Emphasis</FieldLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'accent', 'peak'] as const).map((emphasis) => (
                  <button
                    key={emphasis}
                    type="button"
                    aria-pressed={cue.emphasis === emphasis}
                    onClick={() => onCueChange({ emphasis })}
                    className={cn(
                      'focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-xs font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2',
                      cue.emphasis === emphasis
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {emphasis}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </details>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-3">
        <Button variant="secondary" onClick={onDuplicate} disabled={busy}>
          <Copy size={14} /> Duplicate
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={busy}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </aside>
  );
}

function ProductPickerDialog({
  open,
  mode,
  products,
  initialSelectedId,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  mode: ProductPickerMode;
  products: FireworkSpecification[];
  initialSelectedId?: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: FireworkSpecification) => void;
}) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ProductKindFilter>('all');
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? '');
  const [previewElapsed, setPreviewElapsed] = useState(0.4);
  const previewRef = useRef(0.4);
  const selectedProduct = products.find((product) => product.id === selectedId);
  const filteredProducts = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return products
      .filter((product) => kindFilter === 'all' || productKindOf(product) === kindFilter)
      .filter((product) => {
        if (!normalised) return true;
        return [product.name, product.slug, product.baseEffect?.name, product.variant?.slug]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalised);
      })
      .slice(0, 80);
  }, [kindFilter, products, query]);
  const previewCue: ReplayCue[] = selectedProduct
    ? [
        {
          id: `picker-${selectedProduct.id}`,
          position: 1,
          timeSeconds: 0.4,
          description: selectedProduct.name,
          productId: selectedProduct.id,
          launchPositionIndex: 1,
          emphasis: productKindOf(selectedProduct) === 'multishot' ? 'accent' : 'normal',
          firework: selectedProduct,
        },
      ]
    : [];

  useEffect(() => {
    if (!open) return;
    const initialProduct = products.find((product) => product.id === initialSelectedId);
    setSelectedId(initialProduct?.id ?? products[0]?.id ?? '');
    setQuery('');
    setKindFilter('all');
  }, [initialSelectedId, open, products]);

  useEffect(() => {
    if (!open || filteredProducts.some((product) => product.id === selectedId)) return;
    setSelectedId(filteredProducts[0]?.id ?? '');
  }, [filteredProducts, open, selectedId]);

  useEffect(() => {
    if (!open) return;
    const started = performance.now();
    let frame = 0;
    function tick(now: number) {
      const next = ((now - started) / 1000) % 4;
      previewRef.current = next;
      setPreviewElapsed(next);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, selectedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] !gap-0 overflow-y-auto p-0 sm:max-w-[min(1200px,calc(100vw-2rem))] lg:overflow-hidden">
        <DialogHeader className="border-b border-[color:var(--color-border-subtle)] px-6 py-5">
          <DialogTitle className="text-lg">
            {mode === 'insert' ? 'Insert catalogue item' : 'Replace catalogue item'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] px-6 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              iconLeft={<Search size={16} />}
              placeholder="Filter by name or effect..."
              aria-label="Search catalogue"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div
            role="group"
            aria-label="Filter catalogue type"
            className="inline-flex shrink-0 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-1"
          >
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'firework', label: 'Fireworks' },
                { value: 'multishot', label: 'Multishots' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={kindFilter === option.value}
                onClick={() => setKindFilter(option.value)}
                className={cn(
                  'focus-visible:ring-ring/50 h-8 rounded px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2',
                  kindFilter === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:h-[min(560px,calc(100dvh-14rem))] lg:min-h-0 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
          <div className="flex min-h-0 flex-col border-b border-[color:var(--color-border-subtle)] lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 text-xs text-[color:var(--color-content-subtle)]">
              <span>{filteredProducts.length} items</span>
              <span>Name and type</span>
            </div>
            <div
              role="listbox"
              aria-label="Catalogue items"
              className="max-h-[min(360px,45dvh)] min-h-0 flex-1 overflow-y-auto lg:max-h-none"
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const selected = product.id === selectedProduct?.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onPointerEnter={() => setSelectedId(product.id)}
                      onFocus={() => setSelectedId(product.id)}
                      onClick={() => setSelectedId(product.id)}
                      className={cn(
                        'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 text-left text-sm transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-inset',
                        selected
                          ? 'bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-emphasis)]'
                          : 'hover:bg-[color:var(--color-bg-muted)]',
                      )}
                    >
                      <span className="min-w-0 truncate font-medium">{product.name}</span>
                      <Badge tone={productKindOf(product) === 'multishot' ? 'accent' : 'neutral'}>
                        {productKindOf(product)}
                      </Badge>
                    </button>
                  );
                })
              ) : (
                <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
                  <Search size={18} className="text-[color:var(--color-content-subtle)]" />
                  <p className="mt-2 text-sm font-medium text-[color:var(--color-content-emphasis)]">
                    No matching items
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="bg-stage-night relative min-h-[360px] overflow-hidden">
            {selectedProduct ? (
              <LazyFireworkReplayCanvas
                cues={previewCue}
                elapsed={previewElapsed}
                playbackRef={previewRef}
                muted
                interactive
                controlsVisible={false}
                showCameraControls={false}
                primeSnapshots={false}
                showLoadingBar={false}
              />
            ) : (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-white/60">
                Select an item to preview it
              </div>
            )}
            <div className="pointer-events-none absolute top-4 left-4">
              <Badge tone="accent" solid>
                <Sparkles size={12} /> Effect preview
              </Badge>
            </div>
            {selectedProduct ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-5 pt-16 pb-5 text-white">
                <h3 className="line-clamp-2 text-base font-semibold">{selectedProduct.name}</h3>
                <p className="mt-1 text-xs text-white/70">
                  {productKindOf(selectedProduct)} ·{' '}
                  {formatDuration(selectedProduct.durationSeconds)}
                </p>
              </div>
            ) : null}
          </aside>
        </div>

        <DialogFooter className="border-t border-[color:var(--color-border-subtle)] px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedProduct}
            onClick={() => selectedProduct && onSelect(selectedProduct)}
          >
            {mode === 'insert' ? 'Insert item' : 'Use this item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
