import { Card } from '@/app/components/ui/Card';
import type { ImportOutputLike, ImportReviewAttempt } from '@/lib/import-review';

export function ImportAdvancedData({
  selectedAttempt,
  outputs,
}: {
  selectedAttempt: ImportReviewAttempt | null;
  outputs: ImportOutputLike[];
}) {
  return (
    <Card className="p-5">
      <details>
        <summary className="text-foreground focus-visible:ring-ring cursor-pointer rounded-md text-sm font-medium focus:outline-none focus-visible:ring-2">
          Advanced reconstruction data
        </summary>
        <p className="text-muted-foreground mt-2 text-sm">
          Read-only payloads for diagnosis. Use a refinement run to change a reconstruction while
          preserving history.
        </p>
        <div className="mt-4 space-y-4">
          <JsonPanel
            title="Selected renderer reconstruction"
            value={selectedAttempt?.raw ?? null}
          />
          <JsonPanel
            title="Selected validation evidence"
            value={selectedAttempt?.validation ?? null}
          />
          {outputs.length > 0 ? (
            <details className="border-border rounded-lg border">
              <summary className="text-foreground focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus-visible:ring-2">
                Legacy output payloads ({outputs.length})
              </summary>
              <div className="border-border space-y-3 border-t p-3">
                {outputs.map((output) => (
                  <JsonPanel
                    key={output.id}
                    title={`${title(output.outputType)} · ${formatDateTime(output.createdAt)}`}
                    value={output.payload}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </details>
    </Card>
  );
}

function JsonPanel({ title: heading, value }: { title: string; value: unknown }) {
  return (
    <details className="border-border rounded-lg border">
      <summary className="text-muted-foreground focus-visible:ring-ring cursor-pointer rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2">
        {heading}
      </summary>
      <pre className="border-border bg-muted/30 text-foreground max-h-[520px] overflow-auto border-t p-3 font-mono text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2) ?? 'No data'}
      </pre>
    </details>
  );
}

function title(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
