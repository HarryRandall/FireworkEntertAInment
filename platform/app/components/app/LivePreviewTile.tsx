/**
 * LivePreviewTile — decorative "now showing" tile used on the
 * authenticated dashboard route. Displays a clamped 0–100 progress
 * value and an elapsed-time label; not wired to a real player.
 */
import { Eye, Play } from 'lucide-react';
import { Eyebrow } from '@/app/components/ui/Badge';

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
  elapsed = '0:00',
}: LivePreviewTileProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div className="border-outline-variant/15 from-surface-container-high via-surface-container to-surface-container-low relative overflow-hidden rounded-2xl border bg-gradient-to-b p-8 shadow-[var(--shadow-card-hover)]">
      <div className="bg-tertiary/15 text-tertiary absolute top-6 right-6 flex items-center gap-2 rounded-full px-3 py-1">
        <Eye size={14} strokeWidth={2} />
        <span className="text-[11px] font-bold tracking-widest uppercase">Live preview</span>
      </div>

      <div className="space-y-2">
        <Eyebrow tone="muted">Now showing</Eyebrow>
        <div className="flex items-end gap-3">
          <h2 className="text-on-surface text-3xl font-bold tracking-tight md:text-4xl">
            {showName}
          </h2>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-4">
        <button
          type="button"
          aria-label="Play preview"
          className="bg-primary-container text-on-primary-container flex h-12 w-12 items-center justify-center rounded-full shadow-[var(--shadow-cta)] transition-all hover:brightness-110 active:scale-95"
        >
          <Play size={18} strokeWidth={2.5} />
        </button>
        <div className="flex-1">
          <div className="bg-surface-container-highest/60 h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-tertiary h-full rounded-full shadow-[0_0_15px_color-mix(in_srgb,var(--color-tertiary)_55%,transparent)] transition-all duration-200"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <div className="text-tertiary/80 mt-2 flex justify-between font-mono text-[11px] tabular-nums">
            <span>{elapsed}</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      <p className="text-on-surface-variant mt-8 max-w-md text-sm leading-relaxed">
        A 2D / 3D simulator preview is on the roadmap. For now, head to the timeline tab to inspect
        every cue, or export to Finale 3D for a production-grade visualisation.
      </p>
    </div>
  );
}
