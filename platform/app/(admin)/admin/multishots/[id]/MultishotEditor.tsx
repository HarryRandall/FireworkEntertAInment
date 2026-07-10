'use client';

/**
 * Multishot editor, movie-editor style. A multishot fires from a single mortar,
 * so each shot only chooses its firework, when it fires, and the direction it is
 * aimed (pan/tilt). The stage at the top is a live 3D preview: clicking a
 * firework's aim marker selects it, while angle controls edit the horizontal
 * pan and depth tilt planes directly. The track below places each shot in time.
 *
 * Appearance is always locked; a multishot never changes how a firework looks.
 */

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FocusEvent as ReactFocusEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Check,
  Copy,
  Film,
  Loader2,
  MoveHorizontal,
  MoveVertical,
  Pencil,
  Plus,
  Repeat,
  Save,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/app/components/admin/previewFullscreen';
import {
  deleteMultishotShot,
  updateMultishot,
  upsertMultishotShot,
} from '@/app/actions/admin-multishots';
import { useAdminBreadcrumbOverride } from '@/app/components/admin/AdminShell';
import { EditorPreviewTransport } from '@/app/components/admin/FireworkEditorShell';
import { ReplayCanvasSkeleton } from '@/app/components/app/ReplayCanvasSkeleton';
import type { AimMarker } from '@/app/components/app/FireworkReplayCanvas';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { toast } from '@/app/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import type { AdminMultishotDetail } from '@/lib/admin.types';
import type { LaunchPosition } from '@/lib/fireworks/design';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

// A multishot is one physical mortar; the whole sequence launches from origin.
const SINGLE_MORTAR: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];
const PX_PER_SECOND = 96;
const MIN_CLIP_PX = 46;
const TIMELINE_ROW_COUNT = 4;
const TIMELINE_ROW_HEIGHT_PX = 30;
const TIMELINE_ROW_GAP_PX = 5;
const TIMELINE_CLIP_INSET_PX = 2;
const TIMELINE_COLLISION_GAP_PX = 4;
const MIN_TIMELINE_SECONDS = 6;
const DEFAULT_FIREWORK_DURATION = 2.4;
const SAVE_DEBOUNCE_MS = 650;
const SCRUB_COMMIT_MS = 60;
const PREVIEW_TRANSPORT_IDLE_MS = 2000;
const INSPECTOR_RAIL_WIDTH_PX = 340;
const INSPECTOR_RAIL_GAP_PX = 20;
const INSPECTOR_RENDER_OVERSCAN_PX = INSPECTOR_RAIL_WIDTH_PX + INSPECTOR_RAIL_GAP_PX;
const MAX_PAN_DEGREES = 30;
const MAX_TILT_DEGREES = 50;
const PAN_PRESETS = [
  { value: -30, label: 'L 30°', title: 'Hard left pan' },
  { value: -15, label: 'L 15°', title: 'Soft left pan' },
  { value: 0, label: '0°', title: 'Straight up' },
  { value: 15, label: 'R 15°', title: 'Soft right pan' },
  { value: 30, label: 'R 30°', title: 'Hard right pan' },
];
const TILT_PRESETS = [
  { value: -50, label: 'B 50°', title: 'Deep back tilt' },
  { value: -25, label: 'B 25°', title: 'Soft back tilt' },
  { value: 0, label: '0°', title: 'Level depth' },
  { value: 25, label: 'F 25°', title: 'Soft front tilt' },
  { value: 50, label: 'F 50°', title: 'Deep front tilt' },
];
const SHOT_SELECTION_KEEP_SELECTOR = [
  '[data-preserve-shot-selection]',
  '[data-slot="select-content"]',
  '[data-slot="select-item"]',
].join(',');

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type LocalShot = {
  uid: string;
  id?: string;
  fireworkId: string;
  timeOffsetSeconds: number;
  panDegrees: number;
  tiltDegrees: number;
  sequenceIndex: number;
  notes: string;
  saveState: SaveState;
};

let uidCounter = 0;
function makeUid(): string {
  uidCounter += 1;
  return `shot-${Date.now().toString(36)}-${uidCounter}`;
}

function clampSignedDegrees(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function shouldKeepShotSelection(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(SHOT_SELECTION_KEEP_SELECTOR));
}

function toLocalShot(shot: AdminMultishotDetail['shots'][number]): LocalShot {
  return {
    uid: makeUid(),
    id: shot.id,
    fireworkId: shot.fireworkId ?? '',
    timeOffsetSeconds: shot.timeOffsetSeconds,
    panDegrees: clampSignedDegrees(shot.panDegrees, MAX_PAN_DEGREES),
    tiltDegrees: clampSignedDegrees(shot.tiltDegrees, MAX_TILT_DEGREES),
    sequenceIndex: shot.sequenceIndex,
    notes: shot.notes ?? '',
    saveState: 'idle',
  };
}

function fireworkDurationOf(spec: FireworkSpecification | undefined): number {
  const d = spec?.durationSeconds;
  return d && Number.isFinite(d) && d > 0 ? d : DEFAULT_FIREWORK_DURATION;
}

function colorOf(spec: FireworkSpecification | undefined): string {
  return clipPaletteOf(spec).primary;
}

function clipPaletteOf(spec: FireworkSpecification | undefined): {
  primary: string;
  secondary: string;
} {
  const palette = spec?.variant?.colorPalette.filter(Boolean) ?? [];
  const primary = spec?.variant?.primaryColor ?? palette[0] ?? '#38bdf8';
  const secondary =
    spec?.variant?.secondaryColor ??
    palette.find((color) => color !== primary) ??
    (spec?.baseEffect?.patternKey.includes('chrysanthemum') ? '#22c55e' : '#a78bfa');
  return { primary, secondary };
}

