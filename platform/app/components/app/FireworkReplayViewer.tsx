'use client';

/**
 * FireworkReplayViewer: interactive replay and cue editor used on the
 * authenticated show detail route. Wraps the 3D canvas with audio sync
 * controls and server actions for adding / deleting preview cues.
 * Cue mutations go through preview-cues server actions which reject
 * overlaps on the same launch position.
 */
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { ChevronLeft, ChevronRight, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  addPreviewCueAction,
  deletePreviewCueAction,
  type CueActionResult,
} from '@/app/actions/preview-cues';
import {
  usePreviewFullscreen,
  PreviewFullscreenBackdrop,
} from '@/app/components/admin/previewFullscreen';
import { ReplayLoadingBar } from '@/app/components/app/ReplayLoadingBar';
import { ReplayStageBackdrop } from '@/app/components/app/ReplayStageBackdrop';
import { ReplayTransportControls } from '@/app/components/app/ReplayTransportControls';
import { Eyebrow } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { NumberInput } from '@/app/components/ui/NumberInput';
import { RowActionsMenu } from '@/app/components/ui/RowActionsMenu';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatDuration, formatTotal } from '@/lib/show-domain';
import type { LaunchPosition } from '@/lib/fireworks/design';
import {
  clearPersistedGenerationCover,
  clearPersistedGenerationStart,
} from '@/lib/generation-progress-storage';
import { cn } from '@/lib/utils';

const REFINEMENT_CREDIT_COST = 2;

type ReplayExtras = {
  specifications: FireworkSpecification[];
  audioUrl: string | null;
};

type FireworkReplayViewerProps = {
  showId: string;
  showSlug: string;
  showName: string;
  durationSeconds: number | null;
  totalCents?: number | null;
  launchPositions: LaunchPosition[];
  canEditFireworks?: boolean;
  /** Server-streamed replay cues. Resolved on the client via `use()` so the
   * canvas can mount with an empty scene immediately and populate fireworks
   * the moment the cues land, without waiting on the heavier catalogue. */
  replayCuesPromise: Promise<ReplayCue[]>;
  /** Server-streamed catalogue specifications and signed audio URL. These are
   * only needed for the add-firework dialog and audio playback, so they stream
   * separately and never gate the fireworks. */
  replayExtrasPromise: Promise<ReplayExtras>;
};

type CueDialogTab = 'manual' | 'ai';

type CueDeletionTarget = {
  cueId: string;
  fireworkName: string;
  timeLabel: string;
};

const LAUNCH_POSITION_OPTIONS = [
  { value: '0', label: 'Mortar 1 (left)' },
  { value: '1', label: 'Mortar 2 (centre)' },
  { value: '2', label: 'Mortar 3 (right)' },
];
const PLAYBACK_CONTROL_IDLE_MS = 1800;
// Coalesce heavyweight `elapsed` commits during a timeline drag to ~15Hz so a
// fast scrub does not re-render the whole viewer on every input event. The
// slider thumb and the engine ref still update at full input rate.
const SCRUB_COMMIT_INTERVAL_MS = 67;
// Stable empty defaults so the canvas's `cues` effect doesn't re-fire on every
// render while the streamed replay data is still pending.
const EMPTY_CUES: ReplayCue[] = [];
const EMPTY_SPECS: FireworkSpecification[] = [];

function ReplayCanvasPlaceholder() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-[#020409]"
      aria-label="Loading preview"
    >
      <ReplayStageBackdrop />
      <ReplayLoadingBar progress={null} position="bottom" />
    </div>
  );
}

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => null,
  },
);

function EmptyPreview() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-8 text-center">
      <div className="border-outline-variant/15 bg-surface-container-low/85 max-w-md rounded-2xl border p-6 backdrop-blur">
        <Sparkles className="text-primary mx-auto mb-4" size={28} />
        <h2 className="text-on-surface text-xl font-bold">No typed fireworks yet</h2>
        <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">
          Add a cue below to preview the show.
        </p>
      </div>
    </div>
  );
}

function isTubeBusyError(result: CueActionResult): boolean {
  return !result.ok && /^Tube \d+ is busy from /.test(result.error);
}

/**
 * Resolves a streamed promise inside a Suspense boundary and pushes the
 * result up to the viewer once it lands, so the canvas can mount with an
 * empty scene immediately and populate when each payload is ready.
 */
function StreamedDataReader<T>({
  promise,
  onLoaded,
}: {
  promise: Promise<T>;
  onLoaded: (data: T) => void;
}) {
  const data = use(promise);
  useEffect(() => {
    onLoaded(data);
  }, [data, onLoaded]);
  return null;
}

