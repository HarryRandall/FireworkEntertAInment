/**
 * Single source of truth for the firework effect catalogue.
 *
 * Each entry is a colourless base effect (`firework_effects` row) plus a
 * representative preview palette so the dev firework lab can render it. The
 * clean-slate reseed migration mirrors this data into `public.firework_effects`
 * as `model_json`, so the runtime path (`compileFireworkDesign` reading
 * `baseModel.model_json`) and the lab preview path stay in lockstep.
 *
 * Values are calibrated to the Brocade reference bar and grounded in real-world
 * firework visuals (per-effect research with sources). The bar: prominent
 * streak trails via a non-`none` `burstTrail` preset, glowing head orbs with
 * high `glowStrength`, gravity tuned so trailing/hanging species droop and
 * crisp spheres hang, and colour that cools from white-hot to chemistry colour
 * to amber ember as stars die.
 */
import type { FireworkGeometry, FireworkTrailProfile } from './design';

export type CatalogueEffectCategory =
  | 'aerial_burst'
  | 'ascending'
  | 'ground'
  | 'noise'
  | 'compound';

type HeadSpec = {
  visible?: boolean;
  size: number;
  glowStrength?: number;
};

type BurstTrailSpec = {
  preset: 'none' | 'sparkDust' | 'solidStreaks' | 'willowHang' | 'cometTail' | 'denseBrocade';
  colourMode?: 'star' | 'gold' | 'silver' | 'ember' | 'starFade';
  particlesPerStar?: number;
  lifetimePercent?: number;
  baseSeconds?: number;
  gravity?: number;
  drag?: number;
  brightness?: number;
};

export type CatalogueEffect = {
  slug: string;
  name: string;
  category: CatalogueEffectCategory;
  patternKey: string;
  sortOrder: number;
  description: string;
  geometry: FireworkGeometry;
  trailProfile: FireworkTrailProfile;
  previewPalette: string[];
  renderDefaults: Record<string, unknown>;
};

/** Calibrated glowing head orb (the Brocade-quality bar). */
function head(spec: HeadSpec): Record<string, unknown> {
  return {
    visible: spec.visible ?? true,
    size: spec.size,
    glowStrength: spec.glowStrength ?? 1.6,
    glowPadding: 150,
    whiteCoreSizePercent: 20,
    whiteCoreBlurPercent: 15,
    coreSoftness: 55,
    coreBrightness: 50,
    coreOpacityFalloff: 60,
    glowSize: 90,
    glowSoftness: 100,
    glowOpacityFalloff: 100,
    glowBlur: 45,
    backgroundGlowOpacityFalloff: 75,
    backgroundGlowSoftness: 50,
    brightnessHoldPercent: 82,
    brightnessHoldExponent: 0.8,
  };
}

/** Rich streak-trail config for a preset, with optional per-effect overrides. */
function trail(spec: BurstTrailSpec): Record<string, unknown> {
  const bases: Record<BurstTrailSpec['preset'], Record<string, unknown>> = {
    none: { enabled: false, particlesPerStar: 0 },
    sparkDust: {
      enabled: true,
      particlesPerStar: 52,
      width: { front: 1.5, tail: 2.6, curve: 1.2 },
      lifetime: { percent: 0.18, baseSeconds: 1.1, afterglowSeconds: 0.18 },
      intensity: { brightness: 0.95, fadeSoftness: 1.3 },
      motion: { gravity: -0.04, drag: 2.1 },
    },
    solidStreaks: {
      enabled: true,
      particlesPerStar: 104,
      width: { front: 2.4, tail: 2.4, curve: 1 },
      lifetime: { percent: 0.22, baseSeconds: 1.7, afterglowSeconds: 0.32 },
      intensity: { brightness: 1.15, fadeSoftness: 1 },
      motion: { gravity: -0.02, drag: 1.4 },
    },
    willowHang: {
      enabled: true,
      particlesPerStar: 96,
      width: { front: 1.4, tail: 2.8, curve: 1.5 },
      lifetime: { percent: 0.34, baseSeconds: 2.7, afterglowSeconds: 0.45 },
      intensity: { brightness: 0.95, fadeSoftness: 1.6 },
      motion: { gravity: -0.12, drag: 0.8 },
    },
    cometTail: {
      enabled: true,
      particlesPerStar: 120,
      width: { front: 3.2, tail: 1.0, curve: 0.7 },
      lifetime: { percent: 0.24, baseSeconds: 1.5, afterglowSeconds: 0.25 },
      intensity: { brightness: 1.25, fadeSoftness: 0.9 },
      motion: { gravity: -0.03, drag: 1.3 },
    },
    denseBrocade: {
      enabled: true,
      particlesPerStar: 140,
      width: { front: 3.6, tail: 3.0, curve: 0.85 },
      lifetime: { percent: 0.26, baseSeconds: 1.8, afterglowSeconds: 0.25 },
      intensity: { brightness: 1.2, fadeSoftness: 1.0 },
      motion: { gravity: -0.02, drag: 1.5 },
    },
  };
  const base = bases[spec.preset];
  const overrides: Record<string, unknown> = {};
  if (spec.colourMode) overrides.colourMode = spec.colourMode;
  if (spec.particlesPerStar != null) overrides.particlesPerStar = spec.particlesPerStar;
  if (spec.lifetimePercent != null)
    overrides.lifetime = {
      ...(base.lifetime as Record<string, unknown>),
      percent: spec.lifetimePercent,
    };
  if (spec.baseSeconds != null)
    overrides.lifetime = {
      ...((overrides.lifetime as Record<string, unknown>) ??
        (base.lifetime as Record<string, unknown>)),
      baseSeconds: spec.baseSeconds,
    };
  if (spec.gravity != null || spec.drag != null) {
    overrides.motion = {
      ...((overrides.motion as Record<string, unknown>) ??
        (base.motion as Record<string, unknown>)),
      ...(spec.gravity != null ? { gravity: spec.gravity } : {}),
      ...(spec.drag != null ? { drag: spec.drag } : {}),
    };
  }
  if (spec.brightness != null)
    overrides.intensity = {
      ...((overrides.intensity as Record<string, unknown>) ??
        (base.intensity as Record<string, unknown>)),
      brightness: spec.brightness,
    };
  return { preset: spec.preset, ...base, ...overrides };
}

