'use client';
import {
  AdvancedControls,
  CONTROL_GRID_CLASS,
  PanelSection,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { SelectField } from '@/ui/patterns/SelectField';
import { Switch } from '@/ui/primitives/switch';
import type {
  BurstTrailStop,
  TrailParticleShapeOption,
} from '@showcrafter/firework-editor/control-values';
import {
  clampNumber,
  formatDegrees,
  formatMultiplier,
  formatPercent,
  formatProbability,
  formatRotation,
  formatTrailBias,
  round2,
  shapeOptionFromStops,
  TRAIL_BIAS_MAX,
  TRAIL_BIAS_MIN,
  TRAIL_COLOR_OPTIONS,
  TRAIL_FRONT_SPREAD_ANGLE_MAX,
  TRAIL_FRONT_SPREAD_ANGLE_MIN,
  TRAIL_HEAD_GAP_MAX,
  TRAIL_PARTICLE_SCALE_MAX,
  TRAIL_PARTICLE_SHAPE_OPTIONS,
  TRAIL_PARTICLE_SHAPE_WEIGHTS,
  TRAIL_PARTICLE_SIZE_MAX,
  TRAIL_PRESET_OPTIONS,
  TRAIL_ROTATION_MAX,
  TRAIL_SPACING_CURVE_MAX,
  TRAIL_SPACING_CURVE_MIN,
  TRAIL_SPREAD_ANGLE_MAX,
  trailBiasFromFrontClump,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { BurstTrailPreset, StarLayerKey } from '@showcrafter/fireworks/design';
import { BURST_TRAIL_FLICKER_LIFE_MAX, makeBurstTrailPreset } from '@showcrafter/fireworks/design';
import { trailParticleLimit } from '@showcrafter/fireworks/emission';
import { RendererField as SliderField } from '../RendererField';
import { renderBurstTrailClosingControls } from './renderBurstTrailClosingControls';
import { renderBurstTrailOpeningControls } from './renderBurstTrailOpeningControls';
import { renderTrailLifetimeControls } from './renderTrailLifetimeControls';

export function renderBurstTrailControls(
  context: RendererControlsContext,
  layerKey?: StarLayerKey,
) {
  const {
    currentBurstTrail,
    disabled,
    design,
    coreTrailsToggleId,
    outerTrailsToggleId,
    headsToggleId,
    patchBurstTrail,
    setBurstTrailEnabled,
    setBurstTrailPreset,
    setBurstTrailValue,
    setBurstTrailNested,
    setTrailBias,
  } = context;
  const burstTrail = currentBurstTrail(layerKey);
  const trailsEnabled = burstTrail.enabled;
  const controlDisabled =
    disabled || !trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false);
  const title = layerKey === 'core' ? 'Inner star trails' : 'Outer star trails';
  const toggleId =
    layerKey === 'core'
      ? coreTrailsToggleId
      : layerKey === 'outer'
        ? outerTrailsToggleId
        : headsToggleId;
  const fallbackPreset = burstTrail.preset === 'custom' ? 'custom' : burstTrail.preset;
  const editableStops =
    burstTrail.stops.length > 0 ? burstTrail.stops : makeBurstTrailPreset(fallbackPreset).stops;
  const particleShape = shapeOptionFromStops(editableStops);
  const trailBias = trailBiasFromFrontClump(burstTrail.frontClump);
  const limit = trailParticleLimit(design);
  const amountHint = `Maximum ${limit.perStar.toLocaleString()} sparks per star for this design. Reduce the star count to allow denser trails. Short paths and fading can emit fewer sparks.`;

  function patchBurstTrailStops(updater: (stop: BurstTrailStop) => BurstTrailStop) {
    patchBurstTrail(layerKey, (trail) => {
      const source =
        trail.stops.length > 0
          ? trail.stops
          : makeBurstTrailPreset(trail.preset === 'custom' ? 'custom' : trail.preset).stops;
      return {
        ...trail,
        stops: source.map((stop) => {
          const next = updater({ ...stop, shapeWeights: { ...stop.shapeWeights } });
          return { ...next, shapeWeights: { ...next.shapeWeights } };
        }),
      };
    });
  }

  function setParticleShape(value: string) {
    const shape = value as TrailParticleShapeOption;
    const weights = TRAIL_PARTICLE_SHAPE_WEIGHTS[shape] ?? TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
    patchBurstTrailStops((stop) => ({ ...stop, shapeWeights: { ...weights } }));
  }

  function patchBurstTrailStop(index: number, patch: Partial<BurstTrailStop>) {
    patchBurstTrail(layerKey, (trail) => {
      const source =
        trail.stops.length > 0
          ? trail.stops
          : makeBurstTrailPreset(trail.preset === 'custom' ? 'custom' : trail.preset).stops;
      const previousPosition = source[index - 1]?.position ?? 0;
      const nextPosition = source[index + 1]?.position ?? 100;
      const boundedPatch =
        patch.position == null
          ? patch
          : {
              ...patch,
              position: round2(clampNumber(patch.position, previousPosition, nextPosition)),
            };
      return {
        ...trail,
        stops: source.map((stop, stopIndex) =>
          stopIndex === index
            ? { ...stop, ...boundedPatch, shapeWeights: { ...stop.shapeWeights } }
            : { ...stop, shapeWeights: { ...stop.shapeWeights } },
        ),
      };
    });
  }

  return (
    <PanelSection
      title={title}
      inactive={!trailsEnabled || (layerKey ? !design.stars[layerKey].enabled : false)}
      titleAccessory={
        <InfoTooltip text="Master switch for burst trail particles behind the star paths." />
      }
      action={
        <Switch
          id={toggleId}
          aria-label={`Show ${title.toLowerCase()}`}
          checked={trailsEnabled}
          onCheckedChange={(value) => setBurstTrailEnabled(layerKey, value)}
          disabled={disabled || (layerKey ? !design.stars[layerKey].enabled : false)}
        />
      }
    >
      <div className="space-y-4">
        <div className={CONTROL_GRID_CLASS}>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Built-in trail preset</FieldLabel>
              <InfoTooltip text="Copy a built-in starting point, then adjust it. Your saved trail presets are below." />
            </div>
            <SelectField
              value={burstTrail.preset}
              onChange={(value) => setBurstTrailPreset(layerKey, value as BurstTrailPreset)}
              options={TRAIL_PRESET_OPTIONS}
              ariaLabel="Built-in trail preset"
              disabled={controlDisabled}
            />
          </Field>
          <Field>
            <div className="flex items-center gap-1.5">
              <FieldLabel>Trail colour</FieldLabel>
              <InfoTooltip text="Gold and silver are classic metallic chemistries. Star colour follows each star's own colour." />
            </div>
            <SelectField
              value={burstTrail.colourMode}
              onChange={(value) => setBurstTrailValue(layerKey, 'colourMode', value)}
              options={TRAIL_COLOR_OPTIONS}
              ariaLabel="Trail colour"
              disabled={controlDisabled}
            />
          </Field>
        </div>

        <SubSection title="Trail particles" defaultExpanded>
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              inputKind="number"
              label="Particles per star"
              min={0}
              max={limit.perStar}
              step={1}
              value={Math.min(burstTrail.particlesPerStar, limit.perStar)}
              showNumberInput
              inputAriaLabel="Particles per star value"
              disabled={controlDisabled}
              hint={amountHint}
              onChange={(value) =>
                setBurstTrailValue(layerKey, 'particlesPerStar', Math.round(value))
              }
            />
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Particle shape</FieldLabel>
                <InfoTooltip text="Shape of every trail particle: square sparks, glowing discs, triangles, or a mix." />
              </div>
              <SelectField
                value={particleShape}
                onChange={setParticleShape}
                options={[...TRAIL_PARTICLE_SHAPE_OPTIONS]}
                ariaLabel="Particle shape"
                disabled={controlDisabled}
              />
            </Field>
            <SliderField
              label="Particle size"
              min={0.08}
              max={TRAIL_PARTICLE_SIZE_MAX}
              step={0.05}
              value={burstTrail.particleSize.base}
              showNumberInput
              inputAriaLabel="Particle size value"
              disabled={controlDisabled}
              fullWidth
              hint="Global size for every trail particle before head and tail scaling."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'particleSize', 'base', round2(value))
              }
            />
            <AdvancedControls defaultOpen={false}>
              <SliderField
                label="Head scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={burstTrail.particleSize.headScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Head scale value"
                disabled={controlDisabled}
                hint="Size multiplier when each trail particle first appears near the star head."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'headScale', round2(value))
                }
              />
              <SliderField
                label="Tail scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={burstTrail.particleSize.tailScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Tail scale value"
                disabled={controlDisabled}
                hint="Size multiplier as each particle ages into the old tail."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'tailScale', round2(value))
                }
              />
              <SliderField
                label="Size random"
                min={0}
                max={100}
                step={1}
                value={burstTrail.particleSize.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Size random value"
                disabled={controlDisabled}
                hint="Seeded size variation. Replay stays deterministic, but particles do not all match exactly."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'particleSize', 'variationPercent', round2(value))
                }
              />
              <SliderField
                label="Rotation"
                min={0}
                max={TRAIL_ROTATION_MAX}
                step={0.1}
                value={burstTrail.motion.spin}
                formatValue={formatRotation}
                showNumberInput
                inputAriaLabel="Rotation value"
                disabled={controlDisabled}
                hint="0 keeps every particle locked in place. Higher values randomise the starting angle and spin the particles while they fade."
                onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'spin', round2(value))}
              />
            </AdvancedControls>
          </div>
        </SubSection>

        {renderTrailLifetimeControls(context, layerKey, controlDisabled)}
        <SubSection
          title="Changes along the trail"
          hint="Each stop changes the particle mix along the path. Position 0% is beside the star head; 100% is the oldest tail."
        >
          <div className="space-y-4">
            {editableStops.map((stop, index) => (
              <div
                key={`${layerKey ?? 'base'}-trail-stop-${index}`}
                className="rounded-lg border border-[color:var(--color-border-subtle)] p-3"
              >
                <p className="mb-3 text-xs font-semibold text-[color:var(--color-content-emphasis)]">
                  Stop {index + 1}
                </p>
                <div className={CONTROL_GRID_CLASS}>
                  <SliderField
                    label="Position"
                    min={0}
                    max={100}
                    step={1}
                    value={stop.position}
                    formatValue={formatPercent}
                    showNumberInput
                    inputAriaLabel={`Trail stop ${index + 1} position value`}
                    disabled={controlDisabled}
                    hint="Location of this stop from the fresh head to the oldest tail."
                    onChange={(value) => patchBurstTrailStop(index, { position: round2(value) })}
                  />
                  <SliderField
                    label="Density"
                    min={0}
                    max={4}
                    step={0.05}
                    value={stop.density}
                    formatValue={formatMultiplier}
                    showNumberInput
                    inputAriaLabel={`Trail stop ${index + 1} density value`}
                    disabled={controlDisabled}
                    hint="Emission density around this part of the trail. 0 creates a gap."
                    onChange={(value) => patchBurstTrailStop(index, { density: round2(value) })}
                  />
                  <SliderField
                    label="Size"
                    min={0.08}
                    max={TRAIL_PARTICLE_SCALE_MAX}
                    step={0.05}
                    value={stop.size}
                    formatValue={formatMultiplier}
                    showNumberInput
                    // The slider covers the useful multiplier range; typed
                    // values may still use the full schema range (0.08-24).
                    numberInputMax={24}
                    inputAriaLabel={`Trail stop ${index + 1} size value`}
                    disabled={controlDisabled}
                    hint="Particle-size multiplier at this point in the trail."
                    onChange={(value) => patchBurstTrailStop(index, { size: round2(value) })}
                  />
                  <SliderField
                    label="Size variation"
                    min={0}
                    max={100}
                    step={1}
                    value={stop.sizeVariation}
                    formatValue={formatPercent}
                    showNumberInput
                    inputAriaLabel={`Trail stop ${index + 1} size variation value`}
                    disabled={controlDisabled}
                    hint="Seeded particle-size scatter local to this stop."
                    onChange={(value) =>
                      patchBurstTrailStop(index, { sizeVariation: round2(value) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        {renderBurstTrailOpeningControls(context, layerKey)}
        {renderBurstTrailClosingControls(context, layerKey)}

        <SubSection
          title="Spacing and spread"
          hint="Distribute sparks between the star and the far end of its trail."
        >
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Head-tail balance"
              min={TRAIL_BIAS_MIN}
              max={TRAIL_BIAS_MAX}
              step={1}
              value={trailBias}
              formatValue={formatTrailBias}
              disabled={controlDisabled}
              fullWidth
              hint="Where the total particle budget lands along each star path. This redistributes placement without changing the amount."
              onChange={(value) => setTrailBias(layerKey, round2(value))}
            />
            <AdvancedControls defaultOpen={false}>
              <SliderField
                label="Spacing curve"
                min={TRAIL_SPACING_CURVE_MIN}
                max={TRAIL_SPACING_CURVE_MAX}
                step={0.05}
                value={burstTrail.spacing.curve}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Spacing curve value"
                disabled={controlDisabled}
                hint="Curves where particles are spent along the path. 1x is linear; higher values make the balance fall off more exponentially toward the selected end."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'spacing', 'curve', round2(value))
                }
              />
              <SliderField
                label="Gap random"
                min={0}
                max={100}
                step={1}
                value={burstTrail.spacing.jitterPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Gap random value"
                disabled={controlDisabled}
                hint="Seeded randomness inside each spacing gap. 0% is even spacing; higher values make the trail more irregular."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'spacing', 'jitterPercent', round2(value))
                }
              />
              <SliderField
                label="Head gap"
                min={0}
                max={TRAIL_HEAD_GAP_MAX}
                step={1}
                value={burstTrail.placement.headGapPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Head gap value"
                disabled={controlDisabled}
                hint="How far newly generated particles start behind the star head. 0% can overlap the star; particles are never pushed in front."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'placement', 'headGapPercent', round2(value))
                }
              />
              <SliderField
                label="Front angle"
                min={TRAIL_FRONT_SPREAD_ANGLE_MIN}
                max={TRAIL_FRONT_SPREAD_ANGLE_MAX}
                step={1}
                value={burstTrail.width.front}
                formatValue={formatDegrees}
                showNumberInput
                inputAriaLabel="Front angle value"
                disabled={controlDisabled}
                hint="Spread angle around the fresh head end of the trail. Higher values scatter particles wider around the current star path."
                onChange={(value) => setBurstTrailNested(layerKey, 'width', 'front', round2(value))}
              />
              <SliderField
                label="Tail angle"
                min={0}
                max={TRAIL_SPREAD_ANGLE_MAX}
                step={1}
                value={burstTrail.width.tail}
                formatValue={formatDegrees}
                showNumberInput
                inputAriaLabel="Tail angle value"
                disabled={controlDisabled}
                hint="Spread angle around the old tail end. 0 degrees keeps the tail tight; higher values leave a wider tail."
                onChange={(value) => setBurstTrailNested(layerKey, 'width', 'tail', round2(value))}
              />
              <SliderField
                label="Width curve"
                min={0.2}
                max={4}
                step={0.05}
                value={burstTrail.width.curve}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Trail width curve value"
                disabled={controlDisabled}
                hint="Shapes the transition from the front angle to the tail angle."
                onChange={(value) => setBurstTrailNested(layerKey, 'width', 'curve', round2(value))}
              />
            </AdvancedControls>
          </div>
        </SubSection>

        <SubSection title="Spark movement" hint="How sparks move after leaving the star.">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Gravity"
              min={-2}
              max={1}
              step={0.01}
              value={burstTrail.motion.gravity}
              showNumberInput
              inputAriaLabel="Trail gravity value"
              disabled={controlDisabled}
              hint="Vertical acceleration of detached trail particles. More negative falls faster."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'motion', 'gravity', round2(value))
              }
            />
            <SliderField
              label="Drag"
              min={0}
              max={6}
              step={0.05}
              value={burstTrail.motion.drag}
              showNumberInput
              inputAriaLabel="Trail drag value"
              disabled={controlDisabled}
              hint="Air resistance. Higher values stop inherited movement sooner."
              onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'drag', round2(value))}
            />
            <SliderField
              label="Inherited speed"
              min={0}
              max={1}
              step={0.01}
              value={burstTrail.motion.inheritedVelocity}
              formatValue={formatProbability}
              showNumberInput
              inputAriaLabel="Trail inherited speed value"
              disabled={controlDisabled}
              hint="Share of the parent star's velocity retained when a trail particle is released."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'motion', 'inheritedVelocity', round2(value))
              }
            />
            <SliderField
              label="Turbulence"
              min={0}
              max={2}
              step={0.01}
              value={burstTrail.motion.turbulence}
              showNumberInput
              inputAriaLabel="Trail turbulence value"
              disabled={controlDisabled}
              hint="Seeded velocity scatter that roughens a perfectly smooth trail."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'motion', 'turbulence', round2(value))
              }
            />
            <SliderField
              label="Drift X"
              min={-2}
              max={2}
              step={0.01}
              value={burstTrail.motion.driftX}
              showNumberInput
              inputAriaLabel="Trail horizontal drift value"
              disabled={controlDisabled}
              hint="Constant left-right drift applied after emission."
              onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'driftX', round2(value))}
            />
            <SliderField
              label="Drift Y"
              min={-2}
              max={2}
              step={0.01}
              value={burstTrail.motion.driftY}
              showNumberInput
              inputAriaLabel="Trail vertical drift value"
              disabled={controlDisabled}
              hint="Constant vertical drift added independently of gravity."
              onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'driftY', round2(value))}
            />
            <SliderField
              label="Drift depth"
              min={-2}
              max={2}
              step={0.01}
              value={burstTrail.motion.driftZ}
              showNumberInput
              inputAriaLabel="Trail depth drift value"
              disabled={controlDisabled}
              hint="Constant front-to-back drift applied after emission."
              onChange={(value) => setBurstTrailNested(layerKey, 'motion', 'driftZ', round2(value))}
            />
          </div>
        </SubSection>

        <SubSection title="Brightness and flicker">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              inputKind="slider"
              label="Brightness"
              min={0}
              max={3}
              step={0.05}
              value={burstTrail.intensity.brightness}
              showNumberInput
              disabled={controlDisabled}
              fullWidth
              hint="How brightly the trail burns. 1 is standard; push higher for a hot, glowing trail."
              onChange={(value) =>
                setBurstTrailNested(layerKey, 'intensity', 'brightness', round2(value))
              }
            />
            <AdvancedControls defaultOpen={false}>
              <SliderField
                label="Fade softness"
                min={0.2}
                max={4}
                step={0.05}
                value={burstTrail.intensity.fadeSoftness}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Fade softness value"
                disabled={controlDisabled}
                hint="How gently each particle cools from its hot colour into the tail colour."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'intensity', 'fadeSoftness', round2(value))
                }
              />
              <SliderField
                label="Flicker"
                min={0}
                max={1}
                step={0.01}
                value={burstTrail.flicker.chance}
                disabled={controlDisabled}
                hint="Chance each particle twinkles white-hot, for a glittering, crackly trail. 0 is steady."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'flicker', 'chance', round2(value))
                }
              />
              <SliderField
                label="Flicker strength"
                min={0}
                max={3}
                step={0.05}
                value={burstTrail.flicker.strength}
                showNumberInput
                inputAriaLabel="Trail flicker strength value"
                disabled={controlDisabled}
                hint="Brightness multiplier for white-hot flicker flashes."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'flicker', 'strength', round2(value))
                }
              />
              <SliderField
                label="Flicker life"
                min={0}
                max={BURST_TRAIL_FLICKER_LIFE_MAX}
                step={0.01}
                value={burstTrail.flicker.lifetimeMultiplier}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Trail flicker life value"
                disabled={controlDisabled}
                hint="Lifetime multiplier for a particle selected to flicker."
                onChange={(value) =>
                  setBurstTrailNested(layerKey, 'flicker', 'lifetimeMultiplier', round2(value))
                }
              />
            </AdvancedControls>
          </div>
        </SubSection>
      </div>
    </PanelSection>
  );
}
