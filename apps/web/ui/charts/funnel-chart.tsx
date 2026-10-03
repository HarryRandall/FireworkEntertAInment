/** Nivo conversion funnel with text percentages of the first step. */
'use client';
import { ResponsiveFunnel } from '@nivo/funnel';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { funnelPercent } from '@/ui/kit/dashboard-logic';
import { ChartFrame } from './chart-frame';
import { CHART_COLOURS, CHART_THEME } from './chart-theme';
// The prototype separates conversion steps by a three-CSS-pixel gap.
const STEP_GAP_PX = 3;
/** Displays ordered non-negative conversion counts; the first step is the reference population. */
export function FunnelChart({
  title,
  steps,
}: {
  title: string;
  steps: { id: string; value: number }[];
}) {
  const reduced = usePrefersReducedMotion();
  const first = steps[0]?.value ?? 0;
  return (
    <ChartFrame
      title={title}
      description="Conversion from the first step."
      rows={steps.map((step) => ({
        label: step.id,
        value: `${String(step.value)} · ${String(funnelPercent(step.value, first))}%`,
      }))}
      legend={
        <ol className="text-muted-foreground grid gap-1 text-xs">
          {steps.map((step) => (
            <li key={step.id}>
              {step.id}: {step.value} ({funnelPercent(step.value, first)}%)
            </li>
          ))}
        </ol>
      }
    >
      <ResponsiveFunnel
        data={steps}
        colors={CHART_COLOURS}
        theme={CHART_THEME}
        spacing={STEP_GAP_PX}
        labelColor="var(--foreground)"
        enableLabel={false}
        animate={!reduced}
      />
    </ChartFrame>
  );
}
