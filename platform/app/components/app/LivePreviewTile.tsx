import { Eye, Play } from "lucide-react";
import { Eyebrow } from "@/app/components/ui/Badge";

type LivePreviewTileProps = {
  showName: string;
  duration: string;
  /** 0 - 100 */
  progress?: number;
  elapsed?: string;
};

export function LivePreviewTile({
  showName,
  duration,
  progress = 0,
  elapsed = "0:00",
}: LivePreviewTileProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/15 bg-gradient-to-b from-surface-container-high via-surface-container to-surface-container-low p-8 shadow-[var(--shadow-card-hover)]">
      <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-tertiary/15 px-3 py-1 text-tertiary">
        <Eye size={14} strokeWidth={2} />
        <span className="text-[11px] font-bold uppercase tracking-widest">
          Live preview
        </span>
      </div>

      <div className="space-y-2">
        <Eyebrow tone="muted">Now showing</Eyebrow>
        <div className="flex items-end gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
            {showName}
          </h2>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-4">
        <button
          type="button"
          aria-label="Play preview"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[0_8px_24px_-8px_rgba(245,158,11,0.5)] transition-all hover:brightness-110 active:scale-95"
        >
          <Play size={18} strokeWidth={2.5} />
        </button>
        <div className="flex-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest/60">
            <div
              className="h-full rounded-full bg-tertiary shadow-[0_0_15px_rgba(143,213,255,0.6)] transition-all duration-200"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-tertiary/80">
            <span>{elapsed}</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      <p className="mt-8 max-w-md text-sm leading-relaxed text-on-surface-variant">
        A 2D / 3D simulator preview is on the roadmap. For now, head to the
        timeline tab to inspect every cue, or export to Finale 3D for a
        production-grade visualisation.
      </p>
    </div>
  );
}