export function FireworkReplayViewer({
  showId,
  showSlug,
  showName,
  durationSeconds,
  totalCents = null,
  launchPositions,
  canEditFireworks = false,
  replayCuesPromise,
  replayExtrasPromise,
}: FireworkReplayViewerProps) {
  const [streamedCues, setStreamedCues] = useState<ReplayCue[] | null>(null);
  const [replayExtras, setReplayExtras] = useState<ReplayExtras | null>(null);
  const cues = streamedCues ?? EMPTY_CUES;
  const specifications = replayExtras?.specifications ?? EMPTY_SPECS;
  const audioUrl = replayExtras?.audioUrl ?? null;
  const replayDataReady = streamedCues !== null;
  const hasFireworkSpecifications = specifications.length > 0;
  const handleReplayCuesLoaded = useCallback((data: ReplayCue[]) => {
    setStreamedCues(data);
  }, []);
  const handleReplayExtrasLoaded = useCallback((data: ReplayExtras) => {
    setReplayExtras(data);
  }, []);
  const [optimisticCues, addOptimisticCue] = useOptimistic(
    cues,
    (current: ReplayCue[], pending: ReplayCue) =>
      [...current, pending].sort((a, b) => a.timeSeconds - b.timeSeconds),
  );
  const inferredDuration =
    optimisticCues.length > 0 ? Math.max(...optimisticCues.map((cue) => cue.timeSeconds)) + 5 : 30;
  const duration = Math.max(durationSeconds ?? inferredDuration, inferredDuration);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [playbackControlsActive, setPlaybackControlsActive] = useState(true);
  const [actionResult, setActionResult] = useState<CueActionResult | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(
    specifications[0]?.id,
  );
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [cueDialogTab, setCueDialogTab] = useState<CueDialogTab>('manual');
  const [insertBeforeTime, setInsertBeforeTime] = useState<number | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [cuePage, setCuePage] = useState(0);
  const [cueToDelete, setCueToDelete] = useState<CueDeletionTarget | null>(null);
  const [deletingCueId, setDeletingCueId] = useState<string | null>(null);
  const CUES_PER_PAGE = 5;
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(0);
  const elapsedRef = useRef(elapsed);
  const lastUIElapsedRef = useRef(elapsed);
  const lastScrubCommitRef = useRef(0);
  const pendingScrubRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoplayStartedRef = useRef(false);
  const deletingCueIdRef = useRef<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const firstProductId = specifications[0]?.id;
    if (!firstProductId) {
      setSelectedProductId(undefined);
      return;
    }
    if (!selectedProductId || !specifications.some((spec) => spec.id === selectedProductId)) {
      setSelectedProductId(firstProductId);
    }
  }, [selectedProductId, specifications]);

  // Fullscreen overlay for the replay player. The hook owns the Esc + body
  // scroll-lock wiring; this component applies the overlay classes to the
  // player container and renders the shared backdrop.
  const {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    fullscreenContainerRef,
    fullscreenContainerProps,
  } = usePreviewFullscreen({ dialogLabel: `${showName} preview` });

  // Keep the audio element in sync with playhead and play/pause state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      const drift = Math.abs(audio.currentTime - elapsedRef.current);
      if (drift > 0.25) audio.currentTime = elapsedRef.current;
      void audio.play().catch(() => {
        /* Autoplay was blocked or seeking was interrupted, so playback stays paused. */
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Keep paused audio aligned with the playhead (e.g. cue-row jumps). While a
  // drag is mid-flight the media element is left alone, because seeking it at
  // 15 Hz forces repeated decodes. commitScrub seeks it once on release.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying) return;
    if (pendingScrubRef.current != null) return;
    if (Math.abs(audio.currentTime - elapsed) > 0.1) {
      audio.currentTime = elapsed;
    }
  }, [elapsed, isPlaying]);

  // While playing, the RAF loop owns elapsedRef and writes it at 60Hz, and
  // while scrubbing the drag handler owns it at input rate; mirroring the
  // throttled 15Hz React state back on top in either case would step the
  // engine backwards mid-gesture and force spurious snapshot restores.
  useEffect(() => {
    if (!isPlaying && pendingScrubRef.current == null) {
      elapsedRef.current = elapsed;
      lastUIElapsedRef.current = elapsed;
    }
  }, [elapsed, isPlaying]);

  useEffect(() => {
    if (searchParams.get('cueDialog') !== 'ai') return;
    setCueDialogTab('ai');
    setShowAddForm(true);
    router.replace(`/shows/${showSlug}/preview`, { scroll: false });
  }, [router, searchParams, showSlug]);

  useEffect(() => {
    if (playbackControlsTimer.current) clearTimeout(playbackControlsTimer.current);
    setPlaybackControlsActive(true);
    if (isPlaying) {
      playbackControlsTimer.current = setTimeout(
        () => setPlaybackControlsActive(false),
        PLAYBACK_CONTROL_IDLE_MS,
      );
    }
    return () => {
      if (playbackControlsTimer.current) clearTimeout(playbackControlsTimer.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current = elapsedRef.current;
    lastUIElapsedRef.current = elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const dtFromStart = (now - startedAt.current) / 1000;
      const audio = audioRef.current;
      const audioTime =
        audio && !audio.paused && !audio.ended && Number.isFinite(audio.currentTime)
          ? audio.currentTime
          : null;
      // Browsers throttle/pause RAF on hidden tabs but performance.now() keeps
      // ticking. Without this re-anchor we'd leap the playhead by however long
      // the tab was backgrounded and force the engine into a full replay.
      if (audioTime == null && dtFromStart > 0.5) {
        startedAt.current = now;
        playheadStart.current = elapsedRef.current;
        frame = requestAnimationFrame(tick);
        return;
      }
      // When soundtrack audio exists it is the playback clock. Driving both
      // the renderer and transport from media currentTime prevents cumulative
      // wall-clock drift between a correctly planned burst and its beat.
      const next = Math.min(duration, audioTime ?? playheadStart.current + dtFromStart);
      if (audioTime != null) {
        startedAt.current = now;
        playheadStart.current = next;
      }
      // 60Hz drive for the engine and timeline via the ref; React state
      // (active cue, table highlight) is throttled to ~15Hz. The transport
      // thumb self-animates from the same ref, so no per-frame state here.
      elapsedRef.current = next;
      if (next >= duration || next - lastUIElapsedRef.current >= 0.067) {
        lastUIElapsedRef.current = next;
        setElapsed(next);
      }
      if (next >= duration) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying]);

  const sortedCues = useMemo(
    () => [...optimisticCues].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [optimisticCues],
  );
  const productNameById = useMemo(
    () => new Map(specifications.map((spec) => [spec.id, spec.name])),
    [specifications],
  );
  const selectedProduct = useMemo(
    () => specifications.find((spec) => spec.id === selectedProductId),
    [selectedProductId, specifications],
  );

  // Collapse expanded shots back to one row per show_cue for the builder list.
  // Multi-shot IDs are "{baseCueId}-shot-N"; single-shot IDs are just the UUID.
  const builderCues = useMemo(() => {
    const seen = new Map<
      string,
      { cue: ReplayCue; baseCueId: string; shotCount: number; endTimeSeconds: number }
    >();
    for (const cue of sortedCues) {
      const baseCueId = cue.id.replace(/-shot-\d+$/, '');
      const shotEnd = cue.timeSeconds + Math.max(cue.firework.durationSeconds ?? 0.5, 0.5);
      if (!seen.has(baseCueId)) {
        seen.set(baseCueId, { cue, baseCueId, shotCount: 1, endTimeSeconds: shotEnd });
      } else {
        const row = seen.get(baseCueId)!;
        row.shotCount += 1;
        row.endTimeSeconds = Math.max(row.endTimeSeconds, shotEnd);
      }
    }
    return Array.from(seen.values());
  }, [sortedCues]);

  const pageCount = Math.max(1, Math.ceil(builderCues.length / CUES_PER_PAGE));
  const safePage = Math.min(cuePage, pageCount - 1);
  const visibleBuilderCues = useMemo(
    () => builderCues.slice(safePage * CUES_PER_PAGE, safePage * CUES_PER_PAGE + CUES_PER_PAGE),
    [builderCues, safePage],
  );
  const emptyBuilderCueSlots = Math.max(0, CUES_PER_PAGE - visibleBuilderCues.length);

  const activeCue = useMemo(() => {
    for (let i = sortedCues.length - 1; i >= 0; i--) {
      if (sortedCues[i].timeSeconds <= elapsed + 0.35) return sortedCues[i];
    }
    return undefined;
  }, [sortedCues, elapsed]);

  const activeBaseCueId = activeCue?.id.replace(/-shot-\d+$/, '');
  const activeBaseCueIds = useMemo(() => {
    const active = new Set<string>();
    if (activeBaseCueId) active.add(activeBaseCueId);
    for (const row of builderCues) {
      if (row.shotCount <= 1) continue;
      if (elapsed + 0.05 >= row.cue.timeSeconds && elapsed <= row.endTimeSeconds + 0.35) {
        active.add(row.baseCueId);
      }
    }
    return active;
  }, [activeBaseCueId, builderCues, elapsed]);
  const activeBuilderIndex = useMemo(
    () =>
      activeBaseCueId ? builderCues.findIndex((row) => row.baseCueId === activeBaseCueId) : -1,
    [builderCues, activeBaseCueId],
  );

  useEffect(() => {
    if (activeBuilderIndex < 0) return;
    const targetPage = Math.floor(activeBuilderIndex / CUES_PER_PAGE);
    setCuePage((current) => (current === targetPage ? current : targetPage));
  }, [activeBuilderIndex]);

  const hasReplayCues = optimisticCues.length > 0;
  // The timeline slider stays hidden until the streamed replay data has landed
  // and the engine has finished priming the show's fireworks; until then the
  // loading bar owns the control bar slot so there is no layout shift when it
  // swaps in. The empty scene is shown as soon as the canvas mounts, via
  // `isSceneReady`, so the stage is visible (and orbitable) while loading.
  const replayReady = replayDataReady && isCanvasReady;
  const playbackControlsVisible = !isPlaying || playbackControlsActive;

  // Drop the session-scoped generating progress once an autoplayed generated
  // preview becomes watchable. The URL cleanup effect below strips the query.
  const replayReadyCleanupRef = useRef(false);
  useEffect(() => {
    if (!replayReady || replayReadyCleanupRef.current) return;
    if (searchParams.get('autoplay') !== '1') return;
    replayReadyCleanupRef.current = true;
    clearPersistedGenerationStart(showSlug);
    clearPersistedGenerationCover(showSlug);
  }, [replayReady, searchParams, showSlug]);

  function wakePlaybackControls() {
    if (!isPlaying) {
      setPlaybackControlsActive(true);
      return;
    }
    setPlaybackControlsActive(true);
    if (playbackControlsTimer.current) clearTimeout(playbackControlsTimer.current);
    playbackControlsTimer.current = setTimeout(
      () => setPlaybackControlsActive(false),
      PLAYBACK_CONTROL_IDLE_MS,
    );
  }

  function togglePlayback() {
    if (!hasReplayCues) return;
    if (isPlaying) {
      const pauseAt = Math.max(0, Math.min(duration, elapsedRef.current));
      startedAt.current = null;
      playheadStart.current = pauseAt;
      lastUIElapsedRef.current = pauseAt;
      elapsedRef.current = pauseAt;
      setElapsed(pauseAt);
      setIsPlaying(false);
      return;
    }
    if (elapsedRef.current >= duration) seekTo(0, false);
    setIsPlaying(true);
  }

  function restart() {
    setIsPlaying(false);
    seekTo(0, false);
  }

  function seekTo(timeSeconds: number, continuePlaying = isPlaying) {
    const next = Math.max(0, Math.min(duration, timeSeconds));
    elapsedRef.current = next;
    lastUIElapsedRef.current = next;
    playheadStart.current = next;
    startedAt.current = continuePlaying ? performance.now() : null;
    if (audioRef.current && Math.abs(audioRef.current.currentTime - next) > 0.1) {
      audioRef.current.currentTime = next;
    }
    setElapsed(next);
  }

  function scrubTo(timeSeconds: number) {
    const next = Math.max(0, Math.min(duration, timeSeconds));
    // Engine + slider thumb track the drag at full rate via the ref (the
    // transport owns its thumb while dragging); the heavyweight `elapsed`
    // state (active cue, table highlight, canvas prop) is coalesced to ~15Hz
    // so a fast drag does not re-render the whole viewer on every input event.
    elapsedRef.current = next;
    pendingScrubRef.current = next;
    setIsScrubbing(true);
    const now = performance.now();
    if (now - lastScrubCommitRef.current >= SCRUB_COMMIT_INTERVAL_MS) {
      lastScrubCommitRef.current = now;
      lastUIElapsedRef.current = next;
      setElapsed(next);
    }
  }

  function commitScrub() {
    setIsScrubbing(false);
    const pending = pendingScrubRef.current;
    if (pending == null) return;
    pendingScrubRef.current = null;
    lastScrubCommitRef.current = 0;
    seekTo(pending, false);
  }

  function playFrom(timeSeconds: number) {
    seekTo(timeSeconds, true);
    setIsPlaying(true);
  }

  useEffect(() => {
    if (searchParams.get('autoplay') !== '1') return;
    if (autoplayStartedRef.current || !hasReplayCues || !isCanvasReady) return;
    autoplayStartedRef.current = true;
    elapsedRef.current = 0;
    lastUIElapsedRef.current = 0;
    playheadStart.current = 0;
    startedAt.current = performance.now();
    if (audioRef.current && Math.abs(audioRef.current.currentTime) > 0.1) {
      audioRef.current.currentTime = 0;
    }
    setElapsed(0);
    setIsPlaying(true);
    router.replace(`/shows/${showSlug}/preview`, { scroll: false });
  }, [hasReplayCues, isCanvasReady, router, searchParams, showSlug]);

  function openCueDialog(tab: CueDialogTab, prompt?: string) {
    if (!hasFireworkSpecifications) return;
    setCueDialogTab(tab);
    if (prompt !== undefined) setAiPrompt(prompt);
    setShowAddForm(true);
  }

  function addCue(formData: FormData) {
    const productId = String(formData.get('productId') ?? '');
    const product = specifications.find((s) => s.id === productId);
    const description = product?.name ?? '';
    const timeSeconds = Number(formData.get('timeSeconds') ?? 0);
    const launchPositionIndex = Number(formData.get('launchPositionIndex') ?? 0);
    if (product) formData.set('description', product.name);

    formRef.current?.reset();
    setShowAddForm(false);
    setInsertBeforeTime(null);

    startTransition(async () => {
      if (product) {
        addOptimisticCue({
          id: `optimistic-${Date.now()}`,
          position: optimisticCues.length,
          timeSeconds,
          description,
          productId,
          launchPositionIndex,
          firework: product,
        });
      }
      const result = await addPreviewCueAction(formData);
      setActionResult(isTubeBusyError(result) ? null : result);
    });
  }

  function applyRefinement(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt) return;

    const parsed = parsePromptToCue(prompt, specifications, duration, elapsed);
    if (!parsed) {
      toast.error('Could not parse that prompt yet', {
        description:
          'Try something like "add green firework at the start" or "red strobe at 1:20".',
      });
      return;
    }

    const { product, timeSeconds, launchPositionIndex, description } = parsed;
    const formData = new FormData();
    formData.set('showId', showId);
    formData.set('showSlug', showSlug);
    formData.set('productId', product.id);
    formData.set('timeSeconds', String(timeSeconds));
    formData.set('launchPositionIndex', String(launchPositionIndex));
    formData.set('description', description);
    formData.set('aiCreditAction', 'show_refinement');
    formData.set('aiCreditReferenceId', crypto.randomUUID());
    formData.set('refinementPrompt', prompt);

    setRefinePrompt('');
    setAiPrompt('');
    setShowAddForm(false);
    setInsertBeforeTime(null);
    const refinementToastId = toast.loading(
      `Adding ${product.name} at ${formatDuration(timeSeconds)}...`,
    );

    startTransition(async () => {
      addOptimisticCue({
        id: `optimistic-${Date.now()}`,
        position: optimisticCues.length,
        timeSeconds,
        description,
        productId: product.id,
        launchPositionIndex,
        firework: product,
      });
      const result = await addPreviewCueAction(formData);
      if (!result.ok && isTubeBusyError(result)) {
        setActionResult(null);
        toast.error(result.error, { id: refinementToastId });
        return;
      }
      setActionResult(result);
      if (!result.ok) {
        toast.error(result.error, { id: refinementToastId });
        return;
      }
      toast.success(`Added ${product.name} at ${formatDuration(timeSeconds)}`, {
        id: refinementToastId,
      });
    });
  }

  function requestCueDeletion(target: CueDeletionTarget) {
    if (deletingCueIdRef.current !== null) return;
    setCueToDelete(target);
  }

  function deleteCue() {
    const target = cueToDelete;
    if (!target || deletingCueIdRef.current !== null) return;

    deletingCueIdRef.current = target.cueId;
    setDeletingCueId(target.cueId);
    const formData = new FormData();
    formData.set('cueId', target.cueId);
    formData.set('showSlug', showSlug);
    startTransition(async () => {
      try {
        setActionResult(await deletePreviewCueAction(formData));
        setCueToDelete(null);
      } finally {
        deletingCueIdRef.current = null;
        setDeletingCueId(null);
      }
    });
  }

  return (
    <>
      <Suspense fallback={null}>
        <StreamedDataReader promise={replayCuesPromise} onLoaded={handleReplayCuesLoaded} />
      </Suspense>
      <Suspense fallback={null}>
        <StreamedDataReader promise={replayExtrasPromise} onLoaded={handleReplayExtrasLoaded} />
      </Suspense>
      <div className="space-y-6">
        <Card
          elevation="low"
          radius="lg"
          bordered={!isFullscreen}
          className={cn(
            'overflow-hidden bg-gradient-to-b p-0',
            isFullscreen
              ? 'h-0 border-0 bg-transparent p-0 shadow-none'
              : 'from-surface-container-high via-surface-container to-surface-container-low shadow-[var(--shadow-card-hover)]',
          )}
        >
          <div
            ref={fullscreenContainerRef}
            {...fullscreenContainerProps}
            className={cn(
              'group/replay',
              isFullscreen
                ? 'border-outline-variant/25 fixed inset-[5vmin] z-[100] overflow-hidden rounded-2xl border bg-black shadow-[var(--shadow-modal)]'
                : 'relative h-[min(72vh,680px)] min-h-[520px]',
            )}
            onFocusCapture={wakePlaybackControls}
            onPointerDown={wakePlaybackControls}
            onPointerMove={wakePlaybackControls}
            aria-busy={!replayReady}
          >
            <LazyFireworkReplayCanvas
              cues={sortedCues}
              elapsed={elapsed}
              playbackRef={elapsedRef}
              scrubbing={isScrubbing}
              launchPositions={launchPositions}
              muted={!isPlaying}
              controlsVisible={isSceneReady && playbackControlsVisible}
              primeSnapshots={hasReplayCues}
              cuesFinal={replayDataReady}
              onSceneReady={() => setIsSceneReady(true)}
              showLoadingBar
              loadingBarPosition="bottom"
              onReady={() => setIsCanvasReady(true)}
            />

            {!isSceneReady ? <ReplayCanvasPlaceholder /> : null}
            {replayReady && !hasReplayCues ? <EmptyPreview /> : null}
            {audioUrl ? (
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="auto"
                className="hidden"
                onEnded={() => setIsPlaying(false)}
              />
            ) : null}

            {replayReady ? (
              <div
                className={cn(
                  'absolute inset-x-0 bottom-6 z-20 transition-opacity duration-300 motion-reduce:transition-none',
                  playbackControlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                <ReplayTransportControls
                  elapsed={elapsed}
                  playheadRef={elapsedRef}
                  duration={duration}
                  isPlaying={isPlaying}
                  disabled={!hasReplayCues}
                  fullscreen={isFullscreen}
                  onPlayPause={togglePlayback}
                  onReset={restart}
                  onFullscreenToggle={toggleFullscreen}
                  onScrub={(next) => {
                    setIsPlaying(false);
                    scrubTo(next);
                  }}
                  onScrubEnd={commitScrub}
                />
              </div>
            ) : null}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-stretch">
          <Card elevation="high" radius="md" className="space-y-5 p-6 xl:col-span-2">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <Eyebrow tone="muted">Cue builder</Eyebrow>
                <h2 className="text-on-surface mt-2 text-2xl font-bold">Cues</h2>
              </div>
              <div className="flex items-center gap-3">
                {actionResult ? (
                  <p
                    className={
                      actionResult.ok
                        ? 'text-primary text-sm font-semibold'
                        : 'text-error text-sm font-semibold'
                    }
                  >
                    {actionResult.ok ? actionResult.message : actionResult.error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  onClick={() => openCueDialog('manual')}
                  size="sm"
                  disabled={!hasFireworkSpecifications}
                >
                  <Plus size={16} strokeWidth={2} />
                  Add firework
                </Button>
              </div>
            </div>

            <Dialog
              open={showAddForm}
              onOpenChange={(open) => {
                setShowAddForm(open);
                if (!open) setInsertBeforeTime(null);
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add firework cue</DialogTitle>
                  <DialogDescription>
                    Insert a new firework into <span className="font-semibold">{showName}</span> at
                    the chosen time and mortar. The current playhead is at{' '}
                    <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>; the
                    show runs{' '}
                    <span className="font-mono tabular-nums">{formatDuration(duration)}</span>.
                  </DialogDescription>
                </DialogHeader>
                <Tabs
                  value={cueDialogTab}
                  onValueChange={(value) => setCueDialogTab(value === 'ai' ? 'ai' : 'manual')}
                >
                  <TabsList className="mb-4 w-full">
                    <TabsTrigger value="manual">Pick firework</TabsTrigger>
                    <TabsTrigger value="ai">
                      <Sparkles size={12} strokeWidth={2} />
                      Describe with AI
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual">
                    <form
                      ref={formRef}
                      action={addCue}
                      className="grid min-h-[18rem] grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                      <input type="hidden" name="showId" value={showId} />
                      <input type="hidden" name="showSlug" value={showSlug} />
                      <input type="hidden" name="description" value={selectedProduct?.name ?? ''} />
                      <label className="space-y-2 sm:col-span-2">
                        <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                          Firework
                        </span>
                        <SelectField
                          name="productId"
                          required
                          placeholder="Select firework"
                          value={selectedProductId ?? ''}
                          options={specifications.map((spec) => ({
                            value: spec.id,
                            label: spec.name,
                          }))}
                          onChange={(value) => setSelectedProductId(value)}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                          Mortar
                        </span>
                        <SelectField
                          name="launchPositionIndex"
                          defaultValue="1"
                          options={LAUNCH_POSITION_OPTIONS}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                          Time (seconds)
                        </span>
                        <NumberInput
                          key={`time-${insertBeforeTime ?? 'default'}-${showAddForm}`}
                          name="timeSeconds"
                          min={0}
                          max={duration}
                          step={0.5}
                          defaultValue={
                            insertBeforeTime !== null
                              ? Math.max(0, Number((insertBeforeTime - 0.5).toFixed(1)))
                              : Math.min(duration, Math.round(elapsed + 3))
                          }
                          required
                          ariaLabel="Cue time in seconds"
                        />
                      </label>
                      <DialogFooter className="sm:col-span-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowAddForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isPending || !hasFireworkSpecifications}
                        >
                          <Plus size={16} strokeWidth={2} />
                          Add cue
                        </Button>
                      </DialogFooter>
                    </form>
                  </TabsContent>
                  <TabsContent value="ai">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        applyRefinement(aiPrompt);
                      }}
                      className="flex min-h-[18rem] flex-col gap-4"
                    >
                      <label className="block space-y-2">
                        <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                          Describe what you want
                        </span>
                        <Textarea
                          value={aiPrompt}
                          onChange={(event) => setAiPrompt(event.target.value)}
                          placeholder={
                            insertBeforeTime !== null
                              ? `e.g. "Something gold and crackling just before ${formatDuration(
                                  insertBeforeTime,
                                )}"`
                              : 'e.g. "A red strobe burst at the chorus around 1:20"'
                          }
                          rows={4}
                          required
                        />
                      </label>
                      <DialogFooter className="mt-auto">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowAddForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={!aiPrompt.trim()}>
                          <Sparkles size={16} strokeWidth={2} />
                          Generate cue
                        </Button>
                      </DialogFooter>
                    </form>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            {cueToDelete ? (
              <AlertDialog
                open
                onOpenChange={(open) => {
                  if (!open && deletingCueId === null) setCueToDelete(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this cue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes <strong>{cueToDelete.fireworkName}</strong> at{' '}
                      <span className="font-mono tabular-nums">{cueToDelete.timeLabel}</span> from
                      this show.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingCueId !== null}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={deletingCueId !== null}
                      aria-busy={deletingCueId !== null}
                      onClick={(event) => {
                        event.preventDefault();
                        deleteCue();
                      }}
                    >
                      <span aria-live="polite">
                        {deletingCueId === cueToDelete.cueId ? 'Deleting…' : 'Delete cue'}
                      </span>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            <div className="space-y-3">
              {builderCues.length > 0 ? (
                <div>
                  <DataTableShell>
                    <table className={tableClasses('min-w-0 table-fixed')}>
                      <colgroup>
                        <col className="w-[88px]" />
                        <col />
                        <col className="w-[110px]" />
                        <col className="w-[56px]" />
                      </colgroup>
                      <thead className={tableHeadClasses()}>
                        <tr>
                          <th className={tableHeaderCellClasses()}>Time</th>
                          <th className={tableHeaderCellClasses()}>Firework</th>
                          <th className={tableHeaderCellClasses()}>Mortar</th>
                          <th className={tableHeaderCellClasses('text-right')}>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleBuilderCues.map((row) => {
                          const { cue, baseCueId, shotCount } = row;
                          const fullMortarLabel =
                            LAUNCH_POSITION_OPTIONS[cue.launchPositionIndex]?.label ??
                            `Mortar ${cue.launchPositionIndex + 1}`;
                          const mortarLabel = fullMortarLabel.replace(/^Mortar\s+/i, '');
                          const fireworkName =
                            productNameById.get(cue.productId) ?? cue.firework.name;
                          const cueTimeLabel = formatDuration(cue.timeSeconds);
                          const isActive = activeBaseCueIds.has(baseCueId);
                          return (
                            <tr
                              key={baseCueId}
                              // Selecting a row plays the show live from that cue
                              // (the same as the row menu's "Play from here"). The
                              // time button and actions menu stop propagation so
                              // they keep their own seek/menu behaviour.
                              onClick={() => playFrom(cue.timeSeconds)}
                              title="Play from here"
                              className={tableRowClasses(
                                cn(
                                  'cursor-pointer',
                                  isActive &&
                                    'bg-[color:var(--color-bg-muted)] shadow-[inset_3px_0_0_0_var(--color-accent)]',
                                ),
                              )}
                            >
                              <td className={tableCellClasses('h-14')}>
                                <button
                                  type="button"
                                  aria-label={`Seek to ${fireworkName} at ${cueTimeLabel}`}
                                  aria-current={isActive ? 'true' : undefined}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setIsPlaying(false);
                                    seekTo(cue.timeSeconds, false);
                                  }}
                                  className="text-tertiary hover:bg-muted hover:text-foreground focus-visible:ring-ring -my-2 -ml-2 inline-flex min-h-10 rounded-md px-2 font-mono text-sm font-bold tabular-nums transition-colors focus:outline-none focus-visible:ring-3"
                                >
                                  {cueTimeLabel}
                                </button>
                              </td>
                              <td className={tableCellClasses('h-14')}>
                                <TruncatedCell text={fireworkName} />
                                {shotCount > 1 && (
                                  <div className="text-on-surface-variant mt-0.5 text-[10px] font-bold tracking-widest uppercase">
                                    {shotCount} shots
                                  </div>
                                )}
                              </td>
                              <td className={tableCellClasses('h-14')}>
                                <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
                                  {mortarLabel}
                                </span>
                              </td>
                              <td
                                className={tableCellClasses('h-14 text-right')}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <RowActionsMenu
                                  label="Cue actions"
                                  items={[
                                    {
                                      label: 'Play from here',
                                      icon: <Play size={14} strokeWidth={2} />,
                                      onSelect: () => playFrom(cue.timeSeconds),
                                    },
                                    ...(canEditFireworks
                                      ? [
                                          {
                                            label: 'Edit firework',
                                            icon: <Pencil size={14} strokeWidth={2} />,
                                            onSelect: () =>
                                              router.push(`/admin/fireworks/${cue.firework.id}`),
                                          },
                                        ]
                                      : []),
                                    {
                                      label: 'Insert firework above',
                                      icon: <Plus size={14} strokeWidth={2} />,
                                      disabled: !hasFireworkSpecifications,
                                      onSelect: () => {
                                        setInsertBeforeTime(cue.timeSeconds);
                                        openCueDialog('manual');
                                      },
                                    },
                                    {
                                      label: 'Delete cue',
                                      icon: <Trash2 size={14} strokeWidth={2} />,
                                      destructive: true,
                                      disabled: isPending || deletingCueId !== null,
                                      onSelect: () =>
                                        requestCueDeletion({
                                          cueId: baseCueId,
                                          fireworkName,
                                          timeLabel: cueTimeLabel,
                                        }),
                                    },
                                  ]}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </DataTableShell>
                  {emptyBuilderCueSlots > 0 && (
                    <div aria-hidden="true" style={{ height: `${emptyBuilderCueSlots * 56}px` }} />
                  )}
                </div>
              ) : (
                <DataTableShell>
                  <div className="text-on-surface-variant px-4 py-8 text-center text-sm">
                    No cues yet. Add your first firework above to make the preview playable.
                  </div>
                </DataTableShell>
              )}

              {pageCount > 1 && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-on-surface-variant text-[11px] font-semibold tracking-widest uppercase tabular-nums">
                    Page {safePage + 1} of {pageCount} · {builderCues.length} cues
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCuePage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={14} strokeWidth={2} />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCuePage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={safePage >= pageCount - 1}
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight size={14} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:h-full xl:min-h-0">
            <div className="space-y-2">
              <StatChip
                label="Total cost"
                value={totalCents != null ? formatTotal(totalCents) : '-'}
              />
              <StatChip label="Fireworks" value={String(builderCues.length)} />
              <StatChip label="Length" value={formatDuration(duration)} />
            </div>
            <Card
              elevation="high"
              radius="md"
              className="flex flex-col gap-4 p-5 xl:min-h-0 xl:flex-1"
            >
              <div className="flex items-start gap-3">
                <div className="bg-surface-container-highest text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Sparkles size={16} strokeWidth={2} />
                </div>
                <div>
                  <Eyebrow tone="muted">Refine with prompt</Eyebrow>
                  <h2 className="text-on-surface mt-1 text-lg font-bold">Adjust this show</h2>
                  <p className="text-on-surface-variant mt-1 text-xs leading-relaxed">
                    Say what you want next: &ldquo;add green firework at the start&rdquo; or
                    &ldquo;something gold at 1:20&rdquo;, and we&apos;ll drop a matching cue in.
                  </p>
                  <p className="text-on-surface-variant mt-2 text-xs leading-relaxed">
                    This will use {REFINEMENT_CREDIT_COST} AI credits.
                  </p>
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const prompt = refinePrompt.trim();
                  openCueDialog('ai', prompt || undefined);
                }}
                className="flex flex-col gap-3 xl:min-h-0 xl:flex-1"
              >
                <Textarea
                  value={refinePrompt}
                  onChange={(event) => setRefinePrompt(event.target.value)}
                  placeholder="e.g. add green firework at the very start"
                  rows={3}
                  aria-label="Refinement prompt"
                  className="min-h-32 xl:[field-sizing:fixed] xl:min-h-0 xl:flex-1 xl:resize-none"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={isPending}>
                    <Sparkles size={14} strokeWidth={2} />
                    Apply refinement
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
      {isFullscreen ? <PreviewFullscreenBackdrop onExit={exitFullscreen} /> : null}
    </>
  );
}

function TruncatedCell({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setIsOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const content = (
    <div ref={ref} className="text-on-surface truncate font-semibold">
      {text}
    </div>
  );

  if (!isOverflowing) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-sm rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-3 py-2 text-xs leading-snug text-[color:var(--color-content-default)] shadow-[var(--shadow-modal)]"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-4 py-3">
      <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
        {label}
      </span>
      <span className="text-on-surface text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function parsePromptToCue(
  prompt: string,
  specifications: FireworkSpecification[],
  duration: number,
  elapsed: number,
): {
  product: FireworkSpecification;
  timeSeconds: number;
  launchPositionIndex: number;
  description: string;
} | null {
  if (specifications.length === 0) return null;
  const lower = prompt.toLowerCase();

  let timeSeconds: number | null = null;
  if (/\b(very start|the start|beginning|intro|opening)\b/.test(lower)) {
    timeSeconds = 0.5;
  } else if (/\b(very end|the end|finale|outro|ending)\b/.test(lower)) {
    timeSeconds = Math.max(0, duration - 1);
  }
  if (timeSeconds === null) {
    const mmss = lower.match(/\b(\d{1,2}):(\d{2})\b/);
    if (mmss) timeSeconds = Number(mmss[1]) * 60 + Number(mmss[2]);
  }
  if (timeSeconds === null) {
    const secs = lower.match(/\b(?:at|around|near)\s+(\d{1,3})(?:\s*(?:s|sec|seconds))?\b/);
    if (secs) timeSeconds = Number(secs[1]);
    else {
      const bare = lower.match(/\b(\d{1,3})\s*(?:s|sec|seconds)\b/);
      if (bare) timeSeconds = Number(bare[1]);
    }
  }
  if (timeSeconds === null) timeSeconds = Math.min(duration, Math.round(elapsed + 1));
  timeSeconds = Math.max(0, Math.min(duration, timeSeconds));

  let launchPositionIndex = 1;
  if (/\b(left|mortar\s*1)\b/.test(lower)) launchPositionIndex = 0;
  else if (/\b(right|mortar\s*3)\b/.test(lower)) launchPositionIndex = 2;
  else if (/\b(centre|center|middle|mortar\s*2)\b/.test(lower)) launchPositionIndex = 1;

  const stopWords = new Set([
    'add',
    'a',
    'an',
    'the',
    'at',
    'in',
    'on',
    'with',
    'and',
    'or',
    'firework',
    'fireworks',
    'cue',
    'effect',
    'around',
    'near',
    'very',
    'start',
    'beginning',
    'intro',
    'opening',
    'end',
    'finale',
    'outro',
    'ending',
    'middle',
    'centre',
    'center',
    'left',
    'right',
    'mortar',
    'please',
    'show',
    'something',
    'some',
    'me',
    'i',
    'want',
    'need',
    'put',
    'insert',
    'use',
    'of',
    'for',
    'to',
    'from',
  ]);
  const tokens = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !stopWords.has(t) && !/^\d+$/.test(t));

  let bestProduct: FireworkSpecification | null = null;
  let bestScore = 0;
  for (const product of specifications) {
    const name = product.name.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (name.includes(token)) score += token.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }

  if (!bestProduct) return null;
  return {
    product: bestProduct,
    timeSeconds,
    launchPositionIndex,
    description: bestProduct.name,
  };
}