function clipVisualSeconds(spec: FireworkSpecification | undefined): number {
  return Math.max(fireworkDurationOf(spec), MIN_CLIP_PX / PX_PER_SECOND);
}

function formatSecondsLabel(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

function formatTimelineTimestamp(seconds: number): string {
  const totalTenths = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 10)) : 0;
  const minutes = Math.floor(totalTenths / 600);
  const secondsWithinMinute = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  const wholeSeconds = secondsWithinMinute.toString().padStart(2, '0');
  return `${minutes}:${wholeSeconds}.${tenths}`;
}

type TimelineShotLayout = {
  shot: LocalShot;
  spec: FireworkSpecification | undefined;
  rowIndex: number;
};

function assignTimelineRows(
  shots: LocalShot[],
  specsById: Map<string, FireworkSpecification>,
): TimelineShotLayout[] {
  const rowEnds = Array.from({ length: TIMELINE_ROW_COUNT }, () => 0);
  const ordered = [...shots].sort((a, b) => {
    if (a.timeOffsetSeconds !== b.timeOffsetSeconds) {
      return a.timeOffsetSeconds - b.timeOffsetSeconds;
    }
    return a.sequenceIndex - b.sequenceIndex;
  });

  return ordered.map((shot) => {
    const spec = specsById.get(shot.fireworkId);
    const start = shot.timeOffsetSeconds;
    const visualEnd = start + clipVisualSeconds(spec) + TIMELINE_COLLISION_GAP_PX / PX_PER_SECOND;
    let rowIndex = rowEnds.findIndex((end) => start >= end);

    if (rowIndex === -1) {
      rowIndex = rowEnds.reduce((best, end, index) => (end < rowEnds[best] ? index : best), 0);
    }

    rowEnds[rowIndex] = visualEnd;
    return { shot, spec, rowIndex };
  });
}

// Mirrors the simulation's shell apex so a marker sits exactly where the burst
// pops. A multishot fires from the origin, so the base position is (0, 0, 0).
const GUIDE_GRAVITY = -9.82;
function burstCentre(
  spec: FireworkSpecification | undefined,
  panDegrees: number,
  tiltDegrees: number,
): { x: number; y: number; z: number } {
  const design = spec?.renderDesign;
  const size = design?.size ?? 100;
  const liftVelocity = design?.liftVelocity ?? 11 + Math.min(size / 40, 6);
  const panR = (panDegrees * Math.PI) / 180;
  const tiltR = (tiltDegrees * Math.PI) / 180;
  const vx = Math.sin(panR) * Math.max(1.2, liftVelocity * 0.62);
  const vz = Math.sin(tiltR) * Math.max(1.0, liftVelocity * 0.42);
  const vy = liftVelocity * Math.max(0.82, Math.cos(panR) * 0.96);
  const apex = Math.max(0, vy / Math.abs(GUIDE_GRAVITY));
  return {
    x: vx * apex * 100,
    y: (vy * apex + 0.5 * GUIDE_GRAVITY * apex * apex) * 100,
    z: vz * apex * 100,
  };
}

