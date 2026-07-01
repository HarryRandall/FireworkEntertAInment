/** SectionHeader — shared title + description + optional action row for content sections and card headers. */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderSize = 'sm' | 'lg';

const titleClasses: Record<SectionHeaderSize, string> = {
  sm: 'text-sm font-medium',
  lg: 'text-2xl font-bold tracking-tight',
};

export function SectionHeader({
  title,
  description,
  action,
  size = 'lg',
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: SectionHeaderSize;
  className?: string;
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className={cn(size === 'lg' ? 'space-y-2' : 'space-y-1')}>
        <h2 className={cn('text-foreground', titleClasses[size])}>{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
