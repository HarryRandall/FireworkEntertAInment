'use client';
import { AppearanceField } from '@/ui/firework-editor/firework-render-controls/ControlFields';
import {
  CONTROL_GRID_CLASS,
  SubSection,
} from '@/ui/firework-editor/firework-render-controls/ControlSections';
import {
  formatMultiplier,
  formatPercent,
  round2,
} from '@showcrafter/firework-editor/control-values';
import type { RendererControlsContext } from '@showcrafter/firework-editor/use-render-controls';
import type { StarLayerKey } from '@showcrafter/fireworks/design';
import {
  MAX_BRIGHTNESS_HOLD_EXPONENT,
  MAX_BRIGHTNESS_HOLD_PERCENT,
  MIN_BRIGHTNESS_HOLD_EXPONENT,
  MIN_BRIGHTNESS_HOLD_PERCENT,
} from '@showcrafter/fireworks/render-tuning';
import type { ReactNode } from 'react';
import { RendererField as SliderField } from '../RendererField';
import { renderStarClosingControls } from './renderStarClosingControls';
import { renderStarOpeningControls } from './renderStarOpeningControls';

export function renderStarAppearance(
  context: RendererControlsContext,
  layerKey: StarLayerKey,
  controlDisabled: boolean,
  leadingControls?: ReactNode,
  showOpeningControls = true,
) {
  const {
    design,
    setLayerNestedValue,
    coreSoftnessRange,
    coreBrightnessRange,
    whiteCoreSizeRange,
    whiteCoreBlurRange,
    coreOpacityRange,
    glowSizeRange,
    glowSoftnessRange,
    glowOpacityRange,
    backgroundGlowSizeRange,
    backgroundGlowStrengthRange,
    backgroundGlowSoftnessRange,
    backgroundGlowOpacityRange,
  } = context;
  const heads = design.stars[layerKey].head;
  return (
    <div className="space-y-2.5">
      {leadingControls}
      {showOpeningControls ? renderStarOpeningControls(context, layerKey, controlDisabled) : null}
      {showOpeningControls ? renderStarClosingControls(context, layerKey, controlDisabled) : null}
      <SubSection title="Brightness curve">
        <div className={CONTROL_GRID_CLASS}>
          <SliderField
            label="Brightness hold"
            min={MIN_BRIGHTNESS_HOLD_PERCENT}
            max={MAX_BRIGHTNESS_HOLD_PERCENT}
            step={1}
            value={heads.brightnessHoldPercent}
            formatValue={formatPercent}
            showNumberInput
            inputAriaLabel="Star brightness hold value"
            disabled={controlDisabled}
            hint="Percentage of the star's life held at full brightness before its final fade begins."
            onChange={(value) =>
              setLayerNestedValue(layerKey, 'head', 'brightnessHoldPercent', round2(value))
            }
          />
          <SliderField
            label="Fade exponent"
            min={MIN_BRIGHTNESS_HOLD_EXPONENT}
            max={MAX_BRIGHTNESS_HOLD_EXPONENT}
            step={0.05}
            value={heads.brightnessHoldExponent}
            formatValue={formatMultiplier}
            showNumberInput
            inputAriaLabel="Star brightness fade exponent value"
            disabled={controlDisabled}
            hint="Shape of the post-hold fade. Higher values keep the star brighter before a sharper wink-out."
            onChange={(value) =>
              setLayerNestedValue(layerKey, 'head', 'brightnessHoldExponent', round2(value))
            }
          />
        </div>
      </SubSection>
      <SubSection title="Core">
        <div className={CONTROL_GRID_CLASS}>
          <AppearanceField
            label="Core blur"
            inputKind="slider"
            range={coreSoftnessRange}
            value={heads.coreSoftness}
            disabled={controlDisabled}
            hint="Blur through the coloured core. 0% is a hard-edged disc; higher diffuses the centre and edge into a soft orb."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'coreSoftness', value)}
          />
          <AppearanceField
            label="Brightness"
            inputKind="slider"
            range={coreBrightnessRange}
            value={heads.coreBrightness}
            disabled={controlDisabled}
            hint="How hot the coloured centre burns. Lower is calmer; higher pushes toward white."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'coreBrightness', value)}
          />
          <AppearanceField
            label="White dot size"
            range={whiteCoreSizeRange}
            value={heads.whiteCoreSizePercent}
            disabled={controlDisabled}
            hint="Size of the white-hot centre inside each star. Lower reduces the dot; higher grows it."
            onChange={(value) =>
              setLayerNestedValue(layerKey, 'head', 'whiteCoreSizePercent', value)
            }
          />
          <AppearanceField
            label="White dot blur"
            inputKind="slider"
            range={whiteCoreBlurRange}
            value={heads.whiteCoreBlurPercent}
            disabled={controlDisabled}
            hint="Feathering on the white dot. 0% is crisp; higher softens it without making a tiny dot flood the whole core."
            onChange={(value) =>
              setLayerNestedValue(layerKey, 'head', 'whiteCoreBlurPercent', value)
            }
          />
          <AppearanceField
            label="Core fade"
            range={coreOpacityRange}
            value={heads.coreOpacityFalloff}
            disabled={controlDisabled}
            fullWidth
            hint="Opacity falloff for the coloured core. 0% keeps the edge solid; higher fades the core into the surrounding glow."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'coreOpacityFalloff', value)}
          />
        </div>
      </SubSection>
      <SubSection title="Glow">
        <div className={CONTROL_GRID_CLASS}>
          <AppearanceField
            label="Star glow radius"
            range={glowSizeRange}
            value={heads.glowSize}
            disabled={controlDisabled}
            hint="Size of the coloured bloom attached to the star itself. Low hugs the core; high spreads the close glow outward."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowSize', value)}
          />
          <AppearanceField
            label="Star glow blur"
            inputKind="slider"
            range={glowSoftnessRange}
            value={heads.glowSoftness}
            disabled={controlDisabled}
            hint="Blur of the close coloured glow. Low is tight and defined; high spreads it into a much softer bloom."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowSoftness', value)}
          />
          <AppearanceField
            label="Star glow fade"
            range={glowOpacityRange}
            value={heads.glowOpacityFalloff}
            disabled={controlDisabled}
            hint="Opacity falloff for the close star glow. Higher values fade it to transparent sooner, removing the outer ring."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowOpacityFalloff', value)}
          />
          <AppearanceField
            label="Background glow size"
            range={backgroundGlowSizeRange}
            value={heads.glowPadding}
            disabled={controlDisabled}
            hint="Size of the large coloured wash behind each star. Lower keeps it tight; higher gives it more room to bloom."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowPadding', value)}
          />
          <AppearanceField
            label="Background glow strength"
            inputKind="slider"
            range={backgroundGlowStrengthRange}
            value={heads.glowBlur}
            disabled={controlDisabled}
            hint="Brightness of the large coloured wash behind each star. 0% removes it; higher stays coloured rather than turning the whole sprite white."
            onChange={(value) => setLayerNestedValue(layerKey, 'head', 'glowBlur', value)}
          />
          <AppearanceField
            label="Background blur"
            inputKind="slider"
            range={backgroundGlowSoftnessRange}
            value={heads.backgroundGlowSoftness}
            disabled={controlDisabled}
            hint="Blur of the large background wash. Higher values make the glow much more diffused without changing the star size."
            onChange={(value) =>
              setLayerNestedValue(layerKey, 'head', 'backgroundGlowSoftness', value)
            }
          />
          <AppearanceField
            label="Background fade"
            range={backgroundGlowOpacityRange}
            value={heads.backgroundGlowOpacityFalloff}
            disabled={controlDisabled}
            fullWidth
            hint="Opacity falloff for the large background wash. Higher values fade the outside to nothing before it reaches the sprite edge."
            onChange={(value) =>
              setLayerNestedValue(layerKey, 'head', 'backgroundGlowOpacityFalloff', value)
            }
          />
        </div>
      </SubSection>
    </div>
  );
}
