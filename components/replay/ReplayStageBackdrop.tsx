import { cn } from '@/lib/utils';

/**
 * Plain dark stage shown only while the real WebGL scene is booting. Keep this
 * intentionally quiet: no fake stars, fireworks, or decorative placeholder
 * details that compete with the actual renderer once it arrives.
 */
export function ReplayStageBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('absolute inset-0 overflow-hidden rounded-[inherit] bg-[#020409]', className)}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#03050b_0%,#070b15_56%,#020307_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_58%,rgba(255,255,255,0.045),transparent_46%)]" />
    </div>
  );
}
