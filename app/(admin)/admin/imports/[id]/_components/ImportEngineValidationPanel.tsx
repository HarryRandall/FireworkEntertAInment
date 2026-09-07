import { AlertTriangle, CheckCircle2, Gauge } from 'lucide-react';
import { Badge } from '@/components/design-system/Badge';
import { Card } from '@/components/design-system/Card';
import type {
  ImportEngineMetricField,
  ImportEngineMetricSummary,
  ImportEngineReviewArtifact,
} from '@/lib/import-review';

const componentPresentation: Record<
  ImportEngineMetricField,
  { label: string; details: Array<{ key: string; label: string; unit: 'score' | 'seconds' }> }
> = {
  timing: {
    label: 'Timing',
    details: [
      { key: 'onsetDeltaSeconds', label: 'Onset delta', unit: 'seconds' },
      { key: 'peakDeltaSeconds', label: 'Peak delta', unit: 'seconds' },
      { key: 'fadeEndDeltaSeconds', label: 'Fade delta', unit: 'seconds' },
    ],
  },
  trajectory: {
    label: 'Trajectory',
    details: [
      { key: 'centroidRmseNormalised', label: 'Centroid error', unit: 'score' },
      { key: 'spreadMae', label: 'Spread error', unit: 'score' },
    ],
  },
  palette: {
    label: 'Colour',
    details: [{ key: 'perceptualDistance', label: 'Palette distance', unit: 'score' }],
  },
  fade: {
    label: 'Fade',
    details: [
      { key: 'normalisedCurveMae', label: 'Curve error', unit: 'score' },
      { key: 'fadeEndDeltaSeconds', label: 'End delta', unit: 'seconds' },
    ],
  },
  perceptual: {
    label: 'Frame match',
    details: [
      { key: 'meanForegroundSsim', label: 'Foreground SSIM', unit: 'score' },
      { key: 'meanLumaMae', label: 'Luma error', unit: 'score' },
      { key: 'meanChromaMae', label: 'Chroma error', unit: 'score' },
    ],
  },
};

const componentOrder = Object.keys(componentPresentation) as ImportEngineMetricField[];

export function ImportEngineValidationPanel({
  metrics,
  artifact,
}: {
  metrics: ImportEngineMetricSummary | null;
  artifact: ImportEngineReviewArtifact | null;
}) {
  if (!metrics) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Gauge className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-foreground text-lg font-semibold">Sampled engine evidence</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              This candidate does not have valid retained FireworksEngine evidence. Re-run
              reconstruction before publication.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const overallPercent = Math.round(metrics.overallScore * 100);
  const overallTone =
    overallPercent >= 90 ? 'success' : overallPercent >= 78 ? 'warning' : 'danger';

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Sampled engine evidence</h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Recorded, sampled source-to-render evidence from ShowCrafter's engine and default replay
            camera. These values belong to the immutable candidate and do not claim continuous or
            exact physical recovery.
          </p>
        </div>
        <Badge solid tone={overallTone}>
          {overallPercent}% overall
        </Badge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {componentOrder.map((field) => {
          const component = metrics.components[field];
          const presentation = componentPresentation[field];
          const percent = Math.round(component.score * 100);
          return (
            <div key={field} className="border-border bg-muted/25 rounded-lg border p-3.5">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-foreground text-sm font-medium">{presentation.label}</dt>
                <dd className="text-foreground font-mono text-sm font-medium tabular-nums">
                  {percent}%
                </dd>
              </div>
              <div
                className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label={`${presentation.label} engine match`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
              </div>
              <div className="text-muted-foreground mt-3 space-y-1 text-xs">
                {presentation.details.map((detail) => {
                  const value = component.values[detail.key];
                  if (value == null) return null;
                  return (
                    <div key={detail.key} className="flex justify-between gap-2">
                      <span>{detail.label}</span>
                      <span className="text-foreground font-mono tabular-nums">
                        {detail.unit === 'seconds' ? `${value.toFixed(3)}s` : value.toFixed(3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </dl>

      <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
        <span>{metrics.engine.frameCount} sampled frames</span>
        <span>
          {metrics.engine.frameWidth} x {metrics.engine.frameHeight}
        </span>
        <span>Fixed step {(metrics.engine.fixedStepSeconds * 1_000).toFixed(2)}ms</span>
        <span title={metrics.engine.rendererVersion}>
          Renderer {metrics.engine.rendererVersion.split('sha256.').at(-1)?.slice(0, 12)}
        </span>
      </div>

      {artifact ? (
        <dl className="border-border bg-muted/20 mt-4 grid gap-3 rounded-lg border p-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Retained MP4</dt>
            <dd className="text-foreground mt-1 font-mono tabular-nums">
              {formatBytes(artifact.byteSize)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">SHA-256</dt>
            <dd className="text-foreground mt-1 font-mono" title={artifact.sha256}>
              {artifact.sha256.slice(0, 16)}…
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Storage ETag</dt>
            <dd className="text-foreground mt-1 font-mono" title={artifact.storageETag}>
              {artifact.storageETag.slice(0, 16)}…
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="border-border mt-5 border-t pt-4">
        <h3 className="text-foreground text-sm font-medium">Refinement priorities</h3>
        {metrics.priorityIssues.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {metrics.priorityIssues.map((issue, index) => (
              <li
                key={`${issue.field}-${index}`}
                className="border-border bg-muted/20 flex items-start gap-3 rounded-lg border p-3"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-[color:var(--color-status-warning)]"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-foreground text-sm font-medium">
                      {index + 1}. {componentPresentation[issue.field].label}
                    </p>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {Math.round(issue.score * 100)}% match
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {issue.instruction}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-3 flex items-start gap-2 text-sm">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-[color:var(--color-status-success)]"
              aria-hidden="true"
            />
            <p className="text-muted-foreground">
              No component fell below the recorded refinement threshold.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}
