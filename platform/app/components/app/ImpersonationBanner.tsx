'use client';

import { useTransition } from 'react';
import { Loader2, ShieldAlert, Undo2 } from 'lucide-react';
import { stopImpersonationAction } from '@/app/actions/impersonation';
import { toast } from '@/app/components/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ActiveImpersonation } from '@/lib/impersonation.types';
import { cn } from '@/lib/utils';

function identityLabel(identity: ActiveImpersonation['target']) {
  return identity.fullName || identity.email || 'Unnamed user';
}

function expiryLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'soon';
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney',
  })
    .format(date)
    .toLowerCase();
}

export function ImpersonationBanner({
  impersonation,
  collapsed = false,
  className,
}: {
  impersonation: ActiveImpersonation;
  collapsed?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const target = identityLabel(impersonation.target);
  const admin = identityLabel(impersonation.admin);
  const expiresAt = expiryLabel(impersonation.expiresAt);

  const stop = () => {
    startTransition(async () => {
      const result = await stopImpersonationAction();
      if (result?.ok === false) toast.error(result.error);
    });
  };

  if (collapsed) {
    const compactControl = (
      <button
        type="button"
        aria-label={`Stop impersonating ${target}`}
        disabled={pending}
        onClick={stop}
        className={cn(
          'flex h-8 w-8 min-w-8 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--color-status-warning)_44%,transparent)] bg-[color:var(--color-status-warning-subtle)] text-[color:var(--color-status-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-warning)_16%,transparent)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-status-warning)] disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        {pending ? (
          <Loader2 size={15} strokeWidth={1.85} className="animate-spin" />
        ) : (
          <ShieldAlert size={15} strokeWidth={1.85} />
        )}
      </button>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>{compactControl}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="max-w-56 bg-[color:var(--color-bg-inverted)] text-[color:var(--color-content-inverted)]"
        >
          Impersonating {target}. Started by {admin}, expires at {expiresAt}. Click to stop.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <section
      aria-label="Active impersonation session"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-status-warning)_42%,transparent)] bg-[color:var(--color-status-warning-subtle)] px-2 py-1.5 text-left text-[color:var(--color-content-emphasis)]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-semibold">Impersonating</span>
        <span
          suppressHydrationWarning
          className="truncate text-[11px] font-medium text-[color:var(--color-content-default)]"
        >
          Expires at {expiresAt}
        </span>
      </div>
      <button
        type="button"
        aria-label="Stop impersonating"
        disabled={pending}
        onClick={stop}
        className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] px-2 text-xs font-medium text-[color:var(--color-content-emphasis)] transition-colors hover:bg-[color:var(--color-bg-muted)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={14} strokeWidth={1.85} className="animate-spin" />
        ) : (
          <Undo2 size={14} strokeWidth={1.85} />
        )}
        Stop
      </button>
    </section>
  );
}