export function MultishotEditor({
  multishot,
  fireworkSpecs,
}: {
  multishot: AdminMultishotDetail;
  fireworkSpecs: FireworkSpecification[];
}) {
  const router = useRouter();
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();

  // Meta panel state.
  const [isSavingMeta, startMetaTransition] = useTransition();
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [name, setName] = useState(multishot.name);
  const [description, setDescription] = useState(multishot.description ?? '');
  const initialDurationSeconds =
    multishot.durationSeconds == null ? '' : String(multishot.durationSeconds);
  const [durationSeconds, setDurationSeconds] = useState(initialDurationSeconds);

  // Timeline / shot state.
  const [shots, setShots] = useState<LocalShot[]>(() =>
    [...multishot.shots].sort((a, b) => a.sequenceIndex - b.sequenceIndex).map(toLocalShot),
  );
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  // Playback state.
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoadingProgress, setPreviewLoadingProgress] = useState<number | null>(null);
  const playbackRef = useRef(0);
  const startedAtRef = useRef(0);
  const selectionInitialisedRef = useRef(false);

  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    setAdminBreadcrumb({ label: name || multishot.name });
    return () => setAdminBreadcrumb(null);
  }, [multishot.name, name, setAdminBreadcrumb]);

  const specsById = useMemo(() => {
    const map = new Map<string, FireworkSpecification>();
    for (const spec of fireworkSpecs) map.set(spec.id, spec);
    return map;
  }, [fireworkSpecs]);

  const fireworkOptions = useMemo(
    () =>
      [...fireworkSpecs]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((spec) => ({
          value: spec.id,
          label: spec.name,
          description: spec.baseEffect?.name ?? undefined,
        })),
    [fireworkSpecs],
  );

  const contentDuration = useMemo(
    () =>
      shots.reduce((max, shot) => {
        const spec = specsById.get(shot.fireworkId);
        return Math.max(max, shot.timeOffsetSeconds + fireworkDurationOf(spec));
      }, 0),
    [shots, specsById],
  );

  const duration = Math.max(
    MIN_TIMELINE_SECONDS,
    multishot.durationSeconds ?? 0,
    Math.ceil(contentDuration) + 1,
  );

  const previewCues = useMemo<ReplayCue[]>(() => {
    const cues: ReplayCue[] = [];
    let position = 0;
    for (const shot of shots) {
      const spec = specsById.get(shot.fireworkId);
      if (!spec) continue;
      position += 1;
      cues.push({
        id: shot.uid,
        position,
        timeSeconds: Math.max(0.01, shot.timeOffsetSeconds),
        description: spec.name,
        productId: shot.fireworkId,
        launchPositionIndex: 0,
        firework: spec,
        shotPanDegrees: shot.panDegrees,
        shotTiltDegrees: shot.tiltDegrees,
        shotPositionOverride: null,
      });
    }
    return cues;
  }, [shots, specsById]);

  const aimMarkers = useMemo<AimMarker[]>(
    () =>
      shots
        .filter((shot) => specsById.has(shot.fireworkId))
        .map((shot) => {
          const spec = specsById.get(shot.fireworkId);
          return {
            id: shot.uid,
            panDegrees: shot.panDegrees,
            tiltDegrees: shot.tiltDegrees,
            color: colorOf(spec),
            position: burstCentre(spec, shot.panDegrees, shot.tiltDegrees),
          };
        }),
    [shots, specsById],
  );

  const transportTicks = useMemo(() => {
    // The transport keys ticks by `label-timeSeconds`, so collapse shots that
    // share a firework and time into a single mark to keep those keys unique.
    const byKey = new Map<string, { timeSeconds: number; label: string }>();
    for (const shot of shots) {
      const spec = specsById.get(shot.fireworkId);
      if (!spec) continue;
      byKey.set(`${spec.name}-${shot.timeOffsetSeconds}`, {
        timeSeconds: shot.timeOffsetSeconds,
        label: spec.name,
      });
    }
    return [...byKey.values()];
  }, [shots, specsById]);

  const selectedShot = shots.find((shot) => shot.uid === selectedUid) ?? null;
  const nextSequenceIndex = shots.length
    ? Math.max(...shots.map((shot) => shot.sequenceIndex)) + 1
    : 1;

  useEffect(() => {
    if (shots.length === 0) {
      if (selectedUid !== null) setSelectedUid(null);
      selectionInitialisedRef.current = false;
      return;
    }

    if (!selectionInitialisedRef.current) {
      selectionInitialisedRef.current = true;
      setSelectedUid(shots[0]!.uid);
      return;
    }

    if (selectedUid && !shots.some((shot) => shot.uid === selectedUid)) {
      setSelectedUid(shots[0]!.uid);
    }
  }, [selectedUid, shots]);

  // --- Persistence -----------------------------------------------------------

  const setShotSaveState = useCallback((uid: string, saveState: SaveState) => {
    setShots((prev) => prev.map((shot) => (shot.uid === uid ? { ...shot, saveState } : shot)));
  }, []);

  const persistShot = useCallback(
    async (shot: LocalShot): Promise<void> => {
      if (!shot.fireworkId) return;
      const panDegrees = Math.round(clampSignedDegrees(shot.panDegrees, MAX_PAN_DEGREES));
      const tiltDegrees = Math.round(clampSignedDegrees(shot.tiltDegrees, MAX_TILT_DEGREES));
      setShotSaveState(shot.uid, 'saving');
      const result = await upsertMultishotShot({
        id: shot.id,
        multishotId: multishot.id,
        fireworkId: shot.fireworkId,
        sequenceIndex: shot.sequenceIndex,
        timeOffsetSeconds: Number(shot.timeOffsetSeconds.toFixed(2)),
        panDegrees,
        tiltDegrees,
        launchPositionIndex: 0,
        notes: shot.notes,
      });
      if (!result.ok) {
        setShotSaveState(shot.uid, 'error');
        toast.error(result.error);
        return;
      }
      setShots((prev) =>
        prev.map((current) =>
          current.uid === shot.uid ? { ...current, id: result.id, saveState: 'saved' } : current,
        ),
      );
    },
    [multishot.id, setShotSaveState],
  );

  const saveShotByUid = useCallback(
    (uid: string) => {
      const shot = shotsRef.current.find((current) => current.uid === uid);
      if (shot) void persistShot(shot);
    },
    [persistShot],
  );

  const scheduleSave = useCallback(
    (uid: string) => {
      const timers = saveTimersRef.current;
      const existing = timers.get(uid);
      if (existing) clearTimeout(existing);
      timers.set(
        uid,
        setTimeout(() => {
          timers.delete(uid);
          saveShotByUid(uid);
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [saveShotByUid],
  );

  const updateShot = useCallback(
    (uid: string, patch: Partial<LocalShot>, options?: { immediate?: boolean; save?: boolean }) => {
      const nextPatch = { ...patch };
      if (typeof nextPatch.panDegrees === 'number') {
        nextPatch.panDegrees = clampSignedDegrees(nextPatch.panDegrees, MAX_PAN_DEGREES);
      }
      if (typeof nextPatch.tiltDegrees === 'number') {
        nextPatch.tiltDegrees = clampSignedDegrees(nextPatch.tiltDegrees, MAX_TILT_DEGREES);
      }
      setShots((prev) =>
        prev.map((shot) =>
          shot.uid === uid ? { ...shot, ...nextPatch, saveState: 'idle' } : shot,
        ),
      );
      if (options?.save === false) return;
      if (options?.immediate) {
        const timers = saveTimersRef.current;
        const existing = timers.get(uid);
        if (existing) {
          clearTimeout(existing);
          timers.delete(uid);
        }
        // Read after the state flush so we persist the patched values.
        setTimeout(() => saveShotByUid(uid), 0);
      } else {
        scheduleSave(uid);
      }
    },
    [saveShotByUid, scheduleSave],
  );

  useEffect(() => {
    const defaultFireworkId = fireworkOptions[0]?.value;
    if (!defaultFireworkId) return;
    const shotWithoutFirework = shots.find((shot) => !shot.fireworkId);
    if (!shotWithoutFirework) return;
    updateShot(shotWithoutFirework.uid, { fireworkId: defaultFireworkId }, { immediate: true });
  }, [fireworkOptions, shots, updateShot]);

  const addShot = useCallback(() => {
    const spec = fireworkSpecs[0];
    if (!spec) {
      toast.error('Create a firework first, then add it to this multishot.');
      return;
    }
    const timeOffset = Math.round(contentDuration * 2) / 2;
    const shot: LocalShot = {
      uid: makeUid(),
      fireworkId: spec.id,
      timeOffsetSeconds: Number.isFinite(timeOffset) ? Math.max(0, timeOffset) : 0,
      panDegrees: 0,
      tiltDegrees: 0,
      sequenceIndex: nextSequenceIndex,
      notes: '',
      saveState: 'saving',
    };
    setShots((prev) => [...prev, shot]);
    setSelectedUid(shot.uid);
    void persistShot(shot);
  }, [contentDuration, fireworkSpecs, nextSequenceIndex, persistShot]);

  const duplicateShot = useCallback(
    (uid: string) => {
      const source = shotsRef.current.find((shot) => shot.uid === uid);
      if (!source) return;
      const copy: LocalShot = {
        ...source,
        uid: makeUid(),
        id: undefined,
        timeOffsetSeconds: source.timeOffsetSeconds + 0.5,
        sequenceIndex: nextSequenceIndex,
        saveState: 'saving',
      };
      setShots((prev) => [...prev, copy]);
      setSelectedUid(copy.uid);
      void persistShot(copy);
    },
    [nextSequenceIndex, persistShot],
  );

  const deleteShot = useCallback(
    async (uid: string) => {
      const shot = shotsRef.current.find((current) => current.uid === uid);
      const timers = saveTimersRef.current;
      const existing = timers.get(uid);
      if (existing) {
        clearTimeout(existing);
        timers.delete(uid);
      }
      setShots((prev) => prev.filter((current) => current.uid !== uid));
      if (selectedUid === uid) {
        setSelectedUid(null);
      }
      if (shot?.id) {
        const result = await deleteMultishotShot({ id: shot.id, multishotId: multishot.id });
        if (!result.ok) toast.error(result.error);
      }
    },
    [multishot.id, selectedUid],
  );

  // --- Preview interaction ---------------------------------------------------

  const clearSelectedShot = useCallback(() => {
    setSelectedUid(null);
  }, []);

  const handleEditorPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (shouldKeepShotSelection(event.target)) return;
      clearSelectedShot();
    },
    [clearSelectedShot],
  );

  const handleSelectMarker = useCallback(
    (id: string | null) => {
      if (id) {
        setSelectedUid(id);
        return;
      }
      clearSelectedShot();
    },
    [clearSelectedShot],
  );

  // --- Playback --------------------------------------------------------------

  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    startedAtRef.current = performance.now() - playbackRef.current * 1000;
    let lastUiUpdate = 0;

    function tick(now: number) {
      const raw = (now - startedAtRef.current) / 1000;
      let next = raw;
      if (raw >= duration) {
        if (!isLooping) {
          playbackRef.current = duration;
          setElapsed(duration);
          setIsPlaying(false);
          return;
        }
        next = raw % duration;
        startedAtRef.current = now - next * 1000;
      }
      playbackRef.current = next;
      if (now - lastUiUpdate >= SCRUB_COMMIT_MS) {
        lastUiUpdate = now;
        setElapsed(next);
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, isLooping, duration]);

  const handleScrub = useCallback(
    (seconds: number) => {
      const next = Math.max(0, Math.min(duration, seconds));
      playbackRef.current = next;
      if (isPlaying) {
        startedAtRef.current = performance.now() - next * 1000;
      }
      setElapsed(next);
    },
    [duration, isPlaying],
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying((playing) => {
      if (!playing && playbackRef.current >= duration - 0.01) {
        playbackRef.current = 0;
        setElapsed(0);
      }
      return !playing;
    });
  }, [duration]);

  const handleReset = useCallback(() => {
    playbackRef.current = 0;
    setElapsed(0);
    setIsPlaying(false);
  }, []);

  // --- Meta ------------------------------------------------------------------

  function saveMeta() {
    setMetaError(null);
    startMetaTransition(async () => {
      const result = await updateMultishot({
        id: multishot.id,
        name,
        description,
        durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
      });
      if (!result.ok) {
        setMetaError(result.error);
        return;
      }
      setMetaDialogOpen(false);
      toast.success('Multishot saved');
      router.refresh();
    });
  }

  const hasFireworks = fireworkSpecs.length > 0;
  const metaDirty =
    name !== multishot.name ||
    description !== (multishot.description ?? '') ||
    durationSeconds !== initialDurationSeconds;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-5"
      onPointerDownCapture={handleEditorPointerDownCapture}
    >
      {!hasFireworks ? (
        <InlineAlert tone="info" title="No fireworks yet">
          Create a firework first, then come back to place it in this multishot.
        </InlineAlert>
      ) : null}

      <div
        className={cn(
          'grid shrink-0 items-stretch gap-5',
          selectedShot ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1',
        )}
      >
        <PreviewStage
          cues={previewCues}
          elapsed={elapsed}
          playbackRef={playbackRef}
          duration={duration}
          fullWidth={!selectedShot}
          isPlaying={isPlaying}
          isLooping={isLooping}
          fullscreen={isFullscreen}
          loading={!previewReady}
          loadingProgress={previewLoadingProgress}
          ticks={transportTicks}
          aimMarkers={aimMarkers}
          selectedUid={selectedUid}
          onSelectMarker={handleSelectMarker}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
          onLoopToggle={() => setIsLooping((loop) => !loop)}
          onFullscreenToggle={toggleFullscreen}
          onExitFullscreen={exitFullscreen}
          onScrub={handleScrub}
          onPreviewLoadingProgress={(progress) => {
            setPreviewLoadingProgress(progress);
            if (progress !== null) setPreviewReady(false);
          }}
          onPreviewReady={() => {
            setPreviewReady(true);
            setPreviewLoadingProgress(null);
          }}
        />

        {selectedShot ? (
          <Inspector
            shot={selectedShot}
            fireworkOptions={fireworkOptions}
            duration={duration}
            onChangeFirework={(fireworkId) =>
              updateShot(selectedShot.uid, { fireworkId }, { immediate: true })
            }
            onChangeTime={(seconds) => updateShot(selectedShot.uid, { timeOffsetSeconds: seconds })}
            onChangePan={(panDegrees, options) =>
              updateShot(selectedShot.uid, { panDegrees }, { immediate: options?.immediate })
            }
            onChangeTilt={(tiltDegrees, options) =>
              updateShot(selectedShot.uid, { tiltDegrees }, { immediate: options?.immediate })
            }
            onDuplicate={() => duplicateShot(selectedShot.uid)}
            onDelete={() => void deleteShot(selectedShot.uid)}
          />
        ) : null}
      </div>

      <div className="min-w-0">
        <Timeline
          shots={shots}
          specsById={specsById}
          duration={duration}
          elapsed={elapsed}
          selectedUid={selectedUid}
          disabled={!hasFireworks}
          onSelect={(uid) => {
            setSelectedUid(uid);
          }}
          onSeek={handleScrub}
          onMoveShot={(uid, seconds, commit) =>
            updateShot(uid, { timeOffsetSeconds: seconds }, { save: commit, immediate: commit })
          }
          onAdd={addShot}
        />
      </div>

      <div className="min-w-0">
        <MetaBar
          open={metaDialogOpen}
          dirty={metaDirty}
          name={name}
          description={description}
          durationSeconds={durationSeconds}
          saving={isSavingMeta}
          error={metaError}
          shotCount={shots.length}
          onOpenChange={setMetaDialogOpen}
          onName={setName}
          onDescription={setDescription}
          onDuration={setDurationSeconds}
          onSave={saveMeta}
        />
      </div>
    </div>
  );
}

