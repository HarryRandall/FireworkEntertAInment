'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Clock3, Gauge, Zap } from 'lucide-react';
import { setAnalyserWarmthAction } from '@/app/actions/admin-analyser';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Toggle } from '@/app/components/ui/Toggle';
import { toast } from '@/app/components/ui/toast';
import type { AnalyserWarmthState } from '@/lib/analyser-warmth.server';

const minuteFormatter = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });

function getRemainingMinutes(warmUntil: string | null, now: number): number {
  if (!warmUntil) return 0;
  return Math.max(Math.ceil((Date.parse(warmUntil) - now) / 60000), 0);
}

function formatTime(value: string | null): string {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusCopy(state: AnalyserWarmthState, now: number): string {
  if (!state.active) return 'Cold start mode';
  const remainingMinutes = getRemainingMinutes(state.warmUntil, now);
  if (remainingMinutes <= 1) return 'Warm for less than a minute';
  return `Warm for ${minuteFormatter.format(remainingMinutes, 'minute').replace('in ', '')}`;
}

type Props = {
  initialState: AnalyserWarmthState;
  canManage: boolean;
};

export function AnalyserWarmthControl({ initialState, canManage }: Props) {
  const [state, setState] = useState(initialState);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const active = state.active && getRemainingMinutes(state.warmUntil, now) > 0;
  const badgeTone = active ? 'success' : 'neutral';
  const lastWarmupCopy = useMemo(() => {
    if (state.lastWarmupOk === true) return `Last ping ${formatTime(state.lastWarmupAt)}`;
    if (state.lastWarmupOk === false) return state.lastWarmupError || 'Last warm-up failed';
    return 'Waiting for the first ping';
  }, [state.lastWarmupAt, state.lastWarmupError, state.lastWarmupOk]);

  const updateWarmth = (enabled: boolean) => {
    if (!canManage) {
      toast.error('You do not have permission to manage the analyser.');
      return;
    }

    startTransition(async () => {
      const result = await setAnalyserWarmthAction({ enabled });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setState(result.state);
      toast.success(enabled ? 'Warm analyser enabled for 30 minutes' : 'Warm analyser disabled');
    });
  };

  return (
    <Card radius="md" className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={badgeTone} solid>
              {active ? 'Warm boost active' : 'Cold starts'}
            </Badge>
            <Badge tone={state.cacheMode === 'shared' ? 'info' : 'warning'} solid>
              {state.cacheMode === 'shared' ? 'Shared timer' : 'Local timer'}
            </Badge>
          </div>

          <div className="space-y-1">
            <h2 className="text-on-surface flex items-center gap-2 text-lg font-bold">
              <Gauge aria-hidden className="h-5 w-5 text-[color:var(--color-accent)]" />
              Analyser container
            </h2>
            <p className="text-on-surface-variant max-w-2xl text-sm">
              {active
                ? `The analyser stays ready until ${formatTime(state.warmUntil)}.`
                : 'The analyser will use the normal cold start path.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border-outline-variant/45 bg-surface-container-low rounded-lg border p-3">
              <div className="text-on-surface-variant flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
                <Clock3 aria-hidden className="h-3.5 w-3.5" />
                Window
              </div>
              <p className="text-on-surface mt-1 text-sm font-semibold">{statusCopy(state, now)}</p>
            </div>
            <div className="border-outline-variant/45 bg-surface-container-low rounded-lg border p-3">
              <div className="text-on-surface-variant flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
                <Zap aria-hidden className="h-3.5 w-3.5" />
                Warm-up
              </div>
              <p className="text-on-surface mt-1 text-sm font-semibold break-words">
                {lastWarmupCopy}
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-80">
          <Toggle
            checked={active}
            disabled={!canManage || isPending}
            onChange={updateWarmth}
            label="Keep warm for 30 minutes"
            description="Use for demos or rapid testing, then let the analyser return to cold starts."
          />
          {active ? (
            <Button
              type="button"
              variant="secondary"
              loading={isPending}
              disabled={!canManage || isPending}
              onClick={() => updateWarmth(true)}
            >
              Extend 30 minutes
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
