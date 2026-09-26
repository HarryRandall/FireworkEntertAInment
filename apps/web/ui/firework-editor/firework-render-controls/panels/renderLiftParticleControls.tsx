'use client';
import { ColorField } from '@/ui/firework-editor/ColorField';
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
import type { TrailParticleShapeOption } from '@showcrafter/firework-editor/control-values';
import {
  formatLoopCount,
  formatMultiplier,
  formatPercent,
  formatProbability,
  formatRotation,
  formatSeconds,
  formatTrailBias,
  formatTurns,
  frontClumpFromTrailBias,
  hexToRgbObject,
  LIFT_PARTICLE_AMOUNT_MAX,
  LIFT_PARTICLE_DRAG_MAX,
  LIFT_PARTICLE_FLICKER_STRENGTH_MAX,
  LIFT_PARTICLE_GRAVITY_MAX,
  LIFT_PARTICLE_GRAVITY_MIN,
  LIFT_PARTICLE_HEIGHT_PERCENT_MAX,
  LIFT_PARTICLE_INHERITED_VELOCITY_MAX,
  LIFT_PARTICLE_SIZE_MAX,
  LIFT_PARTICLE_TURBULENCE_MAX,
  LIFT_PATH_SAMPLES_MAX,
  LIFT_SWIRL_LOOP_COUNT_MAX,
  LIFT_SWIRL_LOOP_HEIGHT_MAX,
  LIFT_SWIRL_LOOP_LENGTH_MAX,
  LIFT_SWIRL_LOOP_LENGTH_MIN,
  LIFT_SWIRL_RADIUS_MAX,
  LIFT_SWIRL_RATE_MAX,
  LIFT_SWIRL_STRENGTH_MAX,
  rgbObjectToHex,
  round2,
  shapeOptionFromWeights,
  TRAIL_BIAS_MAX,
  TRAIL_BIAS_MIN,
  TRAIL_PARTICLE_SCALE_MAX,
  TRAIL_PARTICLE_SHAPE_OPTIONS,
  TRAIL_PARTICLE_SHAPE_WEIGHTS,
  TRAIL_ROTATION_MAX,
  TRAIL_SPACING_CURVE_MAX,
  TRAIL_SPACING_CURVE_MIN,
  trailBiasFromFrontClump,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import { BURST_TRAIL_FLICKER_LIFE_MAX } from '@showcrafter/fireworks/design';
import { RendererField as SliderField } from '../RendererField';

export function renderLiftParticleControls(context: RendererControlsContext) {
  const {
    showLaunch,
    design,
    sectionDisabled,
    setLaunchValue,
    liftParticlesEnabled,
    liftParticlesToggleId,
    disabled,
    setLaunchNestedValue,
  } = context;
  if (!showLaunch) return null;

  const liftParticles = design.launch.liftParticles;
  const controlDisabled = sectionDisabled.liftParticles;
  const particleShape = shapeOptionFromWeights(liftParticles.shapeWeights);
  const liftBias = trailBiasFromFrontClump(liftParticles.frontClump);
  function setParticleShape(value: string) {
    const shape = value as TrailParticleShapeOption;
    const weights = TRAIL_PARTICLE_SHAPE_WEIGHTS[shape] ?? TRAIL_PARTICLE_SHAPE_WEIGHTS.square;
    setLaunchValue('liftParticles', 'shapeWeights', { ...weights });
  }

  return (
    <PanelSection
      title="Lift particles"
      inactive={!liftParticlesEnabled}
      titleAccessory={<InfoTooltip text="Glowing ascent particles that climb with the shell." />}
      action={
        <Switch
          id={liftParticlesToggleId}
          aria-label="Lift particles"
          checked={liftParticlesEnabled}
          onCheckedChange={(value) => setLaunchValue('liftParticles', 'enabled', value)}
          disabled={disabled}
        />
      }
    >
      <div className="space-y-4">
        <SubSection title="Particles">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Amount"
              min={0}
              max={LIFT_PARTICLE_AMOUNT_MAX}
              step={1}
              value={liftParticles.amount}
              showNumberInput
              inputAriaLabel="Lift particle amount value"
              disabled={controlDisabled}
              hint="How many glowing particles climb with the shell before the burst."
              onChange={(value) => setLaunchValue('liftParticles', 'amount', Math.round(value))}
            />
            <ColorField
              label="Colour"
              value={rgbObjectToHex(liftParticles.colour)}
              allowClear
              disabled={controlDisabled}
              hint="Leave clear to inherit the firework's main lift colour."
              onChange={(value) =>
                setLaunchValue('liftParticles', 'colour', value ? hexToRgbObject(value) : undefined)
              }
            />
            <Field>
              <div className="flex items-center gap-1.5">
                <FieldLabel>Particle shape</FieldLabel>
                <InfoTooltip text="Shape of every lift particle: square sparks, glowing discs, triangles, or a mix." />
              </div>
              <SelectField
                value={particleShape}
                onChange={setParticleShape}
                options={[...TRAIL_PARTICLE_SHAPE_OPTIONS]}
                ariaLabel="Lift particle shape"
                disabled={controlDisabled}
              />
            </Field>
            <SliderField
              label="Particle size"
              min={1}
              max={LIFT_PARTICLE_SIZE_MAX}
              step={1}
              value={liftParticles.particleSize.base}
              showNumberInput
              inputAriaLabel="Lift particle size value"
              disabled={controlDisabled}
              fullWidth
              hint="Global size for every lift particle before head and tail scaling."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'particleSize', 'base', round2(value))
              }
            />
            <AdvancedControls>
              <SliderField
                label="Head scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={liftParticles.particleSize.headScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift head scale value"
                disabled={controlDisabled}
                hint="Size multiplier when each particle first appears near the rising shell."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'particleSize', 'headScale', round2(value))
                }
              />
              <SliderField
                label="Tail scale"
                min={0}
                max={TRAIL_PARTICLE_SCALE_MAX}
                step={0.05}
                value={liftParticles.particleSize.tailScale}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift tail scale value"
                disabled={controlDisabled}
                hint="Size multiplier as each particle ages into the lift tail."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'particleSize', 'tailScale', round2(value))
                }
              />
              <SliderField
                label="Size random"
                min={0}
                max={100}
                step={1}
                value={liftParticles.particleSize.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift size random value"
                disabled={controlDisabled}
                hint="Seeded size variation so the lift trail does not look uniform."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'particleSize',
                    'variationPercent',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Rotation"
                min={0}
                max={TRAIL_ROTATION_MAX}
                step={0.1}
                value={liftParticles.motion.spin}
                formatValue={formatRotation}
                showNumberInput
                inputAriaLabel="Lift rotation value"
                disabled={controlDisabled}
                hint="0 keeps every particle locked in place. Higher values spin particles as they fade."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'spin', round2(value))
                }
              />
            </AdvancedControls>
          </div>
        </SubSection>

        <SubSection title="Placement">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Head-tail balance"
              min={TRAIL_BIAS_MIN}
              max={TRAIL_BIAS_MAX}
              step={1}
              value={liftBias}
              formatValue={formatTrailBias}
              disabled={controlDisabled}
              hint="Where the lift particle budget lands along the ascent path."
              onChange={(value) =>
                setLaunchValue('liftParticles', 'frontClump', frontClumpFromTrailBias(value))
              }
            />
            <SliderField
              label="Rise height"
              min={0}
              max={LIFT_PARTICLE_HEIGHT_PERCENT_MAX}
              step={1}
              value={liftParticles.height}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Lift rise height percent value"
              disabled={controlDisabled}
              hint="How far up the shell path lift particles climb. 0% stays at launch; 100% reaches the burst centre."
              onChange={(value) => setLaunchValue('liftParticles', 'height', round2(value))}
            />
            <AdvancedControls>
              <SliderField
                label="Spacing curve"
                min={TRAIL_SPACING_CURVE_MIN}
                max={TRAIL_SPACING_CURVE_MAX}
                step={0.05}
                value={liftParticles.spacing.curve}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift spacing curve value"
                disabled={controlDisabled}
                hint="Curves where particles are spent along the launch path."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'spacing', 'curve', round2(value))
                }
              />
              <SliderField
                label="Gap random"
                min={0}
                max={100}
                step={1}
                value={liftParticles.spacing.jitterPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift gap random value"
                disabled={controlDisabled}
                hint="Seeded irregularity in lift-particle spacing."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'spacing', 'jitterPercent', round2(value))
                }
              />
              <SliderField
                label="Cluster strength"
                min={0}
                max={100}
                step={1}
                value={liftParticles.spacing.clusterStrength}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift cluster strength value"
                disabled={controlDisabled}
                hint="Bunches the particle budget into brighter pockets along the loop."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'spacing', 'clusterStrength', round2(value))
                }
              />
              <SliderField
                label="Path fill"
                min={1}
                max={LIFT_PATH_SAMPLES_MAX}
                step={1}
                value={liftParticles.spacing.pathSamples}
                showNumberInput
                inputAriaLabel="Lift path fill value"
                disabled={controlDisabled}
                hint="Subsamples the shell path between frames so lift particles form a smoother trail."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'spacing', 'pathSamples', Math.round(value))
                }
              />
            </AdvancedControls>
          </div>
        </SubSection>

        <SubSection title="Life and glow">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Particle life"
              min={0.1}
              max={8}
              step={0.1}
              value={liftParticles.lifetime.baseSeconds}
              formatValue={formatSeconds}
              showNumberInput
              inputAriaLabel="Lift particle life value"
              disabled={controlDisabled}
              hint="How long each lift particle remains visible."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'lifetime', 'baseSeconds', round2(value))
              }
            />
            <SliderField
              inputKind="knob"
              label="Brightness"
              min={0}
              max={3}
              step={0.05}
              value={liftParticles.intensity.brightness}
              showNumberInput
              inputAriaLabel="Lift brightness value"
              disabled={controlDisabled}
              hint="How brightly the lift particles burn."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'intensity', 'brightness', round2(value))
              }
            />
            <AdvancedControls>
              <SliderField
                label="Life random"
                min={0}
                max={100}
                step={1}
                value={liftParticles.lifetime.variationPercent}
                formatValue={formatPercent}
                showNumberInput
                inputAriaLabel="Lift life random value"
                disabled={controlDisabled}
                hint="Seeded variation in each particle's lifetime."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'lifetime',
                    'variationPercent',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Afterglow"
                min={0}
                max={6}
                step={0.05}
                value={liftParticles.lifetime.afterglowSeconds}
                formatValue={formatSeconds}
                showNumberInput
                inputAriaLabel="Lift afterglow value"
                disabled={controlDisabled}
                hint="Extra glow time added after the main particle life."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'lifetime',
                    'afterglowSeconds',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Fade softness"
                min={0.2}
                max={4}
                step={0.05}
                value={liftParticles.intensity.fadeSoftness}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift fade softness value"
                disabled={controlDisabled}
                hint="How gently lift particles cool into their tail."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'intensity', 'fadeSoftness', round2(value))
                }
              />
              <SliderField
                label="Flicker chance"
                min={0}
                max={1}
                step={0.01}
                value={liftParticles.flicker.chance}
                formatValue={formatProbability}
                showNumberInput
                inputAriaLabel="Lift flicker chance value"
                disabled={controlDisabled}
                hint="Chance each lift particle twinkles white-hot."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'flicker', 'chance', round2(value))
                }
              />
              <SliderField
                label="Flicker strength"
                min={0}
                max={LIFT_PARTICLE_FLICKER_STRENGTH_MAX}
                step={0.05}
                value={liftParticles.flicker.strength}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift flicker strength value"
                disabled={controlDisabled}
                hint="How strongly a flickering particle flashes towards white."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'flicker', 'strength', round2(value))
                }
              />
              <SliderField
                label="Flicker life"
                min={0}
                max={BURST_TRAIL_FLICKER_LIFE_MAX}
                step={0.01}
                value={liftParticles.flicker.lifetimeMultiplier}
                formatValue={formatMultiplier}
                showNumberInput
                inputAriaLabel="Lift flicker life value"
                disabled={controlDisabled}
                hint="Lifetime multiplier for particles that flicker. Lower values create sharper flashes."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'flicker',
                    'lifetimeMultiplier',
                    round2(value),
                  )
                }
              />
            </AdvancedControls>
          </div>
        </SubSection>

        <SubSection title="Motion">
          <div className={CONTROL_GRID_CLASS}>
            <SliderField
              label="Ascent swirl"
              min={0}
              max={LIFT_SWIRL_STRENGTH_MAX}
              step={0.05}
              value={liftParticles.motion.swirlStrength}
              showNumberInput
              inputAriaLabel="Lift ascent swirl value"
              disabled={controlDisabled}
              hint="Curves the shell sideways as it rises, making the lift trail corkscrew."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'swirlStrength', round2(value))
              }
            />
            <SliderField
              label="Swirl radius"
              min={0}
              max={LIFT_SWIRL_RADIUS_MAX}
              step={1}
              value={liftParticles.motion.swirlRadius}
              showNumberInput
              inputAriaLabel="Lift swirl radius value"
              disabled={controlDisabled}
              hint="Visible radius of the lift particles around the rising shell path."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'swirlRadius', round2(value))
              }
            />
            <SliderField
              label="Loop count"
              min={0}
              max={LIFT_SWIRL_LOOP_COUNT_MAX}
              step={0.1}
              value={liftParticles.motion.swirlLoopCount}
              formatValue={formatLoopCount}
              showNumberInput
              inputAriaLabel="Lift loop count value"
              disabled={controlDisabled}
              hint="How many full loopdy-loop turns the lift path draws after it clears the mortar."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'swirlLoopCount', round2(value))
              }
            />
            <SliderField
              label="Loop length"
              min={LIFT_SWIRL_LOOP_LENGTH_MIN}
              max={LIFT_SWIRL_LOOP_LENGTH_MAX}
              step={1}
              value={liftParticles.motion.swirlLoopLength}
              formatValue={formatPercent}
              showNumberInput
              inputAriaLabel="Lift loop length value"
              disabled={controlDisabled}
              hint="How much of the rise is used for the loop section. Shorter lengths make tighter arcs."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'swirlLoopLength', round2(value))
              }
            />
            <SliderField
              label="Loop height"
              min={0}
              max={LIFT_SWIRL_LOOP_HEIGHT_MAX}
              step={1}
              value={liftParticles.motion.swirlLoopHeight}
              showNumberInput
              inputAriaLabel="Lift loop height value"
              disabled={controlDisabled}
              hint="Adds a flat vertical curl after the lift clears the mortar."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'swirlLoopHeight', round2(value))
              }
            />
            <SliderField
              label="Loop speed"
              min={0}
              max={LIFT_SWIRL_RATE_MAX}
              step={0.1}
              value={liftParticles.motion.swirlRate}
              formatValue={formatTurns}
              showNumberInput
              inputAriaLabel="Lift loop speed value"
              disabled={controlDisabled}
              hint="How quickly the loop phase rotates over time. Keep this low for slow loopdy-loop launches."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'swirlRate', round2(value))
              }
            />
            <SliderField
              label="Side drift"
              min={-2}
              max={2}
              step={0.01}
              value={liftParticles.motion.driftX}
              showNumberInput
              inputAriaLabel="Lift side drift value"
              disabled={controlDisabled}
              hint="Left-right drift applied to lift particles."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'driftX', round2(value))
              }
            />
            <SliderField
              label="Vertical drift"
              min={-2}
              max={2}
              step={0.01}
              value={liftParticles.motion.driftY}
              showNumberInput
              inputAriaLabel="Lift vertical drift value"
              disabled={controlDisabled}
              hint="Extra vertical drift applied to lift particles."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'driftY', round2(value))
              }
            />
            <SliderField
              label="Forward drift"
              min={-2}
              max={2}
              step={0.01}
              value={liftParticles.motion.driftZ}
              showNumberInput
              inputAriaLabel="Lift forward drift value"
              disabled={controlDisabled}
              hint="Forward-back drift applied to lift particles."
              onChange={(value) =>
                setLaunchNestedValue('liftParticles', 'motion', 'driftZ', round2(value))
              }
            />
            <AdvancedControls>
              <SliderField
                label="Gravity"
                min={LIFT_PARTICLE_GRAVITY_MIN}
                max={LIFT_PARTICLE_GRAVITY_MAX}
                step={0.01}
                value={liftParticles.motion.gravity}
                showNumberInput
                inputAriaLabel="Lift gravity value"
                disabled={controlDisabled}
                hint="Vertical acceleration after a particle leaves the guided shell path."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'gravity', round2(value))
                }
              />
              <SliderField
                label="Drag"
                min={0}
                max={LIFT_PARTICLE_DRAG_MAX}
                step={0.05}
                value={liftParticles.motion.drag}
                showNumberInput
                inputAriaLabel="Lift drag value"
                disabled={controlDisabled}
                hint="Air resistance on released lift particles. Higher values stop their motion sooner."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'drag', round2(value))
                }
              />
              <SliderField
                label="Inherited speed"
                min={0}
                max={LIFT_PARTICLE_INHERITED_VELOCITY_MAX}
                step={0.01}
                value={liftParticles.motion.inheritedVelocity}
                formatValue={formatProbability}
                showNumberInput
                inputAriaLabel="Lift inherited speed value"
                disabled={controlDisabled}
                hint="Share of the shell's velocity retained when each lift particle is released."
                onChange={(value) =>
                  setLaunchNestedValue(
                    'liftParticles',
                    'motion',
                    'inheritedVelocity',
                    round2(value),
                  )
                }
              />
              <SliderField
                label="Turbulence"
                min={0}
                max={LIFT_PARTICLE_TURBULENCE_MAX}
                step={0.01}
                value={liftParticles.motion.turbulence}
                showNumberInput
                inputAriaLabel="Lift turbulence value"
                disabled={controlDisabled}
                hint="Random velocity scatter that roughens the launch trail."
                onChange={(value) =>
                  setLaunchNestedValue('liftParticles', 'motion', 'turbulence', round2(value))
                }
              />
            </AdvancedControls>
          </div>
        </SubSection>
      </div>
    </PanelSection>
  );
}
