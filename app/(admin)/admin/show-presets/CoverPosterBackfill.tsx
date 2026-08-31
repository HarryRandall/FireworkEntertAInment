'use client';

/** Interactive backfill grid: renders missing preset covers to PNGs and uploads them. */

import { useMemo, useRef, useState } from 'react';
import { ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { CoverPoster } from '@/components/covers/CoverPoster';
import { Badge } from '@/components/design-system/Badge';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import { renderCoverToPng } from '@/lib/render-cover-poster';
import { backfillPresetCoverPoster } from '@/app/actions/admin-cover-posters';
import type { CoverBackfillPreset } from '@/lib/admin/cover-posters.server';

type ItemStatus = 'idle' | 'rendering' | 'done' | 'error';

type PresetState = {
  coverImagePath: string | null;
  status: ItemStatus;
  message?: string;
};

// Six cards fill the widest grid row. The remaining poster images can use the
// browser's native lazy-loading path instead of competing for initial bandwidth.
const EAGER_POSTER_COUNT = 6;

export function CoverPosterBackfill({ presets }: { presets: CoverBackfillPreset[] }) {
  const [states, setStates] = useState<Record<string, PresetState>>(() => {
    const init: Record<string, PresetState> = {};
    for (const preset of presets) {
      init[preset.id] = { coverImagePath: preset.coverImagePath, status: 'idle' };
    }
    return init;
  });
  const [bulkRunning, setBulkRunning] = useState(false);
  const [activeRenderId, setActiveRenderId] = useState<string | null>(null);
  const renderLockRef = useRef(false);

  const missing = useMemo(
    () => presets.filter((preset) => preset.cover && !states[preset.id]?.coverImagePath),
    [presets, states],
  );
  const missingCount = missing.length;
  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activeRenderId) ?? null,
    [activeRenderId, presets],
  );
  const isBusy = bulkRunning || activeRenderId !== null;

  function setState(id: string, next: Partial<PresetState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  async function renderOne(preset: CoverBackfillPreset) {
    if (!preset.cover || renderLockRef.current) return;
    renderLockRef.current = true;
    setActiveRenderId(preset.id);
    setState(preset.id, { status: 'rendering', message: undefined });
    try {
      const dataUrl = await renderCoverToPng(preset.cover);
      const result = await backfillPresetCoverPoster(preset.id, dataUrl);
      if (result.ok) {
        setState(preset.id, { coverImagePath: result.path, status: 'done' });
      } else {
        setState(preset.id, { status: 'error', message: result.error });
      }
    } catch (error) {
      setState(preset.id, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Render failed',
      });
    } finally {
      renderLockRef.current = false;
      setActiveRenderId((current) => (current === preset.id ? null : current));
    }
  }

  async function renderMissing() {
    if (renderLockRef.current || bulkRunning || missingCount === 0) return;
    setBulkRunning(true);
    try {
      for (const preset of missing) {
        // Await the full render, upload, and confirmed row update before the
        // next hidden renderer mounts.
        await renderOne(preset);
      }
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="text-on-surface-variant text-sm"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {activePreset
            ? `Rendering ${activePreset.title} poster…`
            : `${missingCount} of ${presets.length} presets need a poster.`}
        </p>
        <Button
          onClick={renderMissing}
          disabled={isBusy || missingCount === 0}
          loading={bulkRunning}
        >
          {bulkRunning ? (
            'Rendering posters…'
          ) : (
            <>
              <RefreshCw aria-hidden className="size-4" />
              Render missing posters
            </>
          )}
        </Button>
      </div>

      {/* Rendered inside the curated-shows dialog (~64rem), so column count is
          capped lower than the old full-width page grid. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map((preset, index) => {
          const state = states[preset.id] ?? {
            coverImagePath: preset.coverImagePath,
            status: 'idle' as ItemStatus,
          };
          const hasPoster = Boolean(state.coverImagePath);
          const isRendering = state.status === 'rendering';
          return (
            <Card key={preset.id} radius="md" className="overflow-hidden" aria-busy={isRendering}>
              <div className="bg-surface-container relative aspect-[4/5] w-full">
                {preset.cover ? (
                  <CoverPoster
                    imagePath={state.coverImagePath}
                    fallbackCover={preset.cover}
                    eager={index < EAGER_POSTER_COUNT}
                  />
                ) : (
                  <div className="text-on-surface-variant flex h-full items-center justify-center text-xs">
                    No cover
                  </div>
                )}
                {isRendering ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2
                      aria-hidden
                      className="size-5 animate-spin text-white motion-reduce:animate-none"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="text-on-surface truncate text-sm font-medium">{preset.title}</div>
                  <div className="text-on-surface-variant truncate font-mono text-[11px]">
                    {preset.slug}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isRendering ? (
                    <Badge tone="neutral" solid>
                      Rendering
                    </Badge>
                  ) : state.status === 'error' ? (
                    <Badge tone="danger" solid>
                      Failed
                    </Badge>
                  ) : hasPoster ? (
                    <Badge tone="success" solid>
                      Poster
                    </Badge>
                  ) : (
                    <Badge tone="warning" solid>
                      Missing
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void renderOne(preset)}
                    disabled={isBusy || !preset.cover}
                    loading={isRendering}
                    aria-label={
                      isRendering
                        ? `Rendering ${preset.title} poster`
                        : `${hasPoster ? 'Re-render' : 'Render'} ${preset.title} poster`
                    }
                  >
                    {isRendering ? (
                      <span className="sr-only">Rendering…</span>
                    ) : (
                      <ImageIcon aria-hidden className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              {state.status === 'error' && state.message ? (
                <div className="text-error px-3 pb-3 text-[11px]" role="alert">
                  {state.message}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
