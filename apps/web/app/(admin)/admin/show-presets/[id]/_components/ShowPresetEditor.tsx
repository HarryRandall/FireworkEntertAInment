'use client';

/** Curated show preset editor: replay, timeline, catalogue insertion and publish controls. */

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  PackagePlus,
  Pencil,
  Save,
  Settings2,
} from 'lucide-react';
import {
  replaceShowPresetCues,
  setShowPresetPublished,
  updateShowPresetDetails,
} from '@/app/(admin)/admin/show-presets/actions';
import { useAdminBreadcrumbOverride } from '@/ui/shell/AdminShell';
import { EditorPreviewTransport } from '@/ui/firework-editor/FireworkEditorShell';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/ui/firework-editor/previewFullscreen';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldHint, FieldLabel } from '@/ui/patterns/Field';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { Input, Textarea } from '@/ui/patterns/Input';
import { toast } from '@/ui/patterns/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog';
import type { AdminShowPresetDetail } from '@/lib/admin.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import { clamp, cn } from '@/lib/utils';
import {
  PX_PER_SECOND,
  TIMELINE_ROW_COUNT,
  TIMELINE_ROW_HEIGHT_PX,
  TIMELINE_ROW_GAP_PX,
  MIN_TIMELINE_SECONDS,
  LocalCue,
  ProductPickerMode,
  makeCueUid,
  normaliseCueTime,
  normaliseLaunchPositionIndex,
  cueDurationOf,
  buildProductLookup,
  toLocalCue,
  serialiseCues,
  formatTimelineTimestamp,
  detailsSnapshot,
  toMoodTags,
  toReplayCues,
  buildNewCue,
} from './show-preset-model';
import { CueTimelineClip } from './ShowPresetCueTimelineClip';
import { CueInspector } from './ShowPresetCueInspector';
import { ProductPickerDialog } from './ShowPresetProductPicker';
import { LazyFireworkReplayCanvas } from './ShowPresetReplayCanvas';

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
            'bg-stage-night border-border relative overflow-hidden rounded-lg border text-white',
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

      <section className="border-border bg-card rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Timeline</h2>
            <p className="text-muted-foreground mt-1 text-xs">
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

        <div className="border-border bg-muted mt-4 overflow-x-auto rounded-lg border">
          <div
            className="relative"
            style={{ width: timelineWidth, height: timelineHeight + 38 }}
            onDoubleClick={handleTimelineDoubleClick}
          >
            {Array.from({ length: TIMELINE_ROW_COUNT }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="bg-card absolute inset-x-0 rounded-md"
                style={{
                  top: rowIndex * (TIMELINE_ROW_HEIGHT_PX + TIMELINE_ROW_GAP_PX),
                  height: TIMELINE_ROW_HEIGHT_PX,
                }}
              >
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-medium tracking-[0.08em] uppercase">
                  Pos {rowIndex + 1}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.floor(timelineSeconds) + 1 }).map((_, second) => (
              <div
                key={second}
                className={cn(
                  'absolute top-0 bottom-[38px] border-l',
                  second % 5 === 0 ? 'border-border-emphasis' : 'border-border',
                )}
                style={{ left: second * PX_PER_SECOND }}
              >
                {second % 5 === 0 ? (
                  <span className="text-muted-foreground absolute top-[calc(100%+6px)] -translate-x-1/2 font-mono text-[10px]">
                    {formatTimelineTimestamp(second)}
                  </span>
                ) : null}
              </div>
            ))}
            <div
              className="bg-accent absolute top-0 bottom-[38px] z-20 w-px shadow-[0_0_18px_var(--accent)]"
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

      <section className="border-border bg-card rounded-lg border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-foreground truncate text-sm font-semibold">
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
              <p className="text-muted-foreground mt-1 truncate text-xs">{description}</p>
            ) : null}
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
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
          <DialogHeader className="border-border border-b px-6 pt-6 pb-4">
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
                <label className="border-border bg-muted text-foreground flex h-10 items-center gap-2 self-end rounded-md border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(event) => setIsFeatured(event.target.checked)}
                  />
                  Featured on Home
                </label>
              </div>

              <details className="group border-border bg-muted rounded-lg border">
                <summary className="text-foreground focus-visible:ring-border-emphasis flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
                  <span className="inline-flex items-center gap-2">
                    <Settings2 size={15} /> More settings
                  </span>
                  <ChevronDown
                    size={16}
                    className="text-muted-foreground transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="border-border grid gap-4 border-t p-4 sm:grid-cols-2">
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

            <DialogFooter className="border-border border-t px-6 py-4">
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
