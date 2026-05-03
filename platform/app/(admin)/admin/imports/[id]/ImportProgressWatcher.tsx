"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type StatusPayload = {
  status: string;
  processingProgress: number;
  errorMessage: string | null;
  outputCount: number;
  updatedAt: string | null;
};

type ImportProgressWatcherProps = {
  jobId: string;
  initialStatus: string;
  initialProgress: number;
  initialOutputCount: number;
  initialUpdatedAt: string | null;
  /** Polling interval in ms — short while active, longer once terminal. */
  activeIntervalMs?: number;
};

const TERMINAL_STATUSES = new Set(["complete", "failed", "needs_review"]);

export function ImportProgressWatcher({
  jobId,
  initialStatus,
  initialProgress,
  initialOutputCount,
  initialUpdatedAt,
  activeIntervalMs = 2500,
}: ImportProgressWatcherProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSignatureRef = useRef(
    `${initialStatus}|${initialProgress}|${initialOutputCount}|${initialUpdatedAt ?? ""}`,
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/admin/imports/${jobId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload: StatusPayload = await res.json();
        if (cancelled) return;
        setStatus(payload.status);
        setProgress(payload.processingProgress);
        setErrorMessage(payload.errorMessage);

        const signature = `${payload.status}|${payload.processingProgress}|${payload.outputCount}|${payload.updatedAt ?? ""}`;
        if (signature !== lastSignatureRef.current) {
          lastSignatureRef.current = signature;
          // Server components on the page (preview, outputs list, etc.) need
          // to re-render with the new outputs/spec, so refresh the route.
          router.refresh();
        }
      } catch {
        // Network blips are non-fatal; keep polling.
      } finally {
        if (cancelled) return;
        const isTerminal = TERMINAL_STATUSES.has(status);
        const next = isTerminal ? activeIntervalMs * 6 : activeIntervalMs;
        timeoutId = setTimeout(poll, next);
      }
    }

    timeoutId = setTimeout(poll, activeIntervalMs);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobId, router, activeIntervalMs, status]);

  const isActive = !TERMINAL_STATUSES.has(status);

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-outline-variant/35 bg-surface-container-low p-4"
      data-testid="import-progress-watcher"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Live status
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          {isActive ? (
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
          <span data-testid="import-progress-status">
            {status.replace("_", " ")}
          </span>
          <span aria-hidden="true">·</span>
          <span data-testid="import-progress-percent">{progress}%</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant/30">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {errorMessage ? (
        <p className="text-xs font-semibold text-error">{errorMessage}</p>
      ) : null}
    </div>
  );
}
