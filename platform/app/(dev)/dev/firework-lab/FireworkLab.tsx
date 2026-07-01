'use client';

/**
 * Firework Lab — dev playground that fires each effect in the catalogue into
 * the real FireworkReplayCanvas so the redo can be verified visually. The
 * selected effect renders side by side with the Brocade reference (two launch
 * positions in one canvas) for direct A/B comparison.
 *
 * Designs are compiled from the same `catalogueEffectModelJson` the clean-slate
 * reseed migration writes to `public.firework_effects.model_json`, so what you
 * see here is what the runtime will render from the database. The right-hand
 * panel exposes the full set of renderer controls (reusing the admin editor's
 * control components); Save writes the edited `model_json` back to the live
 * `firework_effects` row, and that becomes the version the app renders.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Save, Undo2 } from 'lucide-react';
import {
  CATALOGUE_BY_SLUG,
  FIREWORK_EFFECT_CATALOGUE,
  catalogueEffectModelJson,
  type CatalogueEffect,
} from '@/lib/fireworks/effect-catalogue';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import { DEFAULT_FIREWORK_SPEC } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';
import { updateEffect } from '@/app/actions/admin-effects';
import {
  PreviewFullscreenBackdrop,
  usePreviewFullscreen,
} from '@/app/components/admin/previewFullscreen';
import { ReplayTransportControls } from '@/app/components/app/ReplayTransportControls';
import { Button } from '@/app/components/ui/Button';
import { toast } from '@/app/components/ui/toast';
import { cn } from '@/lib/utils';
import { FireworkLabControls } from './FireworkLabControls';
import { loadLabEffect, type LabEffect } from './actions';

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <div className="h-full w-full bg-black" /> },
);

type JsonRecord = Record<string, unknown>;

const CUE_TIME_SECONDS = 0.05;
const LAB_LAUNCH_POSITIONS: LaunchPosition[] = [
  { x: -260, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 260, y: 0, z: 0 },
];

const DEFAULT_SELECTED = CATALOGUE_BY_SLUG['peony'] ?? FIREWORK_EFFECT_CATALOGUE[0];

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

function canonicalModelFor(effect: CatalogueEffect): JsonRecord {
  return canonicaliseEffectModelJson(catalogueEffectModelJson(effect)) as JsonRecord;
}

function buildCue(
  model: JsonRecord,
  meta: {
    slug: string;
    name: string;
    description: string;
    sortOrder: number;
    patternKey: string;
  },
  launchIndex: number,
  palette: string[],
): ReplayCue {
  const design = compileFireworkDesign({
    baseModel: model,
    primaryColor: palette[0],
    colorPalette: palette,
  });
  const duration = Math.max(
    4,
    Math.ceil((CUE_TIME_SECONDS + estimateDesignDurationSeconds(design)) * 2) / 2,
  );
  return {
    id: `${meta.slug}-lab-${launchIndex}`,
    position: launchIndex + 1,
    timeSeconds: CUE_TIME_SECONDS,
    description: meta.description,
    productId: meta.slug,
    launchPositionIndex: launchIndex,
    firework: {
      id: meta.slug,
      slug: meta.slug,
      name: meta.name,
      description: meta.description,
      sortOrder: meta.sortOrder,
      durationSeconds: duration,
      heightMeters: null,
      caliber: null,
      shotCount: 1,
      spec: DEFAULT_FIREWORK_SPEC,
      rawSpec: model,
      renderDesign: design,
      baseEffect: {
        id: meta.slug,
        slug: meta.slug,
        name: meta.name,
        patternKey: meta.patternKey,
      },
      variant: null,
    },
  };
}

// Coalesce heavyweight `elapsed` commits during a timeline drag to ~15Hz so a
// fast scrub does not re-render the lab on every input event. The engine ref
// still updates at full input rate so the 3D seeks immediately.
const SCRUB_COMMIT_INTERVAL_MS = 67;

export function FireworkLab() {
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [selectedSlug, setSelectedSlug] = useState<string>('peony');
  const [showReference, setShowReference] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hovered, setHovered] = useState(true);
  // Draft model_json for the selected effect. Starts from the TypeScript
  // catalogue so the preview is instant; edits mutate renderDefaults in place.
  const [draft, setDraft] = useState<JsonRecord>(() => canonicalModelFor(DEFAULT_SELECTED));
  const [baselineSignature, setBaselineSignature] = useState<string>(() =>
    JSON.stringify(canonicalModelFor(DEFAULT_SELECTED)),
  );
  const [dbEffect, setDbEffect] = useState<LabEffect | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const playbackRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const isPlayingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrubCommitRef = useRef(0);
  const pendingScrubRef = useRef<number | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setHovered(true);
  }, [isPlaying]);

  const selected = CATALOGUE_BY_SLUG[selectedSlug] ?? FIREWORK_EFFECT_CATALOGUE[0];
  const reference = CATALOGUE_BY_SLUG['brocade'];

  const referenceModel = useMemo(() => canonicalModelFor(reference), [reference]);

  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel: draft,
        primaryColor: selected.previewPalette[0],
        colorPalette: selected.previewPalette,
      }),
    [draft, selected],
  );

  const previewDuration = useMemo(() => {
    const estimated = CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(5, Math.ceil(estimated * 1.4));
  }, [previewDesign]);

  const calibrationDefaults = useMemo(
    () => readRecord(canonicalModelFor(selected), 'renderDefaults'),
    [selected],
  );
  const renderDefaults = useMemo(() => readRecord(draft, 'renderDefaults'), [draft]);

  const cues = useMemo<ReplayCue[]>(() => {
    const list: ReplayCue[] = [];
    const selectedIndex = showReference ? 2 : 1;
    if (showReference) {
      list.push(
        buildCue(
          referenceModel,
          {
            slug: reference.slug,
            name: reference.name,
            description: reference.description,
            sortOrder: reference.sortOrder,
            patternKey: reference.patternKey,
          },
          0,
          reference.previewPalette,
        ),
      );
    }
    list.push(
      buildCue(
        draft,
        {
          slug: selected.slug,
          name: selected.name,
          description: selected.description,
          sortOrder: selected.sortOrder,
          patternKey: selected.patternKey,
        },
        selectedIndex,
        selected.previewPalette,
      ),
    );
    return list;
  }, [reference, referenceModel, selected, draft, showReference]);

  const draftSignature = JSON.stringify(draft);
  const isDirty = draftSignature !== baselineSignature;

  const stopPlayback = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const restart = useCallback(() => {
    stopPlayback();
    playbackRef.current = 0;
    setElapsed(0);
    startedAtRef.current = performance.now();
    setIsPlaying(true);
  }, [stopPlayback]);

  const togglePlay = useCallback(() => {
    if (playbackRef.current >= previewDuration - 0.05) {
      restart();
      return;
    }
    setIsPlaying((playing) => !playing);
  }, [previewDuration, restart]);

  const onScrub = useCallback(
    (value: number) => {
      stopPlayback();
      const clamped = Math.max(0, Math.min(previewDuration, value));
      // Engine ref tracks the drag at full rate; the heavyweight `elapsed`
      // state (which re-renders the whole lab) is coalesced to ~15Hz.
      playbackRef.current = clamped;
      pendingScrubRef.current = clamped;
      const now = performance.now();
      if (now - lastScrubCommitRef.current >= SCRUB_COMMIT_INTERVAL_MS) {
        lastScrubCommitRef.current = now;
        setElapsed(clamped);
      }
    },
    [previewDuration, stopPlayback],
  );

  const commitScrub = useCallback(() => {
    const pending = pendingScrubRef.current;
    if (pending == null) return;
    pendingScrubRef.current = null;
    lastScrubCommitRef.current = 0;
    setElapsed(pending);
  }, []);

  // Show the transport + camera controls on mouse movement, then auto-hide
  // while playing so the preview stays clean. Paused state stays visible.
  const armHide = useCallback(() => {
    setHovered(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlayingRef.current) {
      hideTimerRef.current = setTimeout(() => setHovered(false), 2800);
    }
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (isPlaying) armHide();
  }, [isPlaying, armHide]);

  const controlsVisible = hovered || !isPlaying;

  // Drive smooth playback from a RAF loop, writing the playhead into a ref the
  // canvas reads every frame and throttling React state updates to ~15Hz.
  useEffect(() => {
    if (!isPlaying) return;
    let lastUiUpdate = 0;
    startedAtRef.current = performance.now() - playbackRef.current * 1000;
    function tick(now: number) {
      const next = (now - startedAtRef.current) / 1000;
      if (next >= previewDuration) {
        playbackRef.current = previewDuration;
        setElapsed(previewDuration);
        setIsPlaying(false);
        rafRef.current = null;
        return;
      }
      playbackRef.current = next;
      if (now - lastUiUpdate >= 66) {
        lastUiUpdate = now;
        setElapsed(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, previewDuration]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // Re-fire whenever the selection changes.
  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug, showReference]);

  // Reset the draft to the catalogue baseline for the newly selected effect and
  // load its live database row so Save can target the right `firework_effects`
  // row without clobbering existing style-default links.
  useEffect(() => {
    let cancelled = false;
    const effect = CATALOGUE_BY_SLUG[selectedSlug] ?? FIREWORK_EFFECT_CATALOGUE[0];
    const original = canonicalModelFor(effect);
    setDraft(original);
    setBaselineSignature(JSON.stringify(original));
    setDbEffect(null);
    setDbError(null);
    setSaveError(null);
    setDbLoading(true);
    loadLabEffect(effect.slug)
      .then((result) => {
        if (cancelled) return;
        setDbLoading(false);
        if (result.ok) {
          setDbEffect(result.effect);
        } else {
          setDbError(result.error);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setDbLoading(false);
        setDbError(error instanceof Error ? error.message : 'Could not load the effect.');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const updateDraftDefaults = useCallback((updater: (defaults: JsonRecord) => void) => {
    setDraft((current) => {
      const next = cloneRecord(canonicaliseEffectModelJson(current) as JsonRecord);
      const defaults = ensureRecord(next, 'renderDefaults');
      updater(defaults);
      return next;
    });
  }, []);

  const revertDraft = useCallback(() => {
    const original = canonicalModelFor(selected);
    setDraft(original);
    setBaselineSignature(JSON.stringify(original));
    setSaveError(null);
    restart();
  }, [selected, restart]);

  const saveDraft = useCallback(() => {
    if (!dbEffect || saving) return;
    setSaveError(null);
    setSaving(true);
    const modelJsonString = JSON.stringify(canonicaliseEffectModelJson(draft), null, 2);
    updateEffect({
      id: dbEffect.id,
      expectedUpdatedAt: dbEffect.updatedAt,
      name: dbEffect.name,
      description: dbEffect.description ?? '',
      patternKey: dbEffect.patternKey,
      sortOrder: dbEffect.sortOrder,
      starStyleDefaultId: dbEffect.starStyleDefaultId ?? null,
      trailStyleDefaultId: dbEffect.trailStyleDefaultId ?? null,
      styleDefaultIds: dbEffect.styleDefaultIds,
      modelJson: modelJsonString,
    })
      .then((result) => {
        setSaving(false);
        if (!result.ok) {
          setSaveError(result.error);
          toast.error(result.error);
          return;
        }
        setDbEffect((cur) => (cur ? { ...cur, updatedAt: result.updatedAt } : cur));
        setBaselineSignature(JSON.stringify(canonicaliseEffectModelJson(draft)));
        toast.success(`${selected.name} saved to the catalogue`);
      })
      .catch((error) => {
        setSaving(false);
        const message = error instanceof Error ? error.message : 'Could not save the effect.';
        setSaveError(message);
        toast.error(message);
      });
  }, [dbEffect, draft, saving, selected.name]);

  const canSave = Boolean(dbEffect) && !dbLoading && !saving && isDirty;

  return (
    <div className="bg-background text-on-background flex h-screen w-full flex-col">
      <header className="border-outline-variant/15 flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Firework Lab</h1>
          <p className="text-on-surface/60 text-xs">
            Calibrate catalogue effects against the Brocade reference, then save to the live
            database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-on-surface/50 hidden text-xs lg:inline">
            Brocade at left · selected at right
          </span>
          <div className="bg-outline-variant/20 hidden h-5 w-px sm:block" />
          {isDirty ? <span className="text-xs font-medium text-amber-300">Unsaved</span> : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={revertDraft}
            disabled={!isDirty || saving || !dbEffect}
          >
            <Undo2 size={15} />
            Revert
          </Button>
          <Button size="sm" onClick={saveDraft} disabled={!canSave} title={dbError ?? undefined}>
            <Save size={15} />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <div className="bg-outline-variant/20 hidden h-5 w-px sm:block" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReference((on) => !on)}
            aria-pressed={showReference}
          >
            {showReference ? <Eye size={15} /> : <EyeOff size={15} />}
            {showReference ? 'Reference on' : 'Reference off'}
          </Button>
          <Button size="sm" onClick={restart} aria-label="Restart from the start">
            <RotateCcw size={15} />
            Restart
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="border-outline-variant/15 w-60 shrink-0 overflow-y-auto border-r p-3">
          <ul className="flex flex-col gap-1">
            {FIREWORK_EFFECT_CATALOGUE.map((effect) => {
              const active = effect.slug === selectedSlug;
              return (
                <li key={effect.slug}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(effect.slug)}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      active
                        ? 'border-primary/40 bg-primary-container/20'
                        : 'hover:bg-surface-container-high/60 border-transparent',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{effect.name}</span>
                    </div>
                    <span className="text-on-surface/55 mt-0.5 block text-xs">{effect.slug}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <main
          className={cn(
            'relative min-h-0 flex-1',
            isFullscreen &&
              'fixed inset-[5vmin] z-[100] overflow-hidden rounded-2xl border border-white/12 bg-black shadow-[var(--shadow-modal)]',
          )}
          onMouseMove={armHide}
          onMouseEnter={() => setHovered(true)}
        >
          <LazyFireworkReplayCanvas
            cues={cues}
            elapsed={elapsed}
            playbackRef={playbackRef}
            launchPositions={LAB_LAUNCH_POSITIONS}
            muted={!isPlaying}
            interactive
            controlsVisible={controlsVisible}
            primeSnapshots={false}
            showLoadingBar
            loadingBarPosition="center"
          />
          <div
            className={cn(
              'pointer-events-none absolute right-4 bottom-4 left-4 flex items-end justify-between transition-opacity duration-200',
              controlsVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="border-outline-variant/15 max-w-md rounded-md border bg-black/55 px-3 py-2 backdrop-blur">
              <div className="text-sm font-semibold">{selected.name}</div>
              <div className="text-on-surface/70 text-xs">{selected.description}</div>
              <div className="text-on-surface/50 mt-1 flex items-center gap-2 text-[11px]">
                <span>geometry: {selected.geometry}</span>
                <span>·</span>
                <span>trail: {selected.trailProfile}</span>
              </div>
            </div>
          </div>

          {/* Transport: play/pause + scrub slider. Auto-hides while playing. */}
          <div
            className={cn(
              'absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-200',
              controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <ReplayTransportControls
              elapsed={elapsed}
              duration={previewDuration}
              isPlaying={isPlaying}
              step={0.01}
              playLabel="Play lab preview"
              pauseLabel="Pause lab preview"
              resetLabel="Restart lab preview"
              timelineLabel="Lab preview timeline"
              fullscreen={isFullscreen}
              onPlayPause={togglePlay}
              onReset={restart}
              onFullscreenToggle={toggleFullscreen}
              onScrub={onScrub}
              onScrubEnd={commitScrub}
            />
          </div>
          {isFullscreen ? <PreviewFullscreenBackdrop onExit={exitFullscreen} /> : null}
        </main>

        <section className="border-outline-variant/15 flex w-[440px] shrink-0 flex-col border-l">
          <div className="border-outline-variant/15 shrink-0 border-b px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{selected.name}</div>
                <div className="text-on-surface/50 truncate text-xs">{selected.slug}</div>
              </div>
              <div className="text-on-surface/50 shrink-0 text-[11px] tabular-nums">
                {dbLoading ? 'Loading…' : dbEffect ? 'Linked to DB' : 'Not linked'}
              </div>
            </div>
            {dbError ? <div className="mt-1 text-xs text-rose-300">{dbError}</div> : null}
            {saveError ? <div className="mt-1 text-xs text-rose-300">{saveError}</div> : null}
          </div>
          <div className="min-h-0 flex-1">
            <FireworkLabControls
              design={previewDesign}
              defaults={renderDefaults}
              calibrationDefaults={calibrationDefaults}
              disabled={saving}
              mutate={updateDraftDefaults}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
