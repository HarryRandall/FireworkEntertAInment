'use client';

import { X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/ui/patterns/Button';

/** Samples kept in the rolling graph; at a 100 ms cadence this is the last eight seconds. */
export const FPS_HISTORY_SIZE = 80;
const FPS_GRAPH_WIDTH = 184;
const FPS_GRAPH_HEIGHT = 40;
const FPS_GRAPH_MAX = 120;
const FPS_CURVE_TENSION = 0.22;

type FpsGraphPoint = {
  x: number;
  y: number;
};

function fpsSampleToY(value: number): number {
  const clamped = Math.max(0, Math.min(FPS_GRAPH_MAX, value));
  return FPS_GRAPH_HEIGHT - (clamped / FPS_GRAPH_MAX) * FPS_GRAPH_HEIGHT;
}

function buildFpsGraphPoints(samples: number[], currentFps: number | null): FpsGraphPoint[] {
  const values = samples.length > 0 ? samples : currentFps == null ? [0] : [currentFps];
  const step = FPS_GRAPH_WIDTH / (FPS_HISTORY_SIZE - 1);

  return values.map((value, index) => ({
    x: FPS_GRAPH_WIDTH - (values.length - 1 - index) * step,
    y: fpsSampleToY(value),
  }));
}

function buildFpsGraphPath(samples: number[], currentFps: number | null): string {
  const points = buildFpsGraphPoints(samples, currentFps);
  if (points.length === 1) {
    const [{ y }] = points;
    return `M ${(FPS_GRAPH_WIDTH - 1).toFixed(2)} ${y.toFixed(2)} L ${FPS_GRAPH_WIDTH.toFixed(
      2,
    )} ${y.toFixed(2)}`;
  }

  const [first] = points;
  return points.slice(1).reduce(
    (path, point, index) => {
      const pointIndex = index + 1;
      const previous = points[pointIndex - 1];
      const beforePrevious = points[pointIndex - 2] ?? previous;
      const afterPoint = points[pointIndex + 1] ?? point;
      const cp1x = previous.x + (point.x - beforePrevious.x) * FPS_CURVE_TENSION;
      const cp1y = previous.y + (point.y - beforePrevious.y) * FPS_CURVE_TENSION;
      const cp2x = point.x - (afterPoint.x - previous.x) * FPS_CURVE_TENSION;
      const cp2y = point.y - (afterPoint.y - previous.y) * FPS_CURVE_TENSION;

      return `${path} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(
        2,
      )} ${cp2y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    },
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
  );
}

/** Rolling frame-rate history with high, low and latest readouts. */
export function FpsGraph({
  fps,
  samples,
  detail,
  onClose,
}: {
  fps: number | null;
  samples: number[];
  /** Optional secondary readout shown beneath the graph, such as the live particle count. */
  detail?: string;
  onClose: () => void;
}) {
  const path = useMemo(() => buildFpsGraphPath(samples, fps), [fps, samples]);
  const values = samples.length > 0 ? samples : fps == null ? [] : [fps];
  const high = values.length > 0 ? Math.round(Math.max(...values)) : null;
  const low = values.length > 0 ? Math.round(Math.min(...values)) : null;
  const latest = fps == null ? '--' : String(fps);

  return (
    <div
      data-testid="firework-fps-meter"
      className="pointer-events-none absolute top-3 left-3 z-10 w-[10.667rem] font-mono text-white/85"
      aria-label="FPS history graph"
    >
      <div className="relative grid grid-cols-[1.35rem_1fr_1.5rem] gap-1 rounded-md border border-white/20 bg-black/65 px-1.5 py-1 font-mono tabular-nums shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/15 hover:text-destructive pointer-events-auto absolute top-[2px] right-[2px] size-4 rounded-full bg-white/10 p-0 text-white/85 shadow-sm focus-visible:ring-white/30"
          type="button"
          aria-label="Close FPS graph"
          title="Close FPS graph"
          data-testid="firework-fps-close"
          onClick={onClose}
        >
          <X size={10} strokeWidth={2} />
        </Button>
        <div className="flex flex-col justify-between py-0.5 text-[9px] leading-none font-semibold text-white/60">
          <span>{high == null ? '--' : high}</span>
          <span>{low == null ? '--' : low}</span>
        </div>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${FPS_GRAPH_WIDTH} ${FPS_GRAPH_HEIGHT}`}
          className="h-10 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1={FPS_GRAPH_HEIGHT * 0.5}
            x2={FPS_GRAPH_WIDTH}
            y2={FPS_GRAPH_HEIGHT * 0.5}
            className="stroke-white/15"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path}
            className="fill-none stroke-white drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex h-10 items-end justify-end pb-0.5 text-[11px] leading-none font-semibold text-white">
          {latest}
        </div>
      </div>
      {detail ? (
        <div className="mt-1 w-fit rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] leading-none text-white/75 tabular-nums">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
