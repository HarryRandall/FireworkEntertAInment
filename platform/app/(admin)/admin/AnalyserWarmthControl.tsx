'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Gauge } from 'lucide-react';
import { pingAnalyserWarmthAction, setAnalyserWarmthAction } from '@/app/actions/admin-analyser';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { toast } from '@/app/components/ui/toast';
import type { AnalyserWarmthState } from '@/lib/analyser-warmth.server';
import { cn } from '@/lib/utils';

const minuteFormatter = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });
const BROWSER_WARMUP_INTERVAL_MS = 45 * 1000;

function getRemainingMinutes(warmUntil: string | null, now: number): number {
  if (!warmUntil) return 0;
  return Math.max(Math.ceil((Date.parse(warmUntil) - now) / 60000), 0);
}

function statusCopy(state: AnalyserWarmthState, now: number): string {
  const remainingMinutes = getRemainingMinutes(state.warmUntil, now);
  if (!state.active || remainingMinutes === 0) return 'Idle: next analysis may cold start.';
  if (remainingMinutes <= 1) return 'Live for less than a minute.';
  return `Live for ${minuteFormatter.format(remainingMinutes, 'minute').replace('in ', '')}.`;
}

type Props = {
  initialState: AnalyserWarmthState;
  canManage: boolean;
};

export function AnalyserWarmthControl({ initialState, canManage }: Props) {
  const [state, setState] = useState(initialState);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const pulseInFlightRef = useRef(false);
  const buttonDescriptionId = useId();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const active = state.active && getRemainingMinutes(state.warmUntil, now) > 0;

  const keepWarm = () => {
    if (!canManage) {
      toast.error('You do not have permission to manage the analyser.');
      return;
    }

    startTransition(async () => {
      const result = await setAnalyserWarmthAction({ enabled: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setState(result.state);
      toast.success('Analyser live for 30 minutes');
    });
  };

  useEffect(() => {
    if (!active || !canManage) return;
    let cancelled = false;

    const pulseWarmth = async () => {
      if (pulseInFlightRef.current) return;
      pulseInFlightRef.current = true;

      try {
        const result = await pingAnalyserWarmthAction();
        if (cancelled) return;
        const warmedAt = result.warmedAt ?? new Date().toISOString();
        setState((current) => ({
          ...current,
          lastWarmupAt: warmedAt,
          lastWarmupOk: result.ok,
          lastWarmupError: result.ok ? null : result.error,
        }));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState((current) => ({
          ...current,
          lastWarmupAt: new Date().toISOString(),
          lastWarmupOk: false,
          lastWarmupError: message,
        }));
      } finally {
        pulseInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void pulseWarmth();
    }, BROWSER_WARMUP_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active, canManage]);

  return (
    <Card
      radius="md"
      className={cn(
        'px-4 py-3',
        active &&
          'border-[color-mix(in_srgb,var(--color-status-success)_36%,var(--color-border-default))]',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              active
                ? 'border-[color-mix(in_srgb,var(--color-status-success)_34%,var(--color-border-default))] bg-[color-mix(in_srgb,var(--color-status-success)_14%,transparent)] text-[color:var(--color-status-success)]'
                : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-subtle)]',
            )}
          >
            <Gauge aria-hidden className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-on-surface text-sm font-semibold">Analyser warm-up</h2>
              <InfoTooltip text="Keeps the analyser container ready for demos or rapid testing. It turns off automatically after 30 minutes." />
            </div>
            <p className="text-on-surface-variant mt-0.5 text-xs">{statusCopy(state, now)}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span id={buttonDescriptionId} className="sr-only">
            Keep the analyser warm for 30 minutes. Click again to refresh the timer.
          </span>
          <Button
            type="button"
            variant={active ? 'secondary' : 'accent'}
            size="sm"
            className="cursor-pointer"
            disabled={!canManage || isPending}
            loading={isPending}
            aria-describedby={buttonDescriptionId}
            onClick={keepWarm}
          >
            Keep warm 30 min
          </Button>
        </div>
      </div>
    </Card>
  );
}