function starLayer(opts: {
  enabled?: boolean;
  count?: number;
  speed?: [number, number];
  gravity?: [number, number];
  life?: [number, number];
  head: Record<string, unknown>;
  burstTrail?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    enabled: opts.enabled ?? true,
    count: opts.count,
    burst: {
      speed: opts.speed,
      gravity: opts.gravity,
      life: opts.life,
      flairColorMode: 'bombColor',
    },
    head: opts.head,
    colourPattern: { mode: 'solid', axis: 'vertical', count: 1, colours: [] },
    burstTrail: opts.burstTrail,
  };
}

function build(
  effect: Omit<CatalogueEffect, 'renderDefaults'> & { renderDefaults: Record<string, unknown> },
): CatalogueEffect {
  return effect;
}

const NO_SECONDARY = {
  crackle: { enabled: false, probability: 0, sound: 'crackle' as const },
  strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
  split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
};

/**
 * The full effect catalogue. Order is the admin sort order. Slugs for the
 * original twelve effects are kept stable so existing catalogue items and
 * multishots re-link by slug after the clean-slate reseed.
 */
export const FIREWORK_EFFECT_CATALOGUE: CatalogueEffect[] = [
  build({
    slug: 'peony',
    name: 'Peony',
    category: 'aerial_burst',
    patternKey: 'peony',
    sortOrder: 10,
    description: 'Round radial burst of glowing stars without persistent trails.',
    geometry: 'sphere',
    trailProfile: 'none',
    previewPalette: ['#ff2d55', '#ff5a4d', '#ff7a6b'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'sphere',
      trailProfile: 'none',
      size: 115,
      liftVelocity: 17,
      shellLife: 4.2,
      burst: {
        speed: [2.4, 4.0],
        gravity: [-0.5, 0.0],
        life: [2.6, 3.8],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: false },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'auto' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 80,
          speed: [2.4, 4.0],
          gravity: [-0.5, 0.0],
          life: [2.6, 3.8],
          head: {
            ...head({ size: 170, glowStrength: 1.0 }),
            whiteCoreSizePercent: 10,
            coreBrightness: 30,
            coreSoftness: 70,
            brightnessHoldPercent: 40,
            opening: {
              colour: {
                enabled: true,
                color: { r: 1, g: 0.42, b: 0.08 },
                fadePercent: 16,
              },
              size: { enabled: false, startPercent: 35, growPercent: 18 },
            },
            closing: {
              colour: {
                enabled: true,
                color: { r: 1, g: 0.84, b: 0.4 },
                fadePercent: 32,
              },
              size: { enabled: true, endPercent: 0, shrinkPercent: 55 },
            },
          },
          burstTrail: trail({ preset: 'none' }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'chrysanthemum',
    name: 'Chrysanthemum',
    category: 'aerial_burst',
    patternKey: 'chrysanthemum',
    sortOrder: 20,
    description: 'Round flower burst whose stars carry long visible spark trails to the tips.',
    geometry: 'sphere',
    trailProfile: 'spark',
    previewPalette: ['#ffd166', '#ffcf6b', '#ffe9a8'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'sphere',
      trailProfile: 'spark',
      size: 75,
      liftVelocity: 22,
      shellLife: 5,
      burst: {
        speed: [1.6, 3.0],
        gravity: [-0.7, -0.2],
        life: [2.0, 3.5],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'auto' },
      mortar: { sound: true, smokeParticles: 110 },
      stars: {
        outer: starLayer({
          count: 75,
          speed: [1.6, 3.0],
          gravity: [-0.7, -0.2],
          life: [2.0, 3.5],
          head: head({ size: 260, glowStrength: 1.8 }),
          burstTrail: trail({
            preset: 'solidStreaks',
            colourMode: 'starFade',
            particlesPerStar: 96,
          }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'brocade',
    name: 'Brocade',
    category: 'aerial_burst',
    patternKey: 'brocade',
    sortOrder: 30,
    description:
      'White-gold crown with a hot lift streak, amber burst haze, and long falling brocade trails. The reference quality bar.',
    geometry: 'crown',
    trailProfile: 'glitter',
    previewPalette: ['#fff7de', '#ffe9a8', '#ffd166', '#ffae3d', '#9c5a17'],
    renderDefaults: {
      pattern: 'wave',
      geometry: 'crown',
      trailProfile: 'glitter',
      size: 270,
      color: { r: 1, g: 0.82, b: 0.36 },
      secondaryColor: { r: 1, g: 0.98, b: 0.88 },
      liftVelocity: 12.6,
      burst: {
        speed: [1.45, 2.85],
        gravity: [-0.82, -0.34],
        life: [1.15, 4.95],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.85, length: 2.35, sparkle: 0.62, thickness: 0.86 },
      flair: { enabled: true },
      crackle: { enabled: false, probability: 0, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 70 },
      brocade: {
        streakCount: 48,
        trailStep: 3,
        tubeRadius: 3.2,
        headsEnabled: true,
        headSize: 900,
        glowStrength: 1.2,
        greenRatio: 0.5,
        headColors: { green: { r: 0.4, g: 1, b: 0.5 }, red: { r: 1, g: 0.28, b: 0.32 } },
        palette: { hot: { r: 1, g: 0.93, b: 0.72 }, ember: { r: 1, g: 0.42, b: 0.14 } },
      },
    },
  }),
  build({
    slug: 'kamuro',
    name: 'Kamuro',
    category: 'aerial_burst',
    patternKey: 'kamuro',
    sortOrder: 35,
    description:
      'Dense gold-to-silver brocade crown that cascades downward in a long glittering umbrella, very long hang.',
    geometry: 'crown',
    trailProfile: 'glitter',
    previewPalette: ['#ffd166', '#fff3c4', '#f5f7fa', '#fff7de'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'crown',
      trailProfile: 'glitter',
      size: 90,
      liftVelocity: 24,
      shellLife: 6,
      burst: {
        speed: [1.2, 2.4],
        gravity: [-1.1, -0.5],
        life: [4.5, 6.5],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.6, length: 2.6, sparkle: 0.6, thickness: 0.9 },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.04, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'heavy' },
      mortar: { sound: true, smokeParticles: 90 },
      brocade: {
        streakCount: 56,
        trailStep: 3,
        tubeRadius: 3.2,
        headsEnabled: true,
        headSize: 700,
        glowStrength: 2.2,
        greenRatio: 0.5,
        headColors: {
          green: { r: 1, g: 0.84, b: 0.42 },
          red: { r: 0.96, g: 0.97, b: 1 },
        },
        palette: { hot: { r: 1, g: 0.93, b: 0.72 }, ember: { r: 1, g: 0.42, b: 0.14 } },
      },
    },
  }),
  build({
    slug: 'willow',
    name: 'Willow',
    category: 'aerial_burst',
    patternKey: 'willow',
    sortOrder: 40,
    description: 'Long-burning gold stars that droop and hang like weeping willow branches.',
    geometry: 'weeping',
    trailProfile: 'long_hang',
    previewPalette: ['#ffd166', '#ffcf6b', '#ffae3d', '#9c5a17'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'weeping',
      trailProfile: 'long_hang',
      size: 80,
      liftVelocity: 22,
      shellLife: 6,
      burst: {
        speed: [0.8, 1.8],
        gravity: [-1.3, -0.7],
        life: [5.0, 7.0],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.0, length: 2.6, sparkle: 0.3, thickness: 0.85 },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 120 },
      stars: {
        outer: starLayer({
          count: 80,
          speed: [0.8, 1.8],
          gravity: [-1.3, -0.7],
          life: [5.0, 7.0],
          head: head({ size: 500, glowStrength: 1.9 }),
          burstTrail: trail({
            preset: 'willowHang',
            colourMode: 'gold',
            particlesPerStar: 110,
            baseSeconds: 3.2,
            lifetimePercent: 0.42,
            gravity: -0.16,
            drag: 0.7,
            brightness: 1.1,
          }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'palm',
    name: 'Palm',
    category: 'aerial_burst',
    patternKey: 'palm',
    sortOrder: 50,
    description:
      'A thick golden rising trunk then a sparse burst of large heavy arms that arc into fronds.',
    geometry: 'radial_arms',
    trailProfile: 'thick_tail',
    previewPalette: ['#ffd166', '#ffae3d', '#14fc56'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'radial_arms',
      trailProfile: 'thick_tail',
      size: 12,
      liftVelocity: 22,
      shellLife: 6,
      burst: {
        speed: [2.2, 3.8],
        gravity: [-1.2, -0.6],
        life: [3.0, 5.0],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.2, length: 1.6, sparkle: 0.45, thickness: 1.7 },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'heavy' },
      mortar: { sound: true, smokeParticles: 120 },
      stars: {
        outer: starLayer({
          count: 12,
          speed: [2.2, 3.8],
          gravity: [-1.2, -0.6],
          life: [3.0, 5.0],
          head: head({ size: 600, glowStrength: 2.2 }),
          burstTrail: trail({ preset: 'cometTail', colourMode: 'gold', particlesPerStar: 120 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'ring',
    name: 'Ring',
    category: 'aerial_burst',
    patternKey: 'ring',
    sortOrder: 60,
    description: 'A perfectly symmetrical halo of stars expanding as a flat tilted circle.',
    geometry: 'ring',
    trailProfile: 'none',
    previewPalette: ['#1e7fff', '#f5f7fa', '#7fd0ff'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'ring',
      trailProfile: 'none',
      size: 60,
      liftVelocity: 22,
      shellLife: 3.2,
      burst: {
        speed: [1.4, 1.9],
        gravity: [-0.15, 0.05],
        life: [1.8, 2.6],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: false },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 95 },
      stars: {
        outer: starLayer({
          count: 60,
          speed: [1.4, 1.9],
          gravity: [-0.15, 0.05],
          life: [1.8, 2.6],
          head: head({ size: 200, glowStrength: 1.6 }),
          burstTrail: trail({ preset: 'none' }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'saturn',
    name: 'Saturn',
    category: 'aerial_burst',
    patternKey: 'saturn',
    sortOrder: 65,
    description: 'A central peony planet core framed by a separate equatorial ring of stars.',
    geometry: 'ring',
    trailProfile: 'none',
    previewPalette: ['#c800ff', '#39d98a', '#c89bff', '#7dffbb'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'ring',
      trailProfile: 'none',
      size: 65,
      liftVelocity: 21,
      shellLife: 5,
      burst: {
        speed: [1.0, 2.8],
        gravity: [-0.3, 0.0],
        life: [1.6, 3.0],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: false },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'auto' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 65,
          speed: [1.0, 2.8],
          gravity: [-0.3, 0.0],
          life: [1.6, 3.0],
          head: head({ size: 200, glowStrength: 1.6 }),
          burstTrail: trail({ preset: 'none' }),
        }),
        core: starLayer({
          count: 1,
          speed: [0, 0],
          gravity: [0, 0],
          life: [1.6, 3.0],
          head: head({ size: 560, glowStrength: 1.8 }),
          burstTrail: trail({ preset: 'none' }),
        }),
      },
    },
  }),
  build({
    slug: 'crossette',
    name: 'Crossette',
    category: 'aerial_burst',
    patternKey: 'crossette',
    sortOrder: 70,
    description:
      'Large comet stars that radiate outward then fracture mid-flight into crossing fragments.',
    geometry: 'split_cross',
    trailProfile: 'thick_tail',
    previewPalette: ['#f5f7fa', '#ffd166', '#fff3c4'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'split_cross',
      trailProfile: 'thick_tail',
      size: 40,
      liftVelocity: 20,
      shellLife: 3,
      burst: {
        speed: [1.6, 2.4],
        gravity: [-0.3, 0.0],
        life: [1.6, 2.4],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: true },
      crackle: { enabled: false, probability: 0, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: true, fragments: 4, speed: 1.8, delayRatio: 0.55 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 110 },
      stars: {
        outer: starLayer({
          count: 40,
          speed: [1.6, 2.4],
          gravity: [-0.3, 0.0],
          life: [1.6, 2.4],
          head: head({ size: 220, glowStrength: 1.5 }),
          burstTrail: trail({ preset: 'cometTail', colourMode: 'starFade', particlesPerStar: 90 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'double_break',
    name: 'Double Break',
    category: 'aerial_burst',
    patternKey: 'double_break',
    sortOrder: 75,
    description:
      'A shell that breaks, then breaks again into a second cloud of contrasting fragments.',
    geometry: 'split_cross',
    trailProfile: 'spark',
    previewPalette: ['#14fc56', '#1e7fff', '#7dffbb', '#7fd0ff'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'split_cross',
      trailProfile: 'spark',
      size: 70,
      liftVelocity: 26,
      shellLife: 7,
      burst: {
        speed: [1.4, 2.8],
        gravity: [-0.6, -0.1],
        life: [1.4, 2.6],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: true },
      crackle: { enabled: false, probability: 0, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: true, fragments: 6, speed: 2.2, delayRatio: 0.58 },
      sound: { launch: true, boom: 'heavy' },
      mortar: { sound: true, smokeParticles: 120 },
      stars: {
        outer: starLayer({
          count: 70,
          speed: [1.4, 2.8],
          gravity: [-0.6, -0.1],
          life: [1.4, 2.6],
          head: head({ size: 240, glowStrength: 1.7 }),
          burstTrail: trail({
            preset: 'solidStreaks',
            colourMode: 'starFade',
            particlesPerStar: 96,
          }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'bowtie',
    name: 'Bow Tie',
    category: 'aerial_burst',
    patternKey: 'bowtie',
    sortOrder: 78,
    description: 'Two opposed lobes fired in a flat plane, a cross or figure-eight shell.',
    geometry: 'bowtie',
    trailProfile: 'spark',
    previewPalette: ['#ff2d55', '#ff5a4d', '#ff8a5a'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'bowtie',
      trailProfile: 'spark',
      size: 32,
      liftVelocity: 20,
      shellLife: 5,
      burst: {
        speed: [1.8, 3.4],
        gravity: [-0.6, -0.1],
        life: [1.6, 3.0],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: true },
      crackle: { enabled: false, probability: 0, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: true, fragments: 4, speed: 1.8, delayRatio: 0.45 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 32,
          speed: [1.8, 3.4],
          gravity: [-0.6, -0.1],
          life: [1.6, 3.0],
          head: head({ size: 300, glowStrength: 1.8 }),
          burstTrail: trail({
            preset: 'solidStreaks',
            colourMode: 'starFade',
            particlesPerStar: 90,
          }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'horsetail',
    name: 'Horsetail',
    category: 'aerial_burst',
    patternKey: 'horsetail',
    sortOrder: 80,
    description:
      'A directional break whose heavy tailed stars travel only a short distance then cascade downward.',
    geometry: 'falling_tail',
    trailProfile: 'waterfall',
    previewPalette: ['#ffd166', '#ffae3d', '#fff3c4'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'falling_tail',
      trailProfile: 'waterfall',
      size: 50,
      liftVelocity: 18,
      shellLife: 6,
      burst: {
        speed: [0.6, 1.4],
        gravity: [-1.5, -1.0],
        life: [4.0, 6.5],
        flairColorMode: 'bombColor',
      },
      trail: { density: 1.8, length: 2.6, sparkle: 0.3, thickness: 0.9 },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.05, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 50,
          speed: [0.6, 1.4],
          gravity: [-1.5, -1.0],
          life: [4.0, 6.5],
          head: head({ size: 400, glowStrength: 1.8 }),
          burstTrail: trail({ preset: 'willowHang', colourMode: 'gold', particlesPerStar: 96 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'comet',
    name: 'Comet',
    category: 'ascending',
    patternKey: 'comet',
    sortOrder: 90,
    description:
      'A single large bright tailed star launched skyward leaving a long thick spark trail.',
    geometry: 'single_tail',
    trailProfile: 'thick_tail',
    previewPalette: ['#ffd166', '#ffae3d', '#fff7de'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'single_tail',
      trailProfile: 'thick_tail',
      size: 6,
      liftVelocity: 30,
      shellLife: 8,
      burst: {
        speed: [0.4, 0.8],
        gravity: [-0.2, 0.1],
        life: [3.0, 5.0],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.4, length: 1.6, sparkle: 0.5, thickness: 1.8 },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'none' },
      mortar: { sound: true, smokeParticles: 65 },
      stars: {
        outer: starLayer({
          count: 6,
          speed: [0.4, 0.8],
          gravity: [-0.2, 0.1],
          life: [3.0, 5.0],
          head: head({ size: 800, glowStrength: 2.6 }),
          burstTrail: trail({ preset: 'cometTail', colourMode: 'starFade', particlesPerStar: 120 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'mine',
    name: 'Mine',
    category: 'ground',
    patternKey: 'mine',
    sortOrder: 100,
    description:
      'A near-instantaneous upward blast of stars from ground level forming a wide cone plume.',
    geometry: 'upward_fan',
    trailProfile: 'glitter',
    previewPalette: ['#ff2d55', '#14fc56', '#ffae3d'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'upward_fan',
      trailProfile: 'glitter',
      size: 70,
      liftVelocity: 16,
      shellLife: 8,
      burst: {
        speed: [1.8, 3.2],
        gravity: [-1.2, -0.6],
        life: [1.0, 1.8],
        flairColorMode: 'mixed',
      },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.08, sound: 'lightBoom' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 80 },
      stars: {
        outer: starLayer({
          count: 70,
          speed: [1.8, 3.2],
          gravity: [-1.2, -0.6],
          life: [1.0, 1.8],
          head: head({ size: 160, glowStrength: 1.4 }),
          burstTrail: trail({ preset: 'cometTail', colourMode: 'starFade', particlesPerStar: 60 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'pearls',
    name: 'Pearls',
    category: 'aerial_burst',
    patternKey: 'pearls',
    sortOrder: 105,
    description: 'Large slow-burning stars arranged in a ring, each a glowing pearl.',
    geometry: 'pearls',
    trailProfile: 'pearls',
    previewPalette: ['#ffd166', '#f5f7fa', '#1e7fff'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'pearls',
      trailProfile: 'pearls',
      size: 60,
      liftVelocity: 22,
      shellLife: 4,
      burst: {
        speed: [1.0, 2.0],
        gravity: [-0.4, 0.0],
        life: [1.6, 3.6],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: false },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 95 },
      stars: {
        outer: starLayer({
          count: 60,
          speed: [1.0, 2.0],
          gravity: [-0.4, 0.0],
          life: [1.6, 3.6],
          head: head({ size: 430, glowStrength: 1.6 }),
          burstTrail: trail({ preset: 'sparkDust', colourMode: 'star', particlesPerStar: 24 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'pistil',
    name: 'Pistil',
    category: 'aerial_burst',
    patternKey: 'pistil',
    sortOrder: 108,
    description:
      'A coloured outer burst around a contrasting glowing central core, two concentric colour layers.',
    geometry: 'sphere',
    trailProfile: 'spark',
    previewPalette: ['#ff2d55', '#14fc56', '#ff5a4d', '#7dffbb'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'sphere',
      trailProfile: 'spark',
      size: 60,
      liftVelocity: 20,
      shellLife: 5,
      burst: {
        speed: [0.8, 2.6],
        gravity: [-0.4, 0.0],
        life: [1.4, 2.6],
        flairColorMode: 'bombColor',
      },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'auto' },
      mortar: { sound: true, smokeParticles: 105 },
      stars: {
        outer: starLayer({
          count: 60,
          speed: [1.4, 2.6],
          gravity: [-0.4, 0.0],
          life: [1.4, 2.6],
          head: head({ size: 200, glowStrength: 1.5 }),
          burstTrail: trail({ preset: 'sparkDust', colourMode: 'starFade', particlesPerStar: 56 }),
        }),
        core: starLayer({
          count: 30,
          speed: [0.4, 1.0],
          gravity: [-0.4, 0.0],
          life: [1.0, 2.2],
          head: head({ size: 320, glowStrength: 1.7 }),
          burstTrail: trail({ preset: 'none' }),
        }),
      },
    },
  }),
  build({
    slug: 'nishiki',
    name: 'Nishiki',
    category: 'aerial_burst',
    patternKey: 'nishiki',
    sortOrder: 110,
    description:
      'A brocade-style trailing crown threaded with a contrasting coloured pistil core (diadem).',
    geometry: 'sphere',
    trailProfile: 'glitter',
    previewPalette: ['#ffd166', '#fff3c4', '#1e7fff', '#c800ff'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'sphere',
      trailProfile: 'glitter',
      size: 82,
      liftVelocity: 23,
      shellLife: 6,
      burst: {
        speed: [1.1, 2.3],
        gravity: [-1.0, -0.4],
        life: [4.0, 6.0],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.4, length: 2.2, sparkle: 0.6, thickness: 1.0 },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.05, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'heavy' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 82,
          speed: [1.1, 2.3],
          gravity: [-1.0, -0.4],
          life: [4.0, 6.0],
          head: head({ size: 480, glowStrength: 2.0 }),
          burstTrail: trail({ preset: 'solidStreaks', colourMode: 'gold', particlesPerStar: 120 }),
        }),
        core: starLayer({
          count: 24,
          speed: [0.5, 1.0],
          gravity: [-0.9, -0.2],
          life: [1.0, 2.6],
          head: head({ size: 400, glowStrength: 1.7 }),
          burstTrail: trail({ preset: 'none' }),
        }),
      },
    },
  }),
  build({
    slug: 'strobe',
    name: 'Strobe',
    category: 'aerial_burst',
    patternKey: 'strobe',
    sortOrder: 115,
    description:
      'A spherical field of stars that oscillate between dark smoulder and sharp bright flashes.',
    geometry: 'sphere',
    trailProfile: 'blink',
    previewPalette: ['#ffffff', '#f0f6ff', '#9bf09b'],
    renderDefaults: {
      pattern: 'strobe',
      geometry: 'sphere',
      trailProfile: 'blink',
      size: 70,
      liftVelocity: 20,
      shellLife: 3,
      burst: { speed: [1.0, 1.8], gravity: [-0.4, 0.0], life: [2.5, 4.0], flairColorMode: 'mixed' },
      flair: { enabled: true },
      crackle: { enabled: false, probability: 0, sound: 'crackle' },
      strobe: { enabled: true, frequencyHz: 8, dutyCycle: 0.35 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 120 },
      stars: {
        outer: starLayer({
          count: 70,
          speed: [1.0, 1.8],
          gravity: [-0.4, 0.0],
          life: [2.5, 4.0],
          head: head({ size: 200, glowStrength: 1.4 }),
          burstTrail: trail({ preset: 'sparkDust', colourMode: 'star', particlesPerStar: 32 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'crackle',
    name: 'Crackle',
    category: 'noise',
    patternKey: 'crackle',
    sortOrder: 120,
    description:
      'A dense cloud of small pellets that pop in rapid succession with sharp bright flashes.',
    geometry: 'fragment_cloud',
    trailProfile: 'crackle',
    previewPalette: ['#ffffff', '#fff3c4', '#ffd166'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'fragment_cloud',
      trailProfile: 'crackle',
      size: 80,
      liftVelocity: 18,
      shellLife: 2.8,
      burst: {
        speed: [1.2, 2.2],
        gravity: [-0.5, -0.1],
        life: [1.2, 2.2],
        flairColorMode: 'mixed',
      },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.12, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 130 },
      stars: {
        outer: starLayer({
          count: 80,
          speed: [1.2, 2.2],
          gravity: [-0.5, -0.1],
          life: [1.2, 2.2],
          head: head({ size: 140, glowStrength: 1.4 }),
          burstTrail: trail({ preset: 'sparkDust', colourMode: 'starFade', particlesPerStar: 48 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'silverFish',
    name: 'Silver Fish',
    category: 'aerial_burst',
    patternKey: 'silverFish',
    sortOrder: 125,
    description:
      'A swarm of self-propelled silver micro-stars that dart and swim through the sky like fish.',
    geometry: 'fish',
    trailProfile: 'fish',
    previewPalette: ['#f5f7fa', '#ffd166', '#ffffff'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'fish',
      trailProfile: 'fish',
      size: 50,
      liftVelocity: 18,
      shellLife: 3,
      burst: { speed: [1.2, 2.5], gravity: [-0.2, 0.1], life: [1.8, 3.0], flairColorMode: 'mixed' },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.06, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 50,
          speed: [1.2, 2.5],
          gravity: [-0.2, 0.1],
          life: [1.8, 3.0],
          head: head({ size: 170, glowStrength: 1.2 }),
          burstTrail: trail({ preset: 'sparkDust', colourMode: 'silver', particlesPerStar: 36 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'waterfall',
    name: 'Waterfall',
    category: 'aerial_burst',
    patternKey: 'waterfall',
    sortOrder: 130,
    description:
      'Trailing stars that spread wide then cascade slowly downward like a shimmering gold curtain.',
    geometry: 'waterfall',
    trailProfile: 'waterfall',
    previewPalette: ['#ffd166', '#ffd870', '#f5f7fa'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'waterfall',
      trailProfile: 'waterfall',
      size: 80,
      liftVelocity: 18,
      shellLife: 3,
      burst: {
        speed: [0.6, 1.2],
        gravity: [-1.5, -1.0],
        life: [3.5, 6.0],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.2, length: 2.8, sparkle: 0.22, thickness: 0.85 },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 80,
          speed: [0.6, 1.2],
          gravity: [-1.5, -1.0],
          life: [3.5, 6.0],
          head: head({ size: 120, glowStrength: 0.9 }),
          burstTrail: trail({ preset: 'willowHang', colourMode: 'gold', particlesPerStar: 96 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'whirl',
    name: 'Whirl',
    category: 'aerial_burst',
    patternKey: 'whirl',
    sortOrder: 135,
    description:
      'A spinning corkscrew shower of sparks that rotates and ascends into a spiral column.',
    geometry: 'whirl',
    trailProfile: 'whirl',
    previewPalette: ['#f5f7fa', '#ff2d55', '#ffd166'],
    renderDefaults: {
      pattern: 'wave',
      geometry: 'whirl',
      trailProfile: 'whirl',
      size: 60,
      liftVelocity: 16,
      shellLife: 4,
      burst: {
        speed: [1.0, 2.0],
        gravity: [-0.8, -0.3],
        life: [2.0, 3.5],
        flairColorMode: 'mixed',
      },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'light' },
      mortar: { sound: true, smokeParticles: 100 },
      stars: {
        outer: starLayer({
          count: 60,
          speed: [1.0, 2.0],
          gravity: [-0.8, -0.3],
          life: [2.0, 3.5],
          head: head({ size: 220, glowStrength: 1.4 }),
          burstTrail: trail({ preset: 'cometTail', colourMode: 'starFade', particlesPerStar: 80 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'roman_candle',
    name: 'Roman Candle',
    category: 'ascending',
    patternKey: 'roman_candle',
    sortOrder: 140,
    description:
      'A ground tube that spits a cadenced sequence of glowing coloured stars that arc and flare.',
    geometry: 'roman_candle',
    trailProfile: 'thick_tail',
    previewPalette: ['#ff2d55', '#14fc56', '#1e7fff', '#ffd166'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'roman_candle',
      trailProfile: 'thick_tail',
      size: 30,
      liftVelocity: 14,
      shellLife: 14,
      burst: {
        speed: [0.6, 1.2],
        gravity: [-0.4, 0.0],
        life: [1.0, 1.8],
        flairColorMode: 'bombColor',
      },
      trail: { density: 1.8, length: 1.4, sparkle: 0.4, thickness: 1.4 },
      flair: { enabled: true },
      ...NO_SECONDARY,
      sound: { launch: true, boom: 'none' },
      mortar: { sound: true, smokeParticles: 50 },
      stars: {
        outer: starLayer({
          count: 30,
          speed: [0.6, 1.2],
          gravity: [-0.4, 0.0],
          life: [1.0, 1.8],
          head: head({ size: 240, glowStrength: 1.6 }),
          burstTrail: trail({ preset: 'cometTail', colourMode: 'starFade', particlesPerStar: 90 }),
        }),
        core: { enabled: false },
      },
    },
  }),
  build({
    slug: 'fountain',
    name: 'Fountain',
    category: 'ground',
    patternKey: 'fountain',
    sortOrder: 145,
    description:
      'A sustained ground-origin column of glittering sparks rising in a narrow cone and cascading back.',
    geometry: 'fountain',
    trailProfile: 'glitter',
    previewPalette: ['#f8f8ff', '#ffd166', '#fff3c4'],
    renderDefaults: {
      pattern: 'fibonacci',
      geometry: 'fountain',
      trailProfile: 'glitter',
      size: 90,
      liftVelocity: 8,
      shellLife: 30,
      burst: {
        speed: [0.8, 1.6],
        gravity: [-1.4, -0.8],
        life: [1.2, 2.4],
        flairColorMode: 'bombColor',
      },
      trail: { density: 2.0, length: 0.9, sparkle: 0.85, thickness: 0.8 },
      flair: { enabled: true },
      crackle: { enabled: true, probability: 0.05, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 },
      sound: { launch: false, boom: 'none' },
      mortar: { sound: false, smokeParticles: 30 },
      stars: {
        outer: starLayer({
          count: 90,
          speed: [0.8, 1.6],
          gravity: [-1.4, -0.8],
          life: [1.2, 2.4],
          head: head({ size: 90, glowStrength: 1.2 }),
          burstTrail: trail({ preset: 'sparkDust', colourMode: 'gold', particlesPerStar: 28 }),
        }),
        core: { enabled: false },
      },
    },
  }),
];

/** Map slug -> catalogue effect for quick lookup. */
export const CATALOGUE_BY_SLUG: Record<string, CatalogueEffect> = Object.fromEntries(
  FIREWORK_EFFECT_CATALOGUE.map((effect) => [effect.slug, effect]),
);

/**
 * Build the `model_json` payload stored on `public.firework_effects.model_json`,
 * i.e. the colourless `{ version, geometry, trailProfile, renderDefaults }` shape
 * the runtime reads via `compileFireworkDesign({ baseModel })`.
 */
export function catalogueEffectModelJson(effect: CatalogueEffect): Record<string, unknown> {
  return {
    version: 3,
    geometry: effect.geometry,
    trailProfile: effect.trailProfile,
    renderDefaults: effect.renderDefaults,
  };
}

/**
 * Coloured firework variants seeded per base effect. Each effect gets a
 * `<slug>-default` firework using its natural preview palette (preserving the
 * exact `<slug>-default` slug so existing dependents re-link) plus one firework
 * per contrast colour, giving the catalogue a spread of selectable variants.
 * Each variant carries a legacy `variant_json` shellType so the import/legacy
 * paths still resolve.
 */
export type CatalogueFirework = {
  slug: string;
  name: string;
  effectSlug: string;
  primaryColor: string;
  secondaryColor: string;
  colorPalette: string[];
  durationSeconds: number;
  heightMeters: number;
  shellType: string;
  spreadSize: number;
  starLifeMs: number;
};

type CatalogueVariantColour = {
  suffix: string;
  label: string;
  primary: string;
  secondary: string;
  palette: string[];
};

/** Contrast colours added per effect alongside the effect's natural default. */
const CATALOGUE_CONTRAST_COLOURS: CatalogueVariantColour[] = [
  {
    suffix: 'crimson',
    label: 'Crimson',
    primary: '#ff2d55',
    secondary: '#ff5a4d',
    palette: ['#ff2d55', '#ff5a4d', '#ff7a6b'],
  },
  {
    suffix: 'azure',
    label: 'Azure',
    primary: '#1e7fff',
    secondary: '#7fd0ff',
    palette: ['#1e7fff', '#7fd0ff', '#f5f7fa'],
  },
];

/** Shared physics per effect, applied to every coloured variant of that effect. */
function catalogueFireworkPhysics(effect: CatalogueEffect) {
  // Ground/ascending effects run longer and lower; aerial bursts higher.
  const isGround = effect.category === 'ground' || effect.slug === 'roman_candle';
  const durationSeconds = isGround ? 6 : effect.slug === 'comet' ? 3.4 : 5;
  const heightMeters = isGround ? 60 : effect.slug === 'comet' ? 160 : 220;
  const spreadSize =
    effect.slug === 'comet' ? 2.2 : effect.slug === 'mine' ? 3.2 : isGround ? 3.0 : 4.6;
  const starLifeMs =
    effect.slug === 'willow' || effect.slug === 'kamuro' || effect.slug === 'nishiki'
      ? 5200
      : effect.slug === 'brocade'
        ? 3000
        : effect.slug === 'horsetail' || effect.slug === 'waterfall'
          ? 4000
          : 1700;
  return { durationSeconds, heightMeters, spreadSize, starLifeMs };
}

export const CATALOGUE_FIREWORKS: CatalogueFirework[] = FIREWORK_EFFECT_CATALOGUE.flatMap(
  (effect) => {
    const physics = catalogueFireworkPhysics(effect);
    const variants: CatalogueFirework[] = [
      {
        slug: `${effect.slug}-default`,
        name: `${effect.name} Default`,
        effectSlug: effect.slug,
        primaryColor: effect.previewPalette[0],
        secondaryColor: effect.previewPalette[1] ?? effect.previewPalette[0],
        colorPalette: effect.previewPalette,
        shellType: effect.slug,
        ...physics,
      },
    ];
    for (const colour of CATALOGUE_CONTRAST_COLOURS) {
      variants.push({
        slug: `${effect.slug}-${colour.suffix}`,
        name: `${effect.name} ${colour.label}`,
        effectSlug: effect.slug,
        primaryColor: colour.primary,
        secondaryColor: colour.secondary,
        colorPalette: colour.palette,
        shellType: effect.slug,
        ...physics,
      });
    }
    return variants;
  },
);
