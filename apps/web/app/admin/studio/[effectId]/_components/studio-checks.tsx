/** Checks present blocking live-particle measurements and advisory authored-value warnings. */
'use client';
import { Popover } from 'radix-ui';
import { Button } from '@/ui/primitives/button';
import { shotDuration, type Design } from '@showcrafter/fireworks';
import { authoredChecks, PARTICLE_BUDGET } from '@/lib/studio/checks';
import type { useStudioChecks } from './use-studio-checks';

const BUDGET_PERCENT_SCALE = 100; // Percent scale for sampled particle budget usage.

/** Shows a measured budget without publishing or mutating the current draft. */
export function StudioChecks({
  document,
  title,
  result,
}: {
  document: Design;
  title: string;
  result: ReturnType<typeof useStudioChecks>;
}) {
  const checks = authoredChecks(document, title);
  return (
    <section aria-label="Checks" className="sc-studio-checks bg-card border-border border-t p-4">
      <h2 className="font-semibold">Checks</h2>
      <p className="text-muted-foreground text-sm">
        Run before every publish. Unusual values are warnings.
      </p>
      <ParticleCheck result={result} />
      <p className="text-muted-foreground text-xs">
        30 samples per second, including sparks, heads, halos, flashes and smoke. Measurement stops
        when over budget. Preview visibility does not affect checks.
      </p>
      <ul className="mt-3 grid gap-2 text-sm">
        {checks.map((check) => (
          <li key={check.id}>
            {check.passed ? 'Pass' : 'Warning'}: {check.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ParticleCheck({ result }: { result: ReturnType<typeof useStudioChecks> }) {
  if (result === null)
    return (
      <p role="status" data-particle-check="pending">
        Measuring live particles...
      </p>
    );
  if (result.kind === 'error')
    return (
      <p role="alert" data-particle-check="failed">
        {result.message} Publishing requires a successful measurement.
      </p>
    );
  const peak = result.peak;
  return (
    <div role="status" className="my-3" data-particle-check={peak.exceeded ? 'blocked' : 'passed'}>
      <p>
        {peak.exceeded
          ? 'Publishing blocked: over the particle budget'
          : 'Within the particle budget'}
      </p>
      <p className="text-sm">
        {peak.exceeded ? 'At least ' : 'Sampled peak: '}
        {peak.count.toLocaleString('en-GB')} of {PARTICLE_BUDGET.toLocaleString('en-GB')} at{' '}
        {peak.timeS.toFixed(1)} s
      </p>
      <meter
        aria-label="Particle budget"
        min={0}
        max={PARTICLE_BUDGET}
        value={Math.min(peak.count, PARTICLE_BUDGET)}
        className="w-full"
      />
    </div>
  );
}

/** Opens measured and advisory details in a keyboard-accessible anchored popover. */
export function StudioChecksPopover(props: Parameters<typeof StudioChecks>[0]) {
  const warnings = authoredChecks(props.document, props.title).filter(
    (check) => !check.passed,
  ).length;
  const result = props.result;
  const blocked = result?.kind === 'error' || (result?.kind === 'ready' && result.peak.exceeded);
  let label = 'Checks pass';
  if (result === null) label = 'Checking...';
  else if (blocked || warnings > 0) label = `${String(warnings + Number(blocked))} checks`;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" aria-label="Checks" className="sc-studio-checks-pill">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${blocked ? 'bg-destructive' : 'bg-highlight'}`}
          />
          {label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Checks detail"
          align="end"
          sideOffset={8}
          className="sc-studio-checks-popover border-border bg-popover text-popover-foreground shadow-card z-50 rounded-lg border"
        >
          <StudioChecks {...props} />
          <Popover.Close asChild>
            <Button variant="ghost" className="m-2">
              Close checks
            </Button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
/** Pins the sampled particle usage and authored summary below the scrollable layer/library panel. */
export function StudioBudget({
  document,
  result,
}: {
  document: Design;
  result: ReturnType<typeof useStudioChecks>;
}) {
  const peak = result?.kind === 'ready' ? result.peak : null;
  let budgetLabel = 'Measuring...';
  if (result?.kind === 'error') budgetLabel = 'Failed';
  if (peak)
    budgetLabel = `${String(Math.round((peak.count / PARTICLE_BUDGET) * BUDGET_PERCENT_SCALE))}%`;
  const layerCount = document.breaks.reduce((count, burst) => count + burst.layers.length, 0);
  return (
    <footer className="sc-studio-budget text-muted-foreground text-xs">
      <div className="flex justify-between">
        <span>Particle budget</span>
        <span>{budgetLabel}</span>
      </div>
      <meter
        aria-label="Particle budget summary"
        min={0}
        max={PARTICLE_BUDGET}
        value={Math.min(peak?.count ?? 0, PARTICLE_BUDGET)}
        className="w-full"
      />
      <div className="flex justify-between">
        <span>{layerCount} layers</span>
        <span>{shotDuration(document).toFixed(1)} s long</span>
      </div>
    </footer>
  );
}
