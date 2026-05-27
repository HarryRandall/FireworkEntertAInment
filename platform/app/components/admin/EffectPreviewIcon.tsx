import type { AdminEffectPreview } from '@/lib/admin.types';
import { cn } from '@/lib/utils';

type Props = {
  preview: AdminEffectPreview;
  size?: 'sm' | 'md';
  className?: string;
};

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
};

export function EffectPreviewIcon({ preview, size = 'sm', className }: Props) {
  const colors = preview.colors.length > 0 ? preview.colors : ['#00e5ff', '#8b5cf6'];
  const primary = colors[0] ?? '#00e5ff';
  const secondary = colors[1] ?? primary;
  const tertiary = colors[2] ?? secondary;

  return (
    <span
      aria-label={`${preview.label} preview`}
      role="img"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[#05070d]',
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 44%, ${primary} 0 7%, transparent 8%),
          radial-gradient(circle at 35% 35%, ${secondary} 0 5%, transparent 6%),
          radial-gradient(circle at 65% 34%, ${tertiary} 0 5%, transparent 6%),
          radial-gradient(circle at 50% 50%, ${primary}66 0 28%, transparent 44%),
          linear-gradient(180deg, #05070d, #111827)`,
      }}
    >
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 opacity-70"
      />
      <span
        aria-hidden
        className="absolute bottom-1 left-1/2 h-3 w-px -translate-x-1/2 bg-white/35"
      />
    </span>
  );
}
