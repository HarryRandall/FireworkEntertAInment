'use client';

import { useTransition } from 'react';
import { Loader2, ShieldAlert, Undo2 } from 'lucide-react';
import { stopImpersonationAction } from '@/lib/access/impersonation-actions.server';
import { toast } from '@/ui/patterns/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/primitives/tooltip';
import type { ActiveImpersonation } from '@/lib/access/impersonation.types';
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
        aria-busy={pending}
        onClick={stop}
        className={cn(
          'bg-status-warning-subtle text-status-warning focus-visible:outline-status-warning flex h-8 w-8 min-w-8 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--color-status-warning)_44%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-warning)_16%,transparent)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        {pending ? (
          <Loader2
            size={15}
            strokeWidth={1.85}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <ShieldAlert size={15} strokeWidth={1.85} aria-hidden="true" />
        )}
      </button>
    );

    return (
      <Tooltip>
        <TooltipTrigger asChild>{compactControl}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="bg-foreground text-background max-w-56"
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
        'bg-status-warning-subtle text-foreground flex w-full items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-status-warning)_42%,transparent)] px-2 py-1.5 text-left',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-semibold">Impersonating</span>
        <span suppressHydrationWarning className="text-foreground truncate text-[11px] font-medium">
          Expires at {expiresAt}
        </span>
      </div>
      <button
        type="button"
        aria-label="Stop impersonating"
        disabled={pending}
        aria-busy={pending}
        onClick={stop}
        className="border-border bg-card text-foreground hover:bg-muted focus-visible:outline-foreground flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2
            size={14}
            strokeWidth={1.85}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Undo2 size={14} strokeWidth={1.85} aria-hidden="true" />
        )}
        Stop
      </button>
    </section>
  );
}
