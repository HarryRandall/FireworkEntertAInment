'use client';

/**
 * Multishot editor, movie-editor style. A multishot fires from a single mortar,
 * so each shot only chooses its firework, when it fires, and the direction it is
 * aimed (pan/tilt). The stage at the top is a live 3D preview: clicking a
 * firework's aim marker selects it, while angle controls edit the horizontal
 * pan and depth tilt planes directly. Stable tracks below organise shots
 * without changing their physical launch position.
 *
 * Appearance is always locked; a multishot never changes how a firework looks.
 */

import { MultishotFinaleActions } from './MultishotFinaleActions';
import type { CakeEffect } from '@/lib/finale/document';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { usePreviewFullscreen } from '@/ui/firework-editor/previewFullscreen';
import {
  deleteMultishotShot,
  updateMultishot,
  upsertMultishotShot,
} from '@/app/(admin)/admin/multishots/actions';
import { useAdminBreadcrumbOverride } from '@/ui/shell/AdminShell';
import type { AimMarker } from '@/ui/replay/FireworkReplayCanvas';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { toast } from '@/ui/patterns/toast';
import type { AdminMultishotDetail } from '@/lib/admin.types';
import {
  clampMultishotPanDegrees,
  clampMultishotTimeSeconds,
  clampMultishotTiltDegrees,
  clampMultishotTrackIndex,
  MULTISHOT_MAX_DURATION_SECONDS,
  MULTISHOT_MAX_SHOT_COUNT,
  MULTISHOT_MAX_TRACK_COUNT,
} from '@/lib/admin/multishot-constraints';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import {
  MIN_TIMELINE_SECONDS,
  SAVE_DEBOUNCE_MS,
  SCRUB_COMMIT_MS,
  SaveState,
  PersistShotOptions,
  LocalShot,
  makeUid,
  shouldKeepShotSelection,
  toLocalShot,
  shotPersistenceSignature,
  nextShotSequenceIndex,
  timelineTrackCount,
  fireworkDurationOf,
  colorOf,
  burstCentre,
} from './multishot-model';
import { MetaBar } from './MultishotMetaBar';
import { PreviewStage } from './MultishotPreviewStage';
import { Timeline } from './MultishotTimeline';
import { Inspector } from './MultishotInspector';

// A multishot is one physical mortar; the whole sequence launches from origin.

// Mirrors the simulation's shell apex so a marker sits exactly where the burst
// pops. A multishot fires from the origin, so the base position is (0, 0, 0).

