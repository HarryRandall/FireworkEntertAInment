/**
 * Runtime-only renderer tuning shared by the WebGL engine and admin preview UI.
 * The same bounds also back the persisted head-appearance fields in design.ts.
 */

export type FireworkRenderTuning = {
  /** Legacy field name: background glow size, as a percentage of the star size. */
  glowPadding: number;
  whiteCoreSizePercent: number;
  whiteCoreBlurPercent: number;
};

export const DEFAULT_HEAD_GLOW_STRENGTH = 1.5;
export const MIN_HEAD_GLOW_STRENGTH = 0;
export const MAX_HEAD_GLOW_STRENGTH = 3;
export const HEAD_GLOW_STRENGTH_STEP = 0.05;

export const DEFAULT_GLOW_PADDING = 150;
export const MIN_GLOW_PADDING = 0;
export const MAX_GLOW_PADDING = 300;
export const GLOW_PADDING_STEP = 1;
export const DEFAULT_WHITE_CORE_SIZE_PERCENT = 20;
export const MIN_WHITE_CORE_SIZE_PERCENT = 0;
export const MAX_WHITE_CORE_SIZE_PERCENT = 40;
export const WHITE_CORE_SIZE_PERCENT_STEP = 1;
export const DEFAULT_WHITE_CORE_BLUR_PERCENT = 15;
export const MIN_WHITE_CORE_BLUR_PERCENT = 0;
export const MAX_WHITE_CORE_BLUR_PERCENT = 30;
export const WHITE_CORE_BLUR_PERCENT_STEP = 1;
export const HEAD_SPRITE_MAX_SIZE = 1280;

export const DEFAULT_FIREWORK_RENDER_TUNING: FireworkRenderTuning = {
  glowPadding: DEFAULT_GLOW_PADDING,
  whiteCoreSizePercent: DEFAULT_WHITE_CORE_SIZE_PERCENT,
  whiteCoreBlurPercent: DEFAULT_WHITE_CORE_BLUR_PERCENT,
};

export function normaliseFireworkRenderTuning(
  tuning: Partial<FireworkRenderTuning> | null | undefined,
): FireworkRenderTuning {
  const glowPadding = Number(tuning?.glowPadding);
  const whiteCoreSizePercent = Number(tuning?.whiteCoreSizePercent);
  const whiteCoreBlurPercent = Number(tuning?.whiteCoreBlurPercent);
  return {
    glowPadding: Number.isFinite(glowPadding)
      ? Math.min(MAX_GLOW_PADDING, Math.max(MIN_GLOW_PADDING, glowPadding))
      : DEFAULT_GLOW_PADDING,
    whiteCoreSizePercent: Number.isFinite(whiteCoreSizePercent)
      ? Math.min(
          MAX_WHITE_CORE_SIZE_PERCENT,
          Math.max(MIN_WHITE_CORE_SIZE_PERCENT, whiteCoreSizePercent),
        )
      : DEFAULT_WHITE_CORE_SIZE_PERCENT,
    whiteCoreBlurPercent: Number.isFinite(whiteCoreBlurPercent)
      ? Math.min(
          MAX_WHITE_CORE_BLUR_PERCENT,
          Math.max(MIN_WHITE_CORE_BLUR_PERCENT, whiteCoreBlurPercent),
        )
      : DEFAULT_WHITE_CORE_BLUR_PERCENT,
  };
}

/**
 * Head-orb appearance controls. These values shape how each glowing head
 * (brocade head or star orb) reads on screen, and the same bounds are reused
 * by persisted effect/firework design defaults.
 *
 * The goal is the "exemplar" look: a constant, bright coloured core that
 * feathers smoothly into a soft surrounding glow, instead of a flat hard-edged
 * sphere. Leaving every value at its default produces that soft orb; pulling
 * `coreSoftness` to 0 reproduces the old hard disc.
 */
export type FireworkHeadStyle = {
  /** Blur through the coloured core. */
  coreSoftness: number;
  /** Percent gain on the coloured core's centre intensity (how hot it burns). */
  coreBrightness: number;
  /** Opacity falloff for the coloured core. */
  coreOpacityFalloff: number;
  /** Close coloured bloom radius attached to the orb. */
  glowSize: number;
  /** Close coloured bloom softness. */
  glowSoftness: number;
  /** Close coloured bloom edge fade. */
  glowOpacityFalloff: number;
  /**
   * Strength of the large coloured background glow. Unlike raw glow strength
   * this stays coloured and feathered instead of whitening the whole sprite.
   */
  glowBlur: number;
  /** Large background glow edge fade. */
  backgroundGlowOpacityFalloff: number;
  /** Large background glow diffusion. */
  backgroundGlowSoftness: number;
};

export const DEFAULT_CORE_SOFTNESS = 55;
export const MIN_CORE_SOFTNESS = 0;
export const MAX_CORE_SOFTNESS = 110;
export const CORE_SOFTNESS_STEP = 1;

export const DEFAULT_CORE_BRIGHTNESS = 50;
export const MIN_CORE_BRIGHTNESS = 0;
export const MAX_CORE_BRIGHTNESS = 100;
export const CORE_BRIGHTNESS_STEP = 5;

