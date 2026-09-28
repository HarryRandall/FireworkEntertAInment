'use client';

import { useId, useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/primitives/card';

const RecoveryResult = z.object({
  ok: z.boolean(),
  expiredAnalyses: z.number().int().nonnegative(),
  expiredCues: z.number().int().nonnegative(),
  analysis: z.enum(['completed', 'idle', 'pending', 'cancelled', 'failed']),
  cues: z.enum(['completed', 'idle', 'pending', 'failed']),
});
const statusLabels = {
  completed: 'completed',
  idle: 'no eligible work',
  pending: 'queued or awaiting retry',
  cancelled: 'already handled',
  failed: 'failed',
};

export function AnalysisRecoveryControl({ canManage }: { canManage: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const descriptionId = useId();

  function recover() {
    if (!canManage || isPending) return;
    setMessage(null);
    setFailed(false);
    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/analyser/reconcile', { method: 'POST' });
        const body: unknown = await response.json();
        const parsed = RecoveryResult.safeParse(body);
        if (!parsed.success) {
          const error = z.object({ error: z.string() }).safeParse(body);
          throw new Error(
            error.success
              ? error.data.error
              : 'Recovery could not finish. Check job status before trying again.',
          );
        }
        const result = parsed.data;
        setFailed(!response.ok || !result.ok);
        setMessage(
          `Analysis: ${statusLabels[result.analysis]}. Cue generation: ${statusLabels[result.cues]}. Exhausted attempts finalised: ${result.expiredAnalyses} analyses and ${result.expiredCues} cue jobs.`,
        );
      } catch (error) {
        setFailed(true);
        setMessage(
          error instanceof Error ? error.message : 'Recovery could not finish. Try again.',
        );
      }
    });
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Analysis recovery</h2>
          <p id={descriptionId} className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Recover up to one stalled analysis and one cue job per click. Exhausted attempts are
            finalised with applicable refunds. Recovery runs only when requested.
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Running jobs keep their current lease. Jobs waiting to retry need another pass once due.
            Permanently failed jobs are not restarted.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          disabled={!canManage}
          loading={isPending}
          aria-describedby={descriptionId}
          onClick={recover}
        >
          {!isPending && <RotateCcw aria-hidden size={16} />}
          {isPending ? 'Recovering jobs...' : 'Recover stalled jobs'}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={failed ? 'text-status-danger text-xs' : 'text-muted-foreground text-xs'}
      >
        {isPending ? 'Recovery is running. This can take a few minutes.' : message}
      </p>
    </Card>
  );
}
