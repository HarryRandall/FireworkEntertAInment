'use client';

/** Interactive backfill grid: renders missing preset covers to PNGs and uploads them. */

import { useMemo, useState } from 'react';
import { ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { CoverPoster } from '@/app/components/app/CoverPoster';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { renderCoverToPng } from '@/lib/render-cover-poster';
import { backfillPresetCoverPoster } from '@/app/actions/admin-cover-posters';
import type { CoverBackfillPreset } from '@/lib/admin/cover-posters.server';

type ItemStatus = 'idle' | 'rendering' | 'done' | 'error';

type PresetState = {
  coverImagePath: string | null;
  status: ItemStatus;
  message?: string;
};

export function CoverPosterBackfill({ presets }: { presets: CoverBackfillPreset[] }) {
  const [states, setStates] = useState<Record<string, PresetState>>(() => {
    const init: Record<string, PresetState> = {};
    for (const preset of presets) {
      init[preset.id] = { coverImagePath: preset.coverImagePath, status: 'idle' };
    }
    return init;
  });
  const [running, setRunning] = useState(false);

  const missing = useMemo(
    () => presets.filter((preset) => preset.cover && !states[preset.id]?.coverImagePath),
    [presets, states],
  );
  const missingCount = missing.length;

  function setState(id: string, next: Partial<PresetState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  async function renderOne(preset: CoverBackfillPreset) {
    if (!preset.cover) return;
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
    }
  }

  async function renderMissing() {
    if (running || missingCount === 0) return;
    setRunning(true);
    for (const preset of missing) {
      // Sequential so only one hidden WebGL context exists at a time.
      await renderOne(preset);
    }
    setRunning(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-on-surface-variant text-sm">
          {missingCount} of {presets.length} presets need a poster.
        </p>
        <Button onClick={renderMissing} disabled={running || missingCount === 0}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Render missing posters
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map((preset) => {
          const state = states[preset.id] ?? {
            coverImagePath: preset.coverImagePath,
            status: 'idle' as ItemStatus,
          };
          const hasPoster = Boolean(state.coverImagePath);
          const isRendering = state.status === 'rendering';
          return (
            <Card key={preset.id} radius="md" className="overflow-hidden">
              <div className="bg-surface-container relative aspect-[4/5] w-full">
                {preset.cover ? (
                  <CoverPoster cover={preset.cover} imagePath={state.coverImagePath} eager />
                ) : (
                  <div className="text-on-surface-variant flex h-full items-center justify-center text-xs">
                    No cover
                  </div>
                )}
                {isRendering ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="size-5 animate-spin text-white" />
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
                  {hasPoster ? (
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
                    onClick={() => renderOne(preset)}
                    disabled={running || !preset.cover || isRendering}
                    aria-label={`Re-render ${preset.title} poster`}
                  >
                    <ImageIcon className="size-4" />
                  </Button>
                </div>
              </div>
              {state.status === 'error' && state.message ? (
                <div className="text-error px-3 pb-3 text-[11px]">{state.message}</div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