export const DEFAULT_CORE_OPACITY_FALLOFF = 60;
export const MIN_CORE_OPACITY_FALLOFF = 0;
export const MAX_CORE_OPACITY_FALLOFF = 120;
export const CORE_OPACITY_FALLOFF_STEP = 1;

export const DEFAULT_GLOW_SIZE = 90;
export const MIN_GLOW_SIZE = 0;
export const MAX_GLOW_SIZE = 180;
export const GLOW_SIZE_STEP = 1;

export const DEFAULT_GLOW_SOFTNESS = 100;
export const MIN_GLOW_SOFTNESS = 0;
export const MAX_GLOW_SOFTNESS = 200;
export const GLOW_SOFTNESS_STEP = 1;

export const DEFAULT_GLOW_OPACITY_FALLOFF = 100;
export const MIN_GLOW_OPACITY_FALLOFF = 0;
export const MAX_GLOW_OPACITY_FALLOFF = 200;
export const GLOW_OPACITY_FALLOFF_STEP = 1;

export const DEFAULT_GLOW_BLUR = 45;
export const MIN_GLOW_BLUR = 0;
export const MAX_GLOW_BLUR = 100;
export const GLOW_BLUR_STEP = 1;

export const DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF = 75;
export const MIN_BACKGROUND_GLOW_OPACITY_FALLOFF = 0;
export const MAX_BACKGROUND_GLOW_OPACITY_FALLOFF = 150;
export const BACKGROUND_GLOW_OPACITY_FALLOFF_STEP = 1;

export const DEFAULT_BACKGROUND_GLOW_SOFTNESS = 50;
export const MIN_BACKGROUND_GLOW_SOFTNESS = 0;
export const MAX_BACKGROUND_GLOW_SOFTNESS = 100;
export const BACKGROUND_GLOW_SOFTNESS_STEP = 1;

export const DEFAULT_FIREWORK_HEAD_STYLE: FireworkHeadStyle = {
  coreSoftness: DEFAULT_CORE_SOFTNESS,
  coreBrightness: DEFAULT_CORE_BRIGHTNESS,
  coreOpacityFalloff: DEFAULT_CORE_OPACITY_FALLOFF,
  glowSize: DEFAULT_GLOW_SIZE,
  glowSoftness: DEFAULT_GLOW_SOFTNESS,
  glowOpacityFalloff: DEFAULT_GLOW_OPACITY_FALLOFF,
  glowBlur: DEFAULT_GLOW_BLUR,
  backgroundGlowOpacityFalloff: DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
  backgroundGlowSoftness: DEFAULT_BACKGROUND_GLOW_SOFTNESS,
};

function clampOr(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function normaliseFireworkHeadStyle(
  style: Partial<FireworkHeadStyle> | null | undefined,
): FireworkHeadStyle {
  return {
    coreSoftness: clampOr(
      Number(style?.coreSoftness),
      MIN_CORE_SOFTNESS,
      MAX_CORE_SOFTNESS,
      DEFAULT_CORE_SOFTNESS,
    ),
    coreBrightness: clampOr(
      Number(style?.coreBrightness),
      MIN_CORE_BRIGHTNESS,
      MAX_CORE_BRIGHTNESS,
      DEFAULT_CORE_BRIGHTNESS,
    ),
    coreOpacityFalloff: clampOr(
      Number(style?.coreOpacityFalloff),
      MIN_CORE_OPACITY_FALLOFF,
      MAX_CORE_OPACITY_FALLOFF,
      DEFAULT_CORE_OPACITY_FALLOFF,
    ),
    glowSize: clampOr(Number(style?.glowSize), MIN_GLOW_SIZE, MAX_GLOW_SIZE, DEFAULT_GLOW_SIZE),
    glowSoftness: clampOr(
      Number(style?.glowSoftness),
      MIN_GLOW_SOFTNESS,
      MAX_GLOW_SOFTNESS,
      DEFAULT_GLOW_SOFTNESS,
    ),
    glowOpacityFalloff: clampOr(
      Number(style?.glowOpacityFalloff),
      MIN_GLOW_OPACITY_FALLOFF,
      MAX_GLOW_OPACITY_FALLOFF,
      DEFAULT_GLOW_OPACITY_FALLOFF,
    ),
    glowBlur: clampOr(Number(style?.glowBlur), MIN_GLOW_BLUR, MAX_GLOW_BLUR, DEFAULT_GLOW_BLUR),
    backgroundGlowOpacityFalloff: clampOr(
      Number(style?.backgroundGlowOpacityFalloff),
      MIN_BACKGROUND_GLOW_OPACITY_FALLOFF,
      MAX_BACKGROUND_GLOW_OPACITY_FALLOFF,
      DEFAULT_BACKGROUND_GLOW_OPACITY_FALLOFF,
    ),
    backgroundGlowSoftness: clampOr(
      Number(style?.backgroundGlowSoftness),
      MIN_BACKGROUND_GLOW_SOFTNESS,
      MAX_BACKGROUND_GLOW_SOFTNESS,
      DEFAULT_BACKGROUND_GLOW_SOFTNESS,
    ),
  };
}