export function MultishotEditor({
  multishot,
  fireworkSpecs,
  finaleEffects,
}: {
  multishot: AdminMultishotDetail;
  fireworkSpecs: FireworkSpecification[];
  finaleEffects: CakeEffect[];
}) {
  const router = useRouter();
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    fullscreenContainerRef,
    fullscreenContainerProps,
  } = usePreviewFullscreen<HTMLElement>({ dialogLabel: `${multishot.name} preview` });

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
  const [shots, setShotsState] = useState<LocalShot[]>(() =>
    [...multishot.shots].sort((a, b) => a.sequenceIndex - b.sequenceIndex).map(toLocalShot),
  );
  const [visibleTrackCount, setVisibleTrackCount] = useState(() =>
    timelineTrackCount(multishot.shots),
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
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const saveChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const saveRevisionsRef = useRef<Map<string, number>>(new Map());
  const persistedShotIdsRef = useRef<Map<string, string>>(
    new Map(shots.filter((shot) => shot.id).map((shot) => [shot.uid, shot.id as string] as const)),
  );
  const isMountedRef = useRef(true);

  const commitShots = useCallback((updater: (current: LocalShot[]) => LocalShot[]) => {
    const next = updater(shotsRef.current);
    shotsRef.current = next;
    setShotsState(next);
    return next;
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

  const sortedFireworkSpecs = useMemo(
    () => [...fireworkSpecs].sort((a, b) => a.name.localeCompare(b.name)),
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

  const duration = Math.min(
    MULTISHOT_MAX_DURATION_SECONDS,
    Math.max(MIN_TIMELINE_SECONDS, multishot.durationSeconds ?? 0, Math.ceil(contentDuration) + 1),
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
  const selectedSpec = selectedShot ? specsById.get(selectedShot.fireworkId) : undefined;
  const nextSequenceIndex = nextShotSequenceIndex(shots);

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

  const setShotSaveState = useCallback(
    (uid: string, saveState: SaveState) => {
      commitShots((currentShots) =>
        currentShots.map((shot) => (shot.uid === uid ? { ...shot, saveState } : shot)),
      );
    },
    [commitShots],
  );

  const persistShot = useCallback(
    (shot: LocalShot, options: PersistShotOptions = {}): Promise<void> => {
      if (!shot.fireworkId) return Promise.resolve();

      const uid = shot.uid;
      const revision = (saveRevisionsRef.current.get(uid) ?? 0) + 1;
      saveRevisionsRef.current.set(uid, revision);
      if (options.updateUi !== false && isMountedRef.current) {
        setShotSaveState(uid, 'saving');
      }

      const previousSave = saveChainsRef.current.get(uid) ?? Promise.resolve();
      const task = previousSave
        .catch(() => undefined)
        .then(async () => {
          if (saveRevisionsRef.current.get(uid) !== revision) return;

          const persistedId = persistedShotIdsRef.current.get(uid) ?? shot.id;
          let result: Awaited<ReturnType<typeof upsertMultishotShot>>;
          try {
            result = await upsertMultishotShot({
              id: persistedId,
              multishotId: multishot.id,
              fireworkId: shot.fireworkId,
              sequenceIndex: shot.sequenceIndex,
              timelineTrackIndex: shot.timelineTrackIndex,
              timeOffsetSeconds: Number(shot.timeOffsetSeconds.toFixed(3)),
              panDegrees: Math.round(clampMultishotPanDegrees(shot.panDegrees)),
              tiltDegrees: Math.round(clampMultishotTiltDegrees(shot.tiltDegrees)),
              launchPositionIndex: 0,
              caliber: shot.caliber,
              notes: shot.notes,
            });
          } catch (error) {
            result = {
              ok: false,
              error: error instanceof Error ? error.message : 'Could not save shot.',
            };
          }

          if (result.ok) {
            // A later save for a newly inserted shot must update this row rather
            // than creating a duplicate, even if it was queued before insertion.
            persistedShotIdsRef.current.set(uid, result.id);
          }

          const currentShot = shotsRef.current.find((current) => current.uid === uid);
          const canUpdateUi =
            options.updateUi !== false &&
            isMountedRef.current &&
            saveRevisionsRef.current.get(uid) === revision &&
            currentShot != null &&
            shotPersistenceSignature(currentShot) === shotPersistenceSignature(shot) &&
            !saveTimersRef.current.has(uid);

          if (!canUpdateUi) return;
          if (!result.ok) {
            setShotSaveState(uid, 'error');
            toast.error(result.error);
            return;
          }
          commitShots((currentShots) =>
            currentShots.map((current) =>
              current.uid === uid ? { ...current, id: result.id, saveState: 'saved' } : current,
            ),
          );
        });

      saveChainsRef.current.set(uid, task);
      void task.finally(() => {
        if (saveChainsRef.current.get(uid) === task) {
          saveChainsRef.current.delete(uid);
        }
      });
      return task;
    },
    [commitShots, multishot.id, setShotSaveState],
  );

  const saveShotByUid = useCallback(
    (uid: string, options?: PersistShotOptions): Promise<void> => {
      const shot = shotsRef.current.find((current) => current.uid === uid);
      return shot ? persistShot(shot, options) : Promise.resolve();
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
          void saveShotByUid(uid);
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [saveShotByUid],
  );

  const flushPendingSaves = useCallback(
    async (options: PersistShotOptions = {}): Promise<void> => {
      const pendingTimers = [...saveTimersRef.current.entries()];
      saveTimersRef.current.clear();
      for (const [, timer] of pendingTimers) clearTimeout(timer);
      await Promise.allSettled(pendingTimers.map(([uid]) => saveShotByUid(uid, options)));
    },
    [saveShotByUid],
  );

  useEffect(() => {
    isMountedRef.current = true;

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') void flushPendingSaves();
    }

    function handlePageHide() {
      void flushPendingSaves({ updateUi: false });
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveTimersRef.current.size === 0 && saveChainsRef.current.size === 0) return;
      void flushPendingSaves({ updateUi: false });
      event.preventDefault();
      event.returnValue = true;
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      isMountedRef.current = false;
      void flushPendingSaves({ updateUi: false });
    };
  }, [flushPendingSaves]);

  const updateShot = useCallback(
    (uid: string, patch: Partial<LocalShot>, options?: { immediate?: boolean; save?: boolean }) => {
      const nextPatch = { ...patch };
      if (typeof nextPatch.panDegrees === 'number') {
        nextPatch.panDegrees = clampMultishotPanDegrees(nextPatch.panDegrees);
      }
      if (typeof nextPatch.tiltDegrees === 'number') {
        nextPatch.tiltDegrees = clampMultishotTiltDegrees(nextPatch.tiltDegrees);
      }
      if (typeof nextPatch.timeOffsetSeconds === 'number') {
        nextPatch.timeOffsetSeconds = clampMultishotTimeSeconds(nextPatch.timeOffsetSeconds);
      }
      if (typeof nextPatch.timelineTrackIndex === 'number') {
        const nextTrackIndex = clampMultishotTrackIndex(nextPatch.timelineTrackIndex);
        nextPatch.timelineTrackIndex = nextTrackIndex;
        setVisibleTrackCount((current) => Math.max(current, nextTrackIndex + 1));
      }
      let nextShot: LocalShot | null = null;
      commitShots((currentShots) =>
        currentShots.map((shot) => {
          if (shot.uid !== uid) return shot;
          nextShot = { ...shot, ...nextPatch, saveState: 'idle' };
          return nextShot;
        }),
      );
      if (options?.save === false) return;
      if (options?.immediate) {
        const timers = saveTimersRef.current;
        const existing = timers.get(uid);
        if (existing) {
          clearTimeout(existing);
          timers.delete(uid);
        }
        if (nextShot) void persistShot(nextShot);
      } else {
        scheduleSave(uid);
      }
    },
    [commitShots, persistShot, scheduleSave],
  );

  useEffect(() => {
    const defaultFireworkId = sortedFireworkSpecs[0]?.id;
    if (!defaultFireworkId) return;
    const shotWithoutFirework = shots.find((shot) => !shot.fireworkId);
    if (!shotWithoutFirework) return;
    updateShot(shotWithoutFirework.uid, { fireworkId: defaultFireworkId }, { immediate: true });
  }, [shots, sortedFireworkSpecs, updateShot]);

  const addShot = useCallback(
    (timelineTrackIndex = 0) => {
      const sequenceIndex = nextShotSequenceIndex(shotsRef.current);
      if (sequenceIndex > MULTISHOT_MAX_SHOT_COUNT) {
        toast.error(
          `A multishot can contain up to ${MULTISHOT_MAX_SHOT_COUNT.toLocaleString()} shots.`,
        );
        return;
      }
      const spec = sortedFireworkSpecs[0];
      if (!spec) {
        toast.error('Create a firework first, then add it to this multishot.');
        return;
      }
      const timeOffset = Math.round(contentDuration * 2) / 2;
      const shot: LocalShot = {
        uid: makeUid(),
        fireworkId: spec.id,
        timelineTrackIndex: clampMultishotTrackIndex(timelineTrackIndex),
        timeOffsetSeconds: Number.isFinite(timeOffset) ? clampMultishotTimeSeconds(timeOffset) : 0,
        panDegrees: 0,
        tiltDegrees: 0,
        sequenceIndex,
        caliber: spec.caliber,
        notes: '',
        saveState: 'saving',
      };
      commitShots((currentShots) => [...currentShots, shot]);
      setSelectedUid(shot.uid);
      void persistShot(shot);
    },
    [commitShots, contentDuration, persistShot, sortedFireworkSpecs],
  );

  const addTimelineTrack = useCallback(() => {
    setVisibleTrackCount((current) => Math.min(MULTISHOT_MAX_TRACK_COUNT, current + 1));
  }, []);

  const duplicateShot = useCallback(
    (uid: string) => {
      const source = shotsRef.current.find((shot) => shot.uid === uid);
      if (!source) return;
      const sequenceIndex = nextShotSequenceIndex(shotsRef.current);
      if (sequenceIndex > MULTISHOT_MAX_SHOT_COUNT) {
        toast.error(
          `A multishot can contain up to ${MULTISHOT_MAX_SHOT_COUNT.toLocaleString()} shots.`,
        );
        return;
      }
      const copy: LocalShot = {
        ...source,
        uid: makeUid(),
        id: undefined,
        timeOffsetSeconds: source.timeOffsetSeconds + 0.5,
        sequenceIndex,
        saveState: 'saving',
      };
      commitShots((currentShots) => [...currentShots, copy]);
      setSelectedUid(copy.uid);
      void persistShot(copy);
    },
    [commitShots, persistShot],
  );

  const deleteShot = useCallback(
    async (uid: string) => {
      const shot = shotsRef.current.find((current) => current.uid === uid);
      if (!shot) return;
      const originalIndex = shotsRef.current.findIndex((current) => current.uid === uid);
      const wasSelected = selectedUid === uid;
      const timers = saveTimersRef.current;
      const pendingTimer = timers.get(uid);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        timers.delete(uid);
      }

      // Invalidate queued saves, then wait for an active insert to expose its
      // database ID before deleting. This prevents a save landing after delete.
      saveRevisionsRef.current.set(uid, (saveRevisionsRef.current.get(uid) ?? 0) + 1);
      const pendingSave = saveChainsRef.current.get(uid);
      commitShots((currentShots) => currentShots.filter((current) => current.uid !== uid));
      if (wasSelected) setSelectedUid(null);
      if (pendingSave) await pendingSave;

      const persistedId = persistedShotIdsRef.current.get(uid) ?? shot.id;
      if (!persistedId) {
        saveRevisionsRef.current.delete(uid);
        return;
      }

      let result: Awaited<ReturnType<typeof deleteMultishotShot>>;
      try {
        result = await deleteMultishotShot({ id: persistedId, multishotId: multishot.id });
      } catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : 'Could not delete shot.',
        };
      }

      if (!result.ok) {
        if (isMountedRef.current) {
          const restoredShot = { ...shot, id: persistedId, saveState: 'error' as const };
          commitShots((currentShots) => {
            if (currentShots.some((current) => current.uid === uid)) return currentShots;
            const nextShots = [...currentShots];
            nextShots.splice(Math.min(originalIndex, nextShots.length), 0, restoredShot);
            return nextShots;
          });
          if (wasSelected) setSelectedUid(uid);
          toast.error(result.error);
        }
        return;
      }

      persistedShotIdsRef.current.delete(uid);
      saveRevisionsRef.current.delete(uid);
    },
    [commitShots, multishot.id, selectedUid],
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
      try {
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
      } catch (error) {
        setMetaError(error instanceof Error ? error.message : 'Could not save multishot.');
      }
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
      <MultishotFinaleActions
        id={multishot.id}
        effects={finaleEffects}
        importDisabled={metaDirty || isSavingMeta}
        onImported={(rows, savedDuration) => {
          const imported: LocalShot[] = rows.map((row) => ({
            uid: makeUid(),
            id: row.id,
            fireworkId: row.firework_id,
            sequenceIndex: row.sequence_index,
            timelineTrackIndex: row.timeline_track_index,
            timeOffsetSeconds: row.time_offset_seconds,
            panDegrees: row.pan_degrees,
            tiltDegrees: row.tilt_degrees,
            caliber: row.caliber,
            notes: row.notes ?? '',
            saveState: 'saved',
          }));
          commitShots(() => imported);
          saveRevisionsRef.current.clear();
          persistedShotIdsRef.current = new Map(imported.map((shot) => [shot.uid, shot.id ?? '']));
          setVisibleTrackCount(Math.max(1, rows.length));
          setSelectedUid(null);
          setDurationSeconds(savedDuration === null ? '' : String(savedDuration));
          handleReset();
        }}
        shots={shots.map((shot) => ({
          sequence_index: shot.sequenceIndex,
          time_offset_seconds: shot.timeOffsetSeconds,
          pan_degrees: shot.panDegrees,
          tilt_degrees: shot.tiltDegrees,
          firework_id: shot.fireworkId,
        }))}
        prepare={async () => {
          await flushPendingSaves();
          await Promise.all([...saveChainsRef.current.values()]);
          if (
            shotsRef.current.some(
              (shot) => !shot.id || shot.saveState === 'error' || shot.saveState === 'saving',
            )
          )
            return { ok: false, error: 'Save every shot before importing.' };
          return { ok: true };
        }}
      />
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
          fullscreenContainerRef={fullscreenContainerRef}
          fullscreenContainerProps={fullscreenContainerProps}
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
            fireworkSpecs={sortedFireworkSpecs}
            selectedSpec={selectedSpec}
            duration={duration}
            trackCount={visibleTrackCount}
            onChangeFirework={(fireworkId) => {
              const spec = specsById.get(fireworkId);
              updateShot(
                selectedShot.uid,
                { fireworkId, caliber: spec?.caliber ?? null },
                { immediate: true },
              );
            }}
            onChangeTime={(seconds) => updateShot(selectedShot.uid, { timeOffsetSeconds: seconds })}
            onCommitTime={(seconds) =>
              updateShot(selectedShot.uid, { timeOffsetSeconds: seconds }, { immediate: true })
            }
            onChangePan={(panDegrees, options) =>
              updateShot(selectedShot.uid, { panDegrees }, { immediate: options?.immediate })
            }
            onChangeTilt={(tiltDegrees, options) =>
              updateShot(selectedShot.uid, { tiltDegrees }, { immediate: options?.immediate })
            }
            onChangeTrack={(timelineTrackIndex) =>
              updateShot(selectedShot.uid, { timelineTrackIndex }, { immediate: true })
            }
            onDuplicate={() => duplicateShot(selectedShot.uid)}
            duplicateDisabled={nextSequenceIndex > MULTISHOT_MAX_SHOT_COUNT}
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
          trackCount={visibleTrackCount}
          disabled={!hasFireworks}
          addDisabled={!hasFireworks || nextSequenceIndex > MULTISHOT_MAX_SHOT_COUNT}
          onSelect={(uid) => {
            setSelectedUid(uid);
          }}
          onSeek={handleScrub}
          onMoveShot={(uid, seconds, commit) =>
            updateShot(uid, { timeOffsetSeconds: seconds }, { save: commit, immediate: commit })
          }
          onAdd={addShot}
          onAddTrack={addTimelineTrack}
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
