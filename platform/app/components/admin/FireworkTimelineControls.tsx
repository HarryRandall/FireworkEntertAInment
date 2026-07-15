'use client';

import { SliderField } from '@/app/components/ui/SliderField';
import type { FireworkDesign } from '@/lib/fireworks/design';
import {
  applyFireworkTimelineEdit,
  deriveFireworkEditorTimeline,
  isGroundFireworkEffect,
  MAX_TIMELINE_PHASE_SECONDS,
  MAX_TIMELINE_TOTAL_SECONDS,
  MIN_TIMELINE_TOTAL_SECONDS,
  usesLegacyLaunchLiftAppearance,
  type FireworkTimelineDefaults,
  type FireworkTimelineEditKey,
  type FireworkTimelinePhaseKey,
} from '@/lib/fireworks/timing';
import type { FireworkStyleDefaultKind } from '@/lib/fireworks/style-defaults';
import { cn } from '@/lib/utils';

type TimelineMutation = (
  kinds: readonly FireworkStyleDefaultKind[],
  updater: (defaults: FireworkTimelineDefaults) => void,
) => void;

type PhaseDefinition = {
  key: FireworkTimelinePhaseKey;
  label: string;
  hint: string;
  className: string;
};

const PHASES: PhaseDefinition[] = [
  {
    key: 'ascent',
    label: 'Ascent',
    hint: 'Time from launch to the burst. This adjusts lift velocity while keeping the shell alive long enough to detonate.',
    className: 'bg-primary/35',
  },
  {
    key: 'burn',
    label: 'Burn',
    hint: 'Full-brightness star life before the closing fade begins.',
    className: 'bg-primary',
  },
  {
    key: 'fade',
    label: 'Fade',
    hint: 'Time spent dimming, changing closing colour, and shrinking before the main stars finish.',
    className: 'bg-primary/60',
  },
  {
    key: 'tail',
    label: 'Tail',
    hint: 'Residual trail, split fragments, smoke, or launch particles after the main stars finish.',
    className: 'bg-primary/20',
  },
];