// --- Meta bar ----------------------------------------------------------------

function MetaBar({
  open,
  dirty,
  name,
  description,
  durationSeconds,
  saving,
  error,
  shotCount,
  onOpenChange,
  onName,
  onDescription,
  onDuration,
  onSave,
}: {
  open: boolean;
  dirty: boolean;
  name: string;
  description: string;
  durationSeconds: string;
  saving: boolean;
  error: string | null;
  shotCount: number;
  onOpenChange: (open: boolean) => void;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  onDuration: (value: string) => void;
  onSave: () => void;
}) {
  const durationLabel = durationSeconds.trim() ? `${durationSeconds.trim()}s` : 'Auto duration';

  return (
    <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-[color:var(--color-content-emphasis)]">
              {name || 'Untitled multishot'}
            </h1>
            <Badge tone="neutral" solid icon={null} className="font-mono tabular-nums">
              {durationLabel}
            </Badge>
            <Badge tone="accent" solid>
              {shotCount} {shotCount === 1 ? 'shot' : 'shots'}
            </Badge>
            {dirty ? (
              <Badge tone="warning" solid icon={null}>
                Unsaved edits
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-[color:var(--color-content-subtle)]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Pencil size={14} />
                Edit details
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit multishot details</DialogTitle>
              </DialogHeader>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSave();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Field>
                    <FieldLabel htmlFor="ms-name">Name</FieldLabel>
                    <Input
                      id="ms-name"
                      value={name}
                      onChange={(event) => onName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ms-duration">Duration (s)</FieldLabel>
                    <Input
                      id="ms-duration"
                      inputMode="decimal"
                      className="font-mono tabular-nums"
                      value={durationSeconds}
                      onChange={(event) => onDuration(event.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="ms-description">Description</FieldLabel>
                  <Textarea
                    id="ms-description"
                    rows={5}
                    value={description}
                    onChange={(event) => onDescription(event.target.value)}
                  />
                </Field>
                {error ? (
                  <InlineAlert tone="danger" title="Could not save">
                    {error}
                  </InlineAlert>
                ) : null}
                <DialogFooter>
                  <Button type="submit" loading={saving}>
                    <Save size={16} />
                    Save details
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}

// --- Preview stage -----------------------------------------------------------

function PreviewStage({
  cues,
  elapsed,
  playbackRef,
  duration,
  fullWidth,
  isPlaying,
  isLooping,
  fullscreen,
  loading,
  loadingProgress,
  ticks,
  aimMarkers,
  selectedUid,
  onSelectMarker,
  onPlayPause,
  onReset,
  onLoopToggle,
  onFullscreenToggle,
  onExitFullscreen,
  onScrub,
  onPreviewLoadingProgress,
  onPreviewReady,
}: {
  cues: ReplayCue[];
  elapsed: number;
  playbackRef: MutableRefObject<number>;
  duration: number;
  fullWidth: boolean;
  isPlaying: boolean;
  isLooping: boolean;
  fullscreen: boolean;
  loading: boolean;
  loadingProgress: number | null;
  ticks: { timeSeconds: number; label: string }[];
  aimMarkers: AimMarker[];
  selectedUid: string | null;
  onSelectMarker: (id: string | null) => void;
  onPlayPause: () => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onFullscreenToggle: () => void;
  onExitFullscreen: () => void;
  onScrub: (seconds: number) => void;
  onPreviewLoadingProgress: (progress: number | null) => void;
  onPreviewReady: () => void;
}) {
  const [transportActive, setTransportActive] = useState(true);
  const [previewActive, setPreviewActive] = useState(false);
  const transportIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transportVisible = previewActive && (!isPlaying || transportActive);
  const previewMenuActions = useMemo(
    () => [
      {
        id: 'loop',
        label: isLooping ? 'Disable looping' : 'Enable looping',
        active: isLooping,
        onClick: onLoopToggle,
        icon: <Repeat size={16} strokeWidth={2} />,
      },
    ],
    [isLooping, onLoopToggle],
  );

  const clearTransportIdleTimer = useCallback(() => {
    if (transportIdleTimer.current) {
      clearTimeout(transportIdleTimer.current);
      transportIdleTimer.current = null;
    }
  }, []);

  useEffect(() => {
    clearTransportIdleTimer();

    if (!isPlaying) {
      setTransportActive(true);
      return clearTransportIdleTimer;
    }

    setTransportActive(false);
    return clearTransportIdleTimer;
  }, [clearTransportIdleTimer, isPlaying]);

  function wakePreviewTransport() {
    setPreviewActive(true);
    clearTransportIdleTimer();

    if (!isPlaying) {
      setTransportActive(true);
      return;
    }

    setTransportActive(true);
    transportIdleTimer.current = setTimeout(
      () => setTransportActive(false),
      PREVIEW_TRANSPORT_IDLE_MS,
    );
  }

  function hidePreviewTransport() {
    setPreviewActive(false);
    setTransportActive(false);
    clearTransportIdleTimer();
  }

  function handlePreviewBlur(event: ReactFocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    hidePreviewTransport();
  }

  function handleTransportPlayPause() {
    if (!isPlaying) {
      setTransportActive(false);
      clearTransportIdleTimer();
    }
    onPlayPause();
  }

  return (
    <>
      <div className={fullscreen ? 'contents' : 'relative'}>
        <section
          data-preserve-shot-selection
          onFocusCapture={wakePreviewTransport}
          onBlurCapture={handlePreviewBlur}
          onPointerEnter={wakePreviewTransport}
          onPointerDownCapture={wakePreviewTransport}
          onPointerMoveCapture={wakePreviewTransport}
          onPointerLeave={hidePreviewTransport}
          className={cn(
            'bg-stage-night overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] text-white',
            fullscreen
              ? 'fixed inset-[5vmin] z-[100] rounded-2xl border-white/12 shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)]'
              : 'relative h-[560px]',
          )}
        >
          <div className="relative h-full w-full">
            <LazyFireworkReplayCanvas
              cues={cues}
              elapsed={elapsed}
              playbackRef={playbackRef}
              launchPositions={SINGLE_MORTAR}
              muted={!isPlaying}
              interactive
              controlsVisible={!loading}
              cameraMenuActions={previewMenuActions}
              primeSnapshots
              primeOnCueChanges={false}
              showLoadingBar
              renderOverscanPx={!fullscreen && !fullWidth ? INSPECTOR_RENDER_OVERSCAN_PX : 0}
              onPrimeProgress={onPreviewLoadingProgress}
              onReady={onPreviewReady}
              aimMarkers={aimMarkers}
              selectedMarkerId={selectedUid}
              onSelectMarker={onSelectMarker}
            />
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-5 z-30 transition-all duration-300',
                transportVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
              )}
            >
              <div className={transportVisible ? 'pointer-events-auto' : 'pointer-events-none'}>
                <EditorPreviewTransport
                  elapsed={elapsed}
                  duration={duration}
                  isPlaying={isPlaying}
                  fullscreen={fullscreen}
                  loading={loading}
                  loadingProgress={loadingProgress}
                  ticks={ticks}
                  onPlayPause={handleTransportPlayPause}
                  onReset={onReset}
                  onFullscreenToggle={onFullscreenToggle}
                  onScrub={onScrub}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
      {fullscreen ? <PreviewFullscreenBackdrop onExit={onExitFullscreen} /> : null}
    </>
  );
}

// --- Timeline ----------------------------------------------------------------

function Timeline({
  shots,
  specsById,
  duration,
  elapsed,
  selectedUid,
  disabled,
  onSelect,
  onSeek,
  onMoveShot,
  onAdd,
}: {
  shots: LocalShot[];
  specsById: Map<string, FireworkSpecification>;
  duration: number;
  elapsed: number;
  selectedUid: string | null;
  disabled: boolean;
  onSelect: (uid: string) => void;
  onSeek: (seconds: number) => void;
  onMoveShot: (uid: string, seconds: number, commit: boolean) => void;
  onAdd: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const width = Math.max(1, duration) * PX_PER_SECOND;
  const seconds = Array.from({ length: Math.floor(duration) + 1 }, (_, index) => index);
  const shotLayouts = assignTimelineRows(shots, specsById);
  const trackHeight =
    TIMELINE_ROW_COUNT * TIMELINE_ROW_HEIGHT_PX +
    (TIMELINE_ROW_COUNT - 1) * TIMELINE_ROW_GAP_PX +
    TIMELINE_CLIP_INSET_PX * 2;
  const scrubElapsed = Math.max(0, Math.min(duration, elapsed));

  function seekFromValue(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    onSeek(Math.max(0, Math.min(duration, next)));
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film size={16} className="text-[color:var(--color-content-subtle)]" />
          <h2 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            Timeline
          </h2>
          <span className="text-xs text-[color:var(--color-content-subtle)]">
            Single mortar. Drag clips to change when each firework fires.
          </span>
        </div>
        <Button size="sm" variant="primary" onClick={onAdd} disabled={disabled}>
          <Plus size={15} />
          Add shot
        </Button>
      </div>

      <div ref={trackRef} className="relative overflow-x-auto pb-4 [scrollbar-gutter:stable]">
        <div className="relative" style={{ width }}>
          {/* Ruler */}
          <div className="relative h-6 cursor-ew-resize touch-none border-b border-[color:var(--color-border-subtle)] select-none">
            {seconds.map((second) => (
              <div
                key={second}
                className="absolute top-0 flex h-full flex-col justify-between"
                style={{ left: second * PX_PER_SECOND }}
              >
                <span className="pointer-events-none -translate-x-1 pl-1 font-mono text-[10px] text-[color:var(--color-content-subtle)] tabular-nums">
                  {formatDuration(second)}
                </span>
                <span className="h-1.5 w-px bg-[color:var(--color-border-strong,var(--color-border-subtle))]" />
              </div>
            ))}
            <input
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={scrubElapsed}
              disabled={disabled}
              aria-label="Multishot preview time"
              aria-valuetext={formatTimelineTimestamp(scrubElapsed)}
              className="absolute inset-0 z-30 m-0 h-full w-full cursor-ew-resize touch-none appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
              onChange={(event) => seekFromValue(event.currentTarget.value)}
            />
          </div>

          {/* Track */}
          <div className="relative bg-transparent" style={{ height: trackHeight }}>
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {seconds.map((second) => (
                <span
                  key={second}
                  className="absolute top-0 bottom-0 w-px bg-[color:var(--color-border-subtle)] opacity-70"
                  style={{ left: second * PX_PER_SECOND }}
                />
              ))}
            </div>
            {shots.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[color:var(--color-content-subtle)]">
                No shots yet. Use Add shot to place your first firework.
              </div>
            ) : null}
            {shotLayouts.map(({ shot, spec, rowIndex }) => (
              <ShotClip
                key={shot.uid}
                shot={shot}
                spec={spec}
                rowIndex={rowIndex}
                duration={duration}
                selected={shot.uid === selectedUid}
                onSelect={() => onSelect(shot.uid)}
                onMove={onMoveShot}
              />
            ))}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-[color:var(--color-accent,#22d3ee)]"
            style={{ left: scrubElapsed * PX_PER_SECOND }}
          >
            <span className="absolute -top-0.5 -left-[3px] h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent,#22d3ee)]" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ShotClip({
  shot,
  spec,
  rowIndex,
  duration,
  selected,
  onSelect,
  onMove,
}: {
  shot: LocalShot;
  spec: FireworkSpecification | undefined;
  rowIndex: number;
  duration: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (uid: string, seconds: number, commit: boolean) => void;
}) {
  const dragRef = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);
  const left = shot.timeOffsetSeconds * PX_PER_SECOND;
  const clipDuration = fireworkDurationOf(spec);
  const clipWidth = Math.max(MIN_CLIP_PX, clipDuration * PX_PER_SECOND);
  const { primary, secondary } = clipPaletteOf(spec);
  const top = TIMELINE_CLIP_INSET_PX + rowIndex * (TIMELINE_ROW_HEIGHT_PX + TIMELINE_ROW_GAP_PX);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startOffset: shot.timeOffsetSeconds, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > 3) drag.moved = true;
    const next = Math.max(0, Math.min(duration, drag.startOffset + dx / PX_PER_SECOND));
    onMove(shot.uid, Number(next.toFixed(2)), false);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    if (drag.moved) {
      const dx = event.clientX - drag.startX;
      const next = Math.max(0, Math.min(duration, drag.startOffset + dx / PX_PER_SECOND));
      onMove(shot.uid, Number(next.toFixed(2)), true);
    } else {
      onSelect();
    }
  }

  return (
    <button
      type="button"
      data-preserve-shot-selection
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        'group absolute flex cursor-grab touch-none flex-col justify-between overflow-hidden rounded-md border px-2 py-1 text-left transition-[border-color,box-shadow,transform] active:cursor-grabbing',
        selected
          ? 'border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.65),0_0_22px_rgba(255,255,255,0.18)]'
          : 'border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-white/45 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_16px_rgba(255,255,255,0.08)]',
      )}
      style={{
        left,
        top,
        height: TIMELINE_ROW_HEIGHT_PX,
        width: clipWidth,
        background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 72%, #050505), color-mix(in srgb, ${secondary} 58%, #050505))`,
      }}
      aria-pressed={selected}
      aria-label={`${spec?.name ?? 'Shot'} at ${shot.timeOffsetSeconds.toFixed(1)} seconds`}
    >
      <span className="min-w-0 truncate text-[10px] leading-none font-semibold text-white drop-shadow">
        {spec?.name ?? 'Unknown firework'}
        <span className="font-mono font-medium text-white/78">
          {' '}
          ({formatSecondsLabel(clipDuration)})
        </span>
      </span>
      <span className="flex items-center gap-1 font-mono text-[9px] leading-none text-white/78 tabular-nums">
        {shot.saveState === 'saving' ? (
          <Loader2 size={10} className="animate-spin" />
        ) : shot.saveState === 'error' ? (
          <TriangleAlert size={10} className="text-[color:var(--color-content-danger,#f87171)]" />
        ) : null}
        {formatTimelineTimestamp(shot.timeOffsetSeconds)}
      </span>
    </button>
  );
}

// --- Inspector ---------------------------------------------------------------

function Inspector({
  shot,
  fireworkOptions,
  duration,
  onChangeFirework,
  onChangeTime,
  onChangePan,
  onChangeTilt,
  onDuplicate,
  onDelete,
}: {
  shot: LocalShot;
  fireworkOptions: { value: string; label: string; description?: string }[];
  duration: number;
  onChangeFirework: (fireworkId: string) => void;
  onChangeTime: (seconds: number) => void;
  onChangePan: (pan: number, options?: { immediate?: boolean }) => void;
  onChangeTilt: (tilt: number, options?: { immediate?: boolean }) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <aside
      data-preserve-shot-selection
      className="flex max-h-[560px] min-h-0 flex-col overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)]"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-3">
        {shot.saveState !== 'idle' ? (
          <div className="flex justify-end">
            <SaveIndicator state={shot.saveState} />
          </div>
        ) : null}
        <Field>
          <FieldLabel>Firework</FieldLabel>
          <SelectField
            ariaLabel="Firework"
            value={shot.fireworkId}
            onChange={onChangeFirework}
            options={fireworkOptions}
          />
        </Field>

        <SliderField
          label="Fires at"
          value={shot.timeOffsetSeconds}
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          showNumberInput
          formatValue={(value) => `${value.toFixed(1)}s`}
          onChange={onChangeTime}
        />

        <div className="space-y-4">
          <AnglePlaneControl
            label="Pan plane"
            icon={<MoveHorizontal size={14} />}
            value={shot.panDegrees}
            min={-MAX_PAN_DEGREES}
            max={MAX_PAN_DEGREES}
            presets={PAN_PRESETS}
            hint="Pan is capped at -30° to 30°."
            onChange={onChangePan}
          />
          <AnglePlaneControl
            label="Tilt plane"
            icon={<MoveVertical size={14} />}
            value={shot.tiltDegrees}
            min={-MAX_TILT_DEGREES}
            max={MAX_TILT_DEGREES}
            presets={TILT_PRESETS}
            hint="Tilt is capped at -50° to 50°."
            onChange={onChangeTilt}
          />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-3">
        <Button variant="secondary" size="sm" onClick={onDuplicate} className="min-w-0 px-2">
          <Copy size={14} />
          <span className="truncate">Duplicate</span>
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} className="min-w-0 px-2">
          <Trash2 size={14} />
          <span className="truncate">Delete</span>
        </Button>
      </div>
    </aside>
  );
}

function AnglePlaneControl({
  label,
  icon,
  value,
  min,
  max,
  presets,
  hint,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  presets: { value: number; label: string; title: string }[];
  hint: string;
  onChange: (value: number, options?: { immediate?: boolean }) => void;
}) {
  const id = useId();
  const sliderValue = Math.min(max, Math.max(min, value));

  function setNumberValue(next: number) {
    if (!Number.isFinite(next)) return;
    const clamped = Math.min(max, Math.max(min, next));
    onChange(Math.round(clamped));
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[color:var(--color-content-emphasis)]">
          <span className="text-[color:var(--color-content-subtle)]">{icon}</span>
          <span className="truncate">{label}</span>
          <InfoTooltip text={hint} />
        </span>
        <span className="rounded-md bg-[color:var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs text-[color:var(--color-content-emphasis)] tabular-nums">
          {Math.round(value)}°
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {presets.map((preset) => {
          const active = Math.round(value) === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              title={preset.title}
              aria-pressed={active}
              className={cn(
                'focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-1 font-mono text-[11px] font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => onChange(preset.value, { immediate: true })}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Slider
          id={id}
          value={[sliderValue]}
          min={min}
          max={max}
          step={1}
          onValueChange={(next) => onChange(next[0] ?? value)}
          aria-label={`${label} angle`}
          className="min-w-0 flex-1 py-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5"
        />
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step="any"
          value={value}
          aria-label={`${label} value`}
          className="h-7 w-14 shrink-0 [appearance:textfield] rounded-md px-1.5 text-right font-mono text-xs tabular-nums [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setNumberValue(event.currentTarget.valueAsNumber)}
          onBlur={(event) => {
            if (event.currentTarget.value === '') setNumberValue(min);
          }}
        />
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-[color:var(--color-content-subtle)]">
        <Loader2 size={12} className="animate-spin" />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-[color:var(--color-content-subtle)]">
        <Check size={12} />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-[color:var(--color-content-danger,#f87171)]">
        <TriangleAlert size={12} />
        Not saved
      </span>
    );
  }
  return null;
}
