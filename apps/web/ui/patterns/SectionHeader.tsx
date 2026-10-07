import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderSize = 'sm' | 'lg';

const titleClasses: Record<SectionHeaderSize, string> = {
  sm: 'text-sm font-medium',
  lg: 'text-2xl font-bold tracking-tight',
};

/** Shared responsive page and section heading with optional navigation focus. */
export function SectionHeader({
  title,
  description,
  action,
  size = 'lg',
  className,
  as: Heading = 'h2',
  headingRef,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: SectionHeaderSize;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className={cn('min-w-0 flex-1', size === 'lg' ? 'space-y-2' : 'space-y-1')}>
        <Heading
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={cn('text-foreground', titleClasses[size])}
        >
          {title}
        </Heading>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
