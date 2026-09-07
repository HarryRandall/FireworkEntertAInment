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
  as: Heading = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: SectionHeaderSize;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className={cn(size === 'lg' ? 'space-y-2' : 'space-y-1')}>
        <Heading className={cn('text-foreground', titleClasses[size])}>{title}</Heading>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