function formatSeconds(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`;
}

function uniqueKinds(kinds: FireworkStyleDefaultKind[]): FireworkStyleDefaultKind[] {
  return [...new Set(kinds)];
}

function affectedStyleKinds(
  design: FireworkDesign,
  key: FireworkTimelineEditKey,
): FireworkStyleDefaultKind[] {
  if (key === 'ascent') return ['launch'];
  if (key === 'burn' || key === 'fade') return ['star'];

  const tailKinds: FireworkStyleDefaultKind[] = [];
  const groundEffect = isGroundFireworkEffect(design);
  const legacyLaunchLift = usesLegacyLaunchLiftAppearance(design);
  const hasBurstTail = (['outer', 'core'] as const).some((layerKey) => {
    const layer = design.stars[layerKey];
    return layer.enabled && layer.burstTrail.enabled && layer.burstTrail.particlesPerStar > 0;
  });
  if (hasBurstTail) tailKinds.push('trail');
  if (design.split.enabled) tailKinds.push('split');
  if (!groundEffect && !hasBurstTail && !design.split.enabled) {
    if (design.launch.liftParticles.enabled && design.launch.liftParticles.amount > 0) {
      tailKinds.push(legacyLaunchLift ? 'trail' : 'launch');
    }
    if (!legacyLaunchLift && design.launch.smoke.enabled && design.launch.smoke.particles > 0) {
      tailKinds.push('smoke');
    }
  }

  if (key === 'tail') return uniqueKinds(tailKinds);
  return uniqueKinds([
    'star',
    ...(design.geometry === 'upward_fan' ||
    design.geometry === 'roman_candle' ||
    design.geometry === 'fountain'
      ? []
      : (['launch'] as const)),
    ...(!groundEffect && design.launch.liftParticles.enabled ? (['launch'] as const) : []),
    ...(!groundEffect && !legacyLaunchLift && design.launch.smoke.enabled
      ? (['smoke'] as const)
      : []),
    ...tailKinds,
  ]);
}

export function FireworkTimelineControls({
  design,
  disabled = false,
  durationLabel = 'Total duration',
  durationHint = 'Scale every editable phase proportionally, then use the section sliders for precise timing.',
  onMutate,
}: {
  design: FireworkDesign;
  disabled?: boolean;
  durationLabel?: string;
  durationHint?: string;
  onMutate: TimelineMutation;
}) {
  const timeline = deriveFireworkEditorTimeline(design);
  const total = Math.max(0.01, timeline.totalDurationSeconds);

  function update(key: FireworkTimelineEditKey, seconds: number) {
    const kinds = affectedStyleKinds(design, key);
    onMutate(kinds, (defaults) => applyFireworkTimelineEdit(defaults, design, key, seconds));
  }

  return (
    <div className="space-y-6">
      <div className="border-border bg-card space-y-3 rounded-xl border p-3">
        <div
          role="img"
          aria-label={`Firework timeline: ${PHASES.map(
            (phase) => `${phase.label} ${formatSeconds(timeline.phases[phase.key])}`,
          ).join(', ')}. Total ${formatSeconds(timeline.totalDurationSeconds)}.`}
          className="space-y-2"
        >
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            {PHASES.map((phase) => {
              const duration = timeline.phases[phase.key];
              if (duration <= 0) return null;
              return (
                <div
                  key={phase.key}
                  className={cn('h-full min-w-px', phase.className)}
                  style={{ width: `${(duration / total) * 100}%` }}
                />
              );
            })}
          </div>
          <div className="text-muted-foreground flex justify-between font-mono text-[10px] tabular-nums">
            <span>0.00s</span>
            <span>{formatSeconds(timeline.totalDurationSeconds)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {PHASES.map((phase) => (
            <div key={phase.key} className="flex min-w-0 items-center gap-2 text-xs">
              <span className={cn('size-2 shrink-0 rounded-sm', phase.className)} aria-hidden />
              <span className="text-muted-foreground truncate">{phase.label}</span>
              <span className="text-foreground ml-auto font-mono tabular-nums">
                {formatSeconds(timeline.phases[phase.key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <SliderField
        label={durationLabel}
        min={MIN_TIMELINE_TOTAL_SECONDS}
        max={Math.max(MAX_TIMELINE_TOTAL_SECONDS, Math.ceil(timeline.totalDurationSeconds))}
        step={0.05}
        value={timeline.totalDurationSeconds}
        formatValue={formatSeconds}
        showNumberInput
        inputAriaLabel={`${durationLabel} value`}
        disabled={disabled}
        fullWidth
        hint={durationHint}
        onChange={(value) => update('total', value)}
      />

      <div className="border-border space-y-5 border-t pt-5">
        {PHASES.map((phase) => {
          const phaseDisabled =
            disabled ||
            (phase.key === 'ascent' && !timeline.ascentEditable) ||
            (phase.key === 'tail' && !timeline.tailEditable);
          const hint =
            phase.key === 'ascent' && !timeline.ascentEditable
              ? 'Ground emitters start at the tube and do not have a shell-lift phase.'
              : phase.key === 'tail' && !timeline.tailEditable
                ? 'Enable a trail, split, smoke, or launch-particle system before extending the tail.'
                : phase.hint;

          return (
            <SliderField
              key={phase.key}
              label={`${phase.label} duration`}
              min={phase.key === 'tail' ? 0 : 0.1}
              max={Math.max(
                phase.key === 'ascent' ? 8 : MAX_TIMELINE_PHASE_SECONDS,
                Math.ceil(timeline.phases[phase.key]),
              )}
              step={0.05}
              value={timeline.phases[phase.key]}
              formatValue={formatSeconds}
              showNumberInput
              inputAriaLabel={`${phase.label} duration value`}
              disabled={phaseDisabled}
              fullWidth
              hint={hint}
              onChange={(value) => update(phase.key, value)}
            />
          );
        })}
      </div>

      {timeline.crackleTailFloorSeconds > 0 ? (
        <p className="text-muted-foreground text-xs leading-5">
          Crackle adds up to {formatSeconds(timeline.crackleTailFloorSeconds)} of fixed fragment
          life. The Tail control cannot shorten the firework below that active contribution.
        </p>
      ) : null}
    </div>
  );
}
