import { Card } from '@/ui/patterns/Card';
import type {
  ImportFitEvidence,
  ImportReconstructionPlan,
} from '@/lib/firework-import/reconstruction';

export function ImportReconstructionSummary({
  reconstruction,
  fit,
}: {
  reconstruction: ImportReconstructionPlan | null;
  fit: ImportFitEvidence | null;
}) {
  if (!reconstruction) {
    return (
      <Card className="p-5">
        <h2 className="text-foreground text-lg font-semibold">Effect and shot summary</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          A renderer-fitted reconstruction has not been selected yet.
        </p>
      </Card>
    );
  }

  const designs = new Map(reconstruction.designs.map((design) => [design.key, design]));
  const fitByShot = new Map(fit?.shots.map((shot) => [shot.index, shot.overall]) ?? []);
  const sourceSeconds = reconstruction.source?.firstShotSeconds ?? null;
  return (
    <Card className="p-5">
      <div>
        <h2 className="text-foreground text-lg font-semibold">Effect and shot summary</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Renderer designs fitted to the source video, and the launch sequence for the selected
          candidate.
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Duration" value={`${reconstruction.durationSeconds.toFixed(2)}s`} />
        <Metric label="Shots" value={String(reconstruction.shots.length)} />
        <Metric label="Effects" value={String(reconstruction.designs.length)} />
        <Metric label="Fit" value={fit ? percent(fit.overall) : 'Not available'} />
      </dl>

      <div className="mt-5 space-y-3">
        <h3 className="text-foreground text-sm font-medium">Effects</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {reconstruction.designs.map((design) => (
            <div key={design.key} className="border-border bg-muted/25 rounded-lg border p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {design.label ?? design.template}
                  </p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                    {design.key.toUpperCase()} · {design.template} · {design.design.kind}
                  </p>
                </div>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {design.durationSeconds.toFixed(2)}s
                </span>
              </div>
              {design.colorPalette.length > 0 ? (
                <div
                  className="mt-3 flex flex-wrap items-center gap-1.5"
                  aria-label="Colour palette"
                >
                  {design.colorPalette.map((colour) => (
                    <span
                      key={colour}
                      className="border-border size-5 rounded-full border shadow-xs"
                      style={{ backgroundColor: colour }}
                      title={colour}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <details className="border-border mt-5 rounded-lg border">
        <summary className="text-foreground focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-3 text-sm font-medium focus:outline-none focus-visible:ring-2">
          Shot timing and fit ({reconstruction.shots.length})
        </summary>
        <div className="border-border overflow-x-auto border-t">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Shot</th>
                <th className="px-3 py-2 font-medium">Effect</th>
                <th className="px-3 py-2 font-medium">Launch</th>
                <th className="px-3 py-2 font-medium">Source time</th>
                <th className="px-3 py-2 font-medium">Pan</th>
                <th className="px-3 py-2 font-medium">Fit</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {reconstruction.shots.map((shot, index) => (
                <tr key={`${shot.designKey}-${shot.timeOffsetSeconds}-${index}`}>
                  <td className="text-foreground px-3 py-2 font-mono tabular-nums">{index + 1}</td>
                  <td className="text-foreground px-3 py-2">
                    {designs.get(shot.designKey)?.label ?? shot.designKey}
                  </td>
                  <td className="text-foreground px-3 py-2 font-mono tabular-nums">
                    {shot.timeOffsetSeconds.toFixed(2)}s
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono tabular-nums">
                    {sourceSeconds == null
                      ? 'Not recorded'
                      : `${(sourceSeconds + shot.timeOffsetSeconds).toFixed(2)}s`}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono tabular-nums">
                    {shot.panDegrees}°
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono tabular-nums">
                    {fitByShot.get(index) == null ? 'Not scored' : percent(fitByShot.get(index)!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/25 rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground mt-1 font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
