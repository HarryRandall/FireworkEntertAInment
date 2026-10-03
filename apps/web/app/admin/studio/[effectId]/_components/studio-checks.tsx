/** Checks present blocking live-particle measurements and advisory authored-value warnings. */
'use client';
import type { Design } from '@showcrafter/fireworks';
import { authoredChecks, PARTICLE_BUDGET } from '@/lib/studio/checks';
import { useStudioChecks } from './use-studio-checks';

/** Shows a measured budget without publishing or mutating the current draft. */
export function StudioChecks({ document, title }: { document: Design; title: string }) {
  const result = useStudioChecks(document);
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
