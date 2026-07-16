'use client';

/** Resilient live status for active reconstruction runs. */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { importStageLabel } from '@/lib/import-review';

type StatusPayload = {
  status: string;
  stage: string | null;
  processingProgress: number;
  errorMessage: string | null;
  outputCount: number;
  candidateCount: number;
  updatedAt: string | null;
};

type ImportProgressWatcherProps = {
  jobId: string;
  initialStatus: string;
  initialStage: string | null;
  initialProgress: number;
  initialOutputCount: number;
  initialCandidateCount: number;
  initialUpdatedAt: string | null;
  activeIntervalMs?: number;
};

const TERMINAL_STATUSES = new Set(['complete', 'failed', 'needs_review']);
const MAX_BACKOFF_MS = 30_000;

export function ImportProgressWatcher({
  jobId,
  initialStatus,
  initialStage,
  initialProgress,
  initialOutputCount,
  initialCandidateCount,
  initialUpdatedAt,
  activeIntervalMs = 2500,
}: ImportProgressWatcherProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [stage, setStage] = useState(initialStage);
  const [progress, setProgress] = useState(initialProgress);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
    setStage(initialStage);
    setProgress(initialProgress);
  }, [initialProgress, initialStage, initialStatus, initialUpdatedAt]);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(initialStatus)) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let failureCount = 0;
    let currentStatus = initialStatus;
    let lastOutputCount = initialOutputCount;
    let lastCandidateCount = initialCandidateCount;

    function clearTimer() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    }

    function schedule(delay: number) {
      clearTimer();
      if (
        cancelled ||
        document.visibilityState === 'hidden' ||
        TERMINAL_STATUSES.has(currentStatus)
      )
        return;
      timeoutId = setTimeout(poll, delay);
    }

    async function poll() {
      if (
        cancelled ||
        document.visibilityState === 'hidden' ||
        TERMINAL_STATUSES.has(currentStatus)
      )
        return;
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(`/api/admin/imports/${jobId}/status`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Status request failed with ${response.status}.`);
        const payload: StatusPayload = await response.json();
        if (cancelled) return;

        failureCount = 0;
        setConnectionIssue(false);
        setStatus(payload.status);
        setStage(payload.stage);
        setProgress(payload.processingProgress);
        setErrorMessage(payload.errorMessage);

        const evidenceChanged =
          payload.outputCount !== lastOutputCount || payload.candidateCount !== lastCandidateCount;
        const becameTerminal =
          !TERMINAL_STATUSES.has(currentStatus) && TERMINAL_STATUSES.has(payload.status);
        currentStatus = payload.status;
        lastOutputCount = payload.outputCount;
        lastCandidateCount = payload.candidateCount;
        if (evidenceChanged || becameTerminal) router.refresh();
        if (!TERMINAL_STATUSES.has(payload.status)) schedule(activeIntervalMs);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        failureCount += 1;
        setConnectionIssue(true);
        schedule(Math.min(MAX_BACKOFF_MS, activeIntervalMs * 2 ** failureCount));
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        clearTimer();
        controller?.abort();
      } else if (!TERMINAL_STATUSES.has(currentStatus)) {
        void poll();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedule(activeIntervalMs);
    return () => {
      cancelled = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    activeIntervalMs,
    initialCandidateCount,
    initialOutputCount,
    initialStatus,
    initialUpdatedAt,
    jobId,
    router,
  ]);

  const isActive = !TERMINAL_STATUSES.has(status);
  const clampedProgress = Math.min(100, Math.max(0, progress));
  return (
    <div
      className="border-border bg-muted/35 flex flex-col gap-2 rounded-lg border p-4"
      data-testid="import-progress-watcher"
    >
      <div role="status" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-medium">{importStageLabel(status, stage)}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {isActive
                ? 'Processing updates automatically while this tab is visible.'
                : 'Live polling stopped.'}
            </p>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            {isActive ? (
              <span
                className="bg-primary inline-block size-2 animate-pulse rounded-full motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            <span data-testid="import-progress-status">{status.replace(/_/g, ' ')}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums" data-testid="import-progress-percent">
              {clampedProgress}%
            </span>
          </div>
        </div>
      </div>
      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Reconstruction progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedProgress}
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {connectionIssue ? (
        <p className="text-xs text-[color:var(--color-status-warning)]" role="status">
          Live status is temporarily unavailable. Retrying with a slower interval.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-destructive text-xs font-medium" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
