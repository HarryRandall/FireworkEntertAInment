'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { InfoTooltip } from '@/components/design-system/InfoTooltip';
import { cn } from '@/lib/utils';

export const CONTROL_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-x-6 gap-y-4';

export function PanelSection({
  title,
  titleAccessory,
  action,
  inactive = false,
  children,
}: {
  title: string;
  titleAccessory?: ReactNode;
  action?: ReactNode;
  inactive?: boolean;
  children: ReactNode;
}) {
  const titleClassName = cn(
    'text-sm font-semibold',
    inactive ? 'text-muted-foreground' : 'text-[color:var(--color-content-emphasis)]',
  );

  return (
    <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex min-h-10 items-center gap-2.5">
        <div className="flex min-h-10 items-center gap-2">
          <h3 className={titleClassName}>{title}</h3>
        </div>
        {titleAccessory ? <div className="flex items-center">{titleAccessory}</div> : null}
        {action ? <div className="ml-auto flex items-center gap-2.5">{action}</div> : null}
      </div>
      <div className={cn('transition-opacity', inactive && 'opacity-55')}>{children}</div>
    </div>
  );
}

export function SubSection({
  title,
  hint,
  action,
  defaultExpanded = false,
  children,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        expanded
          ? 'border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)]'
          : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)]/40',
      )}
    >
      {/* Tooltip and action controls stay outside the disclosure button to avoid nested triggers. */}
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          className="focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors outline-none hover:bg-[color:var(--color-bg-subtle)]/60 focus-visible:ring-2"
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              !expanded && '-rotate-90',
            )}
            aria-hidden
          />
          <span className="text-[13px] font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
            {title}
          </span>
        </button>
        {hint ? (
          <div className="flex shrink-0 items-center pr-3">
            <InfoTooltip text={hint} />
          </div>
        ) : null}
        {action ? <div className="flex shrink-0 items-center pr-3">{action}</div> : null}
      </div>
      {expanded ? (
        <div
          id={contentId}
          className="border-t border-[color:var(--color-border-subtle)] px-3 pt-3 pb-3.5"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function AdvancedControls({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="col-span-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="focus-visible:ring-ring/50 -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-[color:var(--color-content-subtle)] transition-colors outline-none hover:text-[color:var(--color-content-emphasis)] focus-visible:ring-2"
      >
        <ChevronDown
          className={cn('size-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
          aria-hidden
        />
        {open ? 'Hide advanced' : 'Advanced'}
      </button>
      {open ? (
        <div id={contentId} className={cn('mt-3', CONTROL_GRID_CLASS)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
