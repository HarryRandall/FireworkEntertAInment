'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Gauge, Loader2 } from 'lucide-react';
import { pingAnalyserWarmthAction, setAnalyserWarmthAction } from '@/app/actions/admin-analyser';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { toast } from '@/app/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AnalyserWarmthState } from '@/lib/analyser-warmth.server';
import { cn } from '@/lib/utils';

const minuteFormatter = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });
const BROWSER_WARMUP_INTERVAL_MS = 45 * 1000;

function getRemainingMinutes(warmUntil: string | null, now: number): number {
  if (!warmUntil) return 0;
  return Math.max(Math.ceil((Date.parse(warmUntil) - now) / 60000), 0);
}

function statusCopy(state: AnalyserWarmthState, now: number): string {
  if (state.lastWarmupOk === false) {
    return state.lastWarmupError
      ? `Warm-up failed: ${state.lastWarmupError}`
      : 'Warm-up failed. Check the analyser configuration and try again.';
  }
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

  const active =
    state.active && state.lastWarmupOk === true && getRemainingMinutes(state.warmUntil, now) > 0;
  const failed = state.lastWarmupOk === false;

  const keepWarm = () => {
    if (!canManage) {
      toast.error('You do not have permission to manage the analyser.');
      return;
    }

    startTransition(async () => {
      const result = await setAnalyserWarmthAction({ enabled: true });
      if (!result.ok) {
        if (result.state) setState(result.state);
        toast.error('Analyser did not warm up', { description: result.error });
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
      className={cn('gap-0 p-4', active && 'ring-green-500/30', failed && 'ring-destructive/30')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md border',
              active
                ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-300'
                : failed
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-border bg-muted text-muted-foreground',
            )}
          >
            <Gauge aria-hidden className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">Analyser warm-up</h2>
              <Badge
                className={cn(
                  active
                    ? 'bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                    : failed
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-secondary text-secondary-foreground',
                )}
              >
                {active ? 'Live' : failed ? 'Failed' : 'Idle'}
              </Badge>
              <InfoTooltip text="Keeps the analyser container ready for demos or rapid testing. It turns off automatically after 30 minutes." />
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {statusCopy(state, now)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0">
          <span id={buttonDescriptionId} className="sr-only">
            Keep the analyser warm for 30 minutes. Click again to refresh the timer.
          </span>
          <Button
            type="button"
            variant={active ? 'secondary' : 'default'}
            size="sm"
            className="w-full cursor-pointer sm:w-auto"
            disabled={!canManage || isPending}
            aria-busy={isPending}
            aria-describedby={buttonDescriptionId}
            onClick={keepWarm}
          >
            {isPending ? (
              <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Gauge aria-hidden />
            )}
            Keep warm 30 min
          </Button>
        </div>
      </div>
    </Card>
  );
}
