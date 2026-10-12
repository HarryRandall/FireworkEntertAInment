/** Checks show the measured particle budget, which blocks saving, and advisory value warnings. */
'use client';
import type { Design } from '@showcrafter/renderer';
import { shotDuration } from '@showcrafter/renderer';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { PARTICLE_BUDGET, authoredChecks } from '@/lib/renderer-editor/checks';
import { cn } from '@/lib/utils';
import type { ParticleCheckResult } from './use-particle-check';

const PERCENT = 100; // Percent scale for budget usage.

/** True when saving must wait: still measuring, or measured over the budget. */
export function particleCheckBlocks(result: ParticleCheckResult | null): boolean {
  return result === null || (result.kind === 'ready' && result.peak.exceeded);
}

/** Full checks list for the Checks tab. */
export function ChecksPanel({
  document,
  result,
}: {
  document: Design;
  result: ParticleCheckResult | null;
}) {
  const checks = authoredChecks(document);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        The particle budget keeps a firework smooth on a phone and must pass before saving. The
        other checks are warnings.
      </p>
      <ParticleBudget result={result} />
      <ul className="space-y-2 text-xs" aria-label="Warnings">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            {check.passed ? (
              <CheckCircle2 size={14} className="text-status-success mt-px shrink-0" aria-hidden />
            ) : (
              <AlertTriangle size={14} className="text-status-warning mt-px shrink-0" aria-hidden />
            )}
            <span>
              <span className="sr-only">{check.passed ? 'Pass: ' : 'Warning: '}</span>
              {check.message}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Sampled 30 times a second over {shotDuration(document).toFixed(1)} s, counting sparks,
        heads, flashes and smoke.
      </p>
    </div>
  );
}

function ParticleBudget({ result }: { result: ParticleCheckResult | null }) {
  if (result === null)
    return (
      <p role="status" className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
        Measuring live particles...
      </p>
    );
  if (result.kind === 'error')
    return (
      <p role="alert" className="text-status-warning text-xs">
        {result.message} Saving is still allowed, but the budget was not checked.
      </p>
    );
  const { peak } = result;
  const percent = Math.round((peak.count / PARTICLE_BUDGET) * PERCENT);
  return (
    <div
      role="status"
      className="space-y-1.5"
      data-particle-check={peak.exceeded ? 'blocked' : 'passed'}
    >
      <div className="flex items-baseline justify-between text-xs">
        <span className={cn('font-medium', peak.exceeded && 'text-status-danger')}>
          {peak.exceeded ? 'Over the particle budget' : 'Within the particle budget'}
        </span>
        <span className="text-muted-foreground">{peak.exceeded ? '>100' : percent}%</span>
      </div>
      <meter
        aria-label="Particle budget"
        min={0}
        max={PARTICLE_BUDGET}
        high={PARTICLE_BUDGET * 0.8}
        value={Math.min(peak.count, PARTICLE_BUDGET)}
        className="h-2 w-full"
      />
      <p className="text-muted-foreground text-xs">
        {peak.exceeded ? 'At least ' : 'Peak '}
        {peak.count.toLocaleString('en-GB')} of {PARTICLE_BUDGET.toLocaleString('en-GB')} at{' '}
        {peak.timeS.toFixed(1)} s
        {peak.exceeded && '. Reduce stars, trail density or smoke to save.'}
      </p>
    </div>
  );
}

/** Compact footer status that opens the Checks tab. */
export function ChecksBadge({
  document,
  result,
  onOpen,
}: {
  document: Design;
  result: ParticleCheckResult | null;
  onOpen: () => void;
}) {
  const warnings = authoredChecks(document).filter((check) => !check.passed).length;
  const over = result?.kind === 'ready' && result.peak.exceeded;
  let label = 'Checks pass';
  if (result === null) label = 'Checking...';
  else if (over) label = 'Over particle budget';
  else if (warnings > 0) label = `${String(warnings)} ${warnings === 1 ? 'warning' : 'warnings'}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-xs outline-none focus-visible:ring-2"
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          over
            ? 'bg-status-danger'
            : result === null
              ? 'bg-muted-foreground'
              : warnings > 0 || result.kind === 'error'
                ? 'bg-status-warning'
                : 'bg-status-success',
        )}
      />
      {label}
    </button>
  );
}
