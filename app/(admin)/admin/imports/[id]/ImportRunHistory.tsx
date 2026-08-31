import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { importStatusTone, type ImportRun } from '@/lib/import-review';

export function ImportRunHistory({ runs }: { runs: ImportRun[] }) {
  return (
    <Card className="p-5">
      <div>
        <h2 className="text-foreground text-lg font-semibold">Run and output history</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Recent runs are shown here. Every retry and refinement remains retained for audit.
        </p>
      </div>
      {runs.length > 0 ? (
        <div className="mt-4 space-y-3">
          {runs.map((run) => (
            <details
              key={run.id}
              className="border-border rounded-lg border"
              open={run === runs[0]}
            >
              <summary className="focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-3 focus:outline-none focus-visible:ring-2">
                <div className="inline-flex w-[calc(100%-1.5rem)] flex-wrap items-center justify-between gap-3 align-middle">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">
                      Run {run.attemptNumber} · {title(run.requestKind)}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                      {run.selectedModel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={dispatchTone(run.directDispatchStatus)}>
                      {dispatchLabel(run.directDispatchStatus)}
                    </Badge>
                    <Badge solid tone={runTone(run.status)}>
                      {title(run.stage || run.status)}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {run.progress}%
                    </span>
                  </div>
                </div>
              </summary>
              <div className="border-border space-y-4 border-t p-4">
                <DispatchHealth run={run} />
                <dl className="grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                  <HistoryMetric label="Pipeline" value={run.pipelineVersion} />
                  <HistoryMetric label="Engine schema" value={run.engineSchemaVersion} />
                  <HistoryMetric
                    label="Dispatch attempts"
                    value={String(run.directDispatchAttemptCount)}
                  />
                  <HistoryMetric
                    label="Dispatch updated"
                    value={formatDateTime(run.directDispatchUpdatedAt)}
                  />
                  {run.directDispatchCallId ? (
                    <HistoryMetric label="Direct dispatch call" value={run.directDispatchCallId} />
                  ) : null}
                  {run.modalCallId ? (
                    <HistoryMetric label="Executor call" value={run.modalCallId} />
                  ) : null}
                  <HistoryMetric label="Candidates" value={String(run.candidates.length)} />
                  <HistoryMetric label="Evidence outputs" value={String(run.outputs.length)} />
                </dl>
                {run.requestPrompt ? (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Refinement request</p>
                    <p className="text-foreground bg-muted/35 mt-1 rounded-md p-3 text-sm leading-relaxed">
                      {run.requestPrompt}
                    </p>
                  </div>
                ) : null}
                {run.errorMessage ? (
                  <p
                    className="text-destructive bg-destructive/5 rounded-md p-3 text-sm"
                    role="alert"
                  >
                    {run.errorMessage}
                  </p>
                ) : null}
                {run.outputs.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {run.outputs.map((output) => (
                      <li
                        key={output.id}
                        className="border-border bg-muted/20 rounded-md border p-3"
                      >
                        <p className="text-foreground text-xs font-medium">
                          {title(output.outputType)}
                        </p>
                        <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                          {output.stage} · {output.schemaVersion}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No evidence outputs were stored.</p>
                )}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          This job predates versioned reconstruction runs. Its legacy outputs remain available in
          advanced data below.
        </p>
      )}
    </Card>
  );
}

function DispatchHealth({ run }: { run: ImportRun }) {
  const danger = run.directDispatchStatus === 'failed';
  return (
    <div
      className={
        danger
          ? 'border-destructive/25 bg-destructive/5 rounded-md border p-3'
          : 'border-border bg-muted/20 rounded-md border p-3'
      }
      data-testid="import-dispatch-health"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground text-xs font-medium">Queued dispatch health</p>
        <Badge tone={dispatchTone(run.directDispatchStatus)}>
          {dispatchLabel(run.directDispatchStatus)}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {dispatchDetail(run.directDispatchStatus)}
      </p>
      {run.directDispatchError ? (
        <p
          className={
            danger ? 'text-destructive mt-2 text-xs' : 'text-muted-foreground mt-2 text-xs'
          }
        >
          {run.directDispatchError}
        </p>
      ) : null}
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground mt-1 font-mono break-words">{value}</dd>
    </div>
  );
}

function title(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function runTone(status: string): 'neutral' | 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'succeeded') return 'success';
  if (status === 'superseded') return 'neutral';
  return importStatusTone(status);
}

function dispatchLabel(status: string): string {
  if (status === 'accepted') return 'Modal accepted';
  if (status === 'dispatching') return 'Dispatching';
  if (status === 'failed') return 'Dispatch failed';
  if (status === 'worker_claimed') return 'Worker claimed';
  return 'Awaiting dispatch';
}

function dispatchDetail(status: string): string {
  if (status === 'accepted') {
    return 'Modal acknowledged this exact run. Executor provenance is recorded separately after the worker claims its lease.';
  }
  if (status === 'dispatching') {
    return 'The platform is waiting for Modal to acknowledge this exact run.';
  }
  if (status === 'failed') {
    return 'No worker claimed the run. The queued lifecycle was closed and its reserved AI credits were refunded.';
  }
  if (status === 'worker_claimed') {
    return 'A direct, scheduled or local worker claimed the lease, so dispatch failure handling cannot cancel this run.';
  }
  return 'The run is durable and waiting for direct dispatch or the development worker poller.';
}

function dispatchTone(status: string): 'neutral' | 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'accepted') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending') return 'warning';
  return 'info';
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
