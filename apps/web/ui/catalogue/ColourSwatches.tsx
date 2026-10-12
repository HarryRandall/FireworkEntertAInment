import { cn } from '@/lib/utils';

/** Overlapping firework colour dots. Colours are catalogue content, not theme tokens. */
export function ColourSwatches({
  colours,
  size = 'sm',
  className,
}: {
  colours: readonly string[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (colours.length === 0) return null;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center',
        size === 'sm' ? '-space-x-1' : 'gap-1.5',
        className,
      )}
      role="img"
      aria-label={`${colours.length} ${colours.length === 1 ? 'colour' : 'colours'}`}
    >
      {colours.map((colour) => (
        <span
          key={colour}
          className={cn(
            'ring-card rounded-full ring-2',
            size === 'sm' ? 'h-3.5 w-3.5' : 'border-border h-6 w-6 border ring-0',
          )}
          style={{ backgroundColor: colour }}
          title={colour}
        />
      ))}
    </span>
  );
}
