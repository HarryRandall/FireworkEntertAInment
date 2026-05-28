/**
 * "Design" schema for individual firework cues used by the 3D renderer.
 *
 * A {@link FireworkDesign} is the lower-level draw description (pattern,
 * particle count, colour, etc.) that the {@link FireworksEngine} consumes.
 * The higher-level catalogue {@link FireworkSpec} (in `./spec.ts`) is
 * translated to this design shape at render time.
 */
import { z } from 'zod';

/** Valid burst patterns the renderer knows how to draw. */
export const FIREWORK_PATTERNS = ['fibonacci', 'wave', 'strobe'] as const;
export type FireworkPattern = (typeof FIREWORK_PATTERNS)[number];

export const FIREWORK_GEOMETRIES = [
  'sphere',
  'crown',
  'weeping',
  'radial_arms',
  'ring',
  'split_cross',
  'falling_tail',
  'single_tail',
  'upward_fan',
  'fragment_cloud',
  'pistil',
  'pearls',
  'fish',
  'waterfall',
  'whirl',
] as const;
export type FireworkGeometry = (typeof FIREWORK_GEOMETRIES)[number];

export const FIREWORK_TRAIL_PROFILES = [
  'none',
  'spark',
  'glitter',
  'long_hang',
  'thick_tail',
  'fragmenting',
  'spray',
  'blink',
  'crackle',
  'pearls',
  'fish',
  'waterfall',
  'whirl',
] as const;
export type FireworkTrailProfile = (typeof FIREWORK_TRAIL_PROFILES)[number];

const ColorSchema = z.union([
  z.object({
    r: z.coerce.number().min(0).max(1),
    g: z.coerce.number().min(0).max(1),
    b: z.coerce.number().min(0).max(1),
  }),
  z.literal('random'),
]);

const RangeSchema = z.tuple([z.coerce.number(), z.coerce.number()]);

export const FireworkDesignSchema = z.object({
  size: z.coerce.number().min(20).max(370).default(120),
  color: ColorSchema.default('random'),
  secondaryColor: ColorSchema.optional(),
  liftVelocity: z.coerce.number().min(4).max(40).optional(),
  shellLife: z.coerce.number().min(2).max(60).default(20),
  pattern: z.enum(FIREWORK_PATTERNS).default('fibonacci'),
  geometry: z.enum(FIREWORK_GEOMETRIES).default('sphere'),
  trailProfile: z.enum(FIREWORK_TRAIL_PROFILES).default('spark'),
  burst: z
    .object({
      speed: RangeSchema.default([2, 4]),
      gravity: RangeSchema.default([-0.24, -0.02]),
      life: RangeSchema.default([0.5, 6.5]),
      flairSizeStrobe: RangeSchema.optional(),
      flairColorMode: z.enum(['bombColor', 'random', 'mixed']).default('mixed'),
    })
    .default({
      speed: [2, 4],
      gravity: [-0.24, -0.02],
      life: [0.5, 6.5],
      flairColorMode: 'mixed',
    }),
  flair: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  crackle: z
    .object({
      enabled: z.boolean().default(true),
      probability: z.coerce.number().min(0).max(1).default(0.05),
      sound: z.enum(['crackle', 'lightBoom', 'heavyBoom']).default('crackle'),
    })
    .default({ enabled: true, probability: 0.05, sound: 'crackle' }),
  sound: z
    .object({
      boom: z.enum(['auto', 'light', 'heavy']).default('auto'),
    })
    .default({ boom: 'auto' }),
  pistil: z
    .object({
      enabled: z.boolean().default(false),
      color: ColorSchema.optional(),
      sizeRatio: z.coerce.number().min(0.1).max(0.9).default(0.38),
      speedRatio: z.coerce.number().min(0.1).max(0.9).default(0.48),
    })
    .default({ enabled: false, sizeRatio: 0.38, speedRatio: 0.48 }),
  strobe: z
    .object({
      enabled: z.boolean().default(false),
      frequencyHz: z.coerce.number().min(2).max(28).default(12),
      dutyCycle: z.coerce.number().min(0.1).max(0.9).default(0.45),
    })
    .default({ enabled: false, frequencyHz: 12, dutyCycle: 0.45 }),
  trail: z
    .object({
      density: z.coerce.number().min(0).max(4).default(1),
      length: z.coerce.number().min(0.2).max(4).default(1),
      sparkle: z.coerce.number().min(0).max(1).default(0.35),
      thickness: z.coerce.number().min(0.4).max(4).default(1),
      streakSize: z.coerce.number().min(0.4).max(4).default(1),
      streakLength: z.coerce.number().min(0.4).max(4).default(1),
      streakLife: z.coerce.number().min(0.2).max(4).default(1),
    })
    .default({
      density: 1,
      length: 1,
      sparkle: 0.35,
      thickness: 1,
      streakSize: 1,
      streakLength: 1,
      streakLife: 1,
    }),
  split: z
    .object({
      enabled: z.boolean().default(false),
      fragments: z.coerce.number().int().min(2).max(8).default(4),
      speed: z.coerce.number().min(0.4).max(4).default(1.55),
      delayRatio: z.coerce.number().min(0.15).max(0.85).default(0.42),
    })
    .default({ enabled: false, fragments: 4, speed: 1.55, delayRatio: 0.42 }),
  mortar: z
    .object({
      smokeParticles: z.coerce.number().int().min(0).max(500).default(100),
      sound: z.boolean().default(true),
    })
    .default({ smokeParticles: 100, sound: true }),
});

export type FireworkDesign = z.infer<typeof FireworkDesignSchema>;

export const DEFAULT_DESIGN: FireworkDesign = FireworkDesignSchema.parse({});
const DEFAULT_TRAIL_STREAK = { streakSize: 1, streakLength: 1, streakLife: 1 };

export function safeParseFireworkDesign(input: unknown): FireworkDesign {
  const parsed = FireworkDesignSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_DESIGN;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeDesign(base: unknown, override: unknown): unknown {
  if (!isRecord(base)) return override;
  if (!isRecord(override)) return base;
  const merged: RecordLike = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] =
      isRecord(value) && isRecord(merged[key]) ? deepMergeDesign(merged[key], value) : value;
  }
  return merged;
}

function hexToRendererColor(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return {
    r: ((int >> 16) & 0xff) / 255,
    g: ((int >> 8) & 0xff) / 255,
    b: (int & 0xff) / 255,
  };
}

function shellTypeToPattern(shellType: string | undefined): FireworkPattern {
  switch (shellType) {
    case 'ghost':
    case 'strobe':
    case 'crossette':
    case 'crackle':
    case 'silverFish':
    case 'whirl':
      return 'strobe';
    case 'brocade':
    case 'palm':
    case 'floral':
    case 'fallingLeaves':
    case 'willow':
    case 'horsetail':
    case 'comet':
    case 'tail':
    case 'mine':
    case 'pearls':
    case 'waterfall':
      return 'wave';
    default:
      return 'fibonacci';
  }
}

function shellTypeToGeometry(shellType: string | undefined): FireworkGeometry {
  switch (shellType) {
    case 'brocade':
      return 'crown';
    case 'palm':
      return 'radial_arms';
    case 'ring':
      return 'ring';
    case 'crossette':
      return 'split_cross';
    case 'fallingLeaves':
    case 'horsetail':
      return 'falling_tail';
    case 'willow':
      return 'weeping';
    case 'crackle':
      return 'fragment_cloud';
    case 'comet':
    case 'tail':
      return 'single_tail';
    case 'mine':
      return 'upward_fan';
    case 'pearls':
      return 'pearls';
    case 'pistil':
      return 'pistil';
    case 'silverFish':
      return 'fish';
    case 'waterfall':
      return 'waterfall';
    case 'whirl':
      return 'whirl';
    default:
      return 'sphere';
  }
}

function glitterToTrailProfile(
  glitter: unknown,
  shellType: string | undefined,
): FireworkTrailProfile {
  if (shellType === 'strobe' || shellType === 'ghost') return 'blink';
  if (shellType === 'crossette') return 'fragmenting';
  if (shellType === 'crackle') return 'crackle';
  if (shellType === 'brocade') return 'glitter';
  if (shellType === 'pearls') return 'pearls';
  if (shellType === 'silverFish') return 'fish';
  if (shellType === 'waterfall') return 'waterfall';
  if (shellType === 'whirl') return 'whirl';
  if (shellType === 'willow' || shellType === 'fallingLeaves' || shellType === 'horsetail') {
    return 'long_hang';
  }
  if (shellType === 'palm' || shellType === 'comet' || shellType === 'tail') return 'thick_tail';

  switch (glitter) {
    case 'none':
      return 'none';
    case 'heavy':
    case 'thick':
      return 'glitter';
    case 'streamer':
      return 'thick_tail';
    case 'willow':
      return 'long_hang';
    default:
      return 'spark';
  }
}

function trailProfileToSettings(profile: FireworkTrailProfile): FireworkDesign['trail'] {
  switch (profile) {
    case 'none':
      return { ...DEFAULT_TRAIL_STREAK, density: 0, length: 0.35, sparkle: 0, thickness: 0.6 };
    case 'glitter':
      return {
        ...DEFAULT_TRAIL_STREAK,
        density: 1.8,
        length: 1.35,
        sparkle: 0.78,
        thickness: 1.15,
      };
    case 'long_hang':
      return { ...DEFAULT_TRAIL_STREAK, density: 1.45, length: 2.4, sparkle: 0.28, thickness: 0.9 };
    case 'thick_tail':
      return {
        ...DEFAULT_TRAIL_STREAK,
        density: 2.1,
        length: 1.45,
        sparkle: 0.45,
        thickness: 1.65,
      };
    case 'fragmenting':
      return { ...DEFAULT_TRAIL_STREAK, density: 1.1, length: 0.95, sparkle: 0.5, thickness: 0.95 };
    case 'spray':
      return { ...DEFAULT_TRAIL_STREAK, density: 2.4, length: 0.9, sparkle: 0.6, thickness: 1.2 };
    case 'blink':
      return { ...DEFAULT_TRAIL_STREAK, density: 0.65, length: 0.75, sparkle: 0.9, thickness: 1.0 };
    case 'crackle':
      return { ...DEFAULT_TRAIL_STREAK, density: 1.5, length: 0.8, sparkle: 1, thickness: 1.0 };
    case 'pearls':
      return { ...DEFAULT_TRAIL_STREAK, density: 0.25, length: 0.45, sparkle: 0.1, thickness: 1.4 };
    case 'fish':
      return { ...DEFAULT_TRAIL_STREAK, density: 0.9, length: 0.55, sparkle: 0.45, thickness: 0.7 };
    case 'waterfall':
      return { ...DEFAULT_TRAIL_STREAK, density: 2.2, length: 2.8, sparkle: 0.22, thickness: 0.85 };
    case 'whirl':
      return { ...DEFAULT_TRAIL_STREAK, density: 2, length: 0.9, sparkle: 0.8, thickness: 1.1 };
    default:
      return { ...DEFAULT_TRAIL_STREAK, density: 1, length: 1, sparkle: 0.35, thickness: 1 };
  }
}

function extractBaseDefaults(baseModel: unknown): unknown {
  if (!isRecord(baseModel)) return baseModel;
  if (!isRecord(baseModel.renderDefaults)) return baseModel;

  const metadata: RecordLike = {};
  for (const key of ['geometry', 'trailProfile']) {
    if (baseModel[key] !== undefined) metadata[key] = baseModel[key];
  }

  return deepMergeDesign(metadata, baseModel.renderDefaults);
}

function fireworkSpecToDesignLike(spec: RecordLike): RecordLike | null {
  if (typeof spec.shellType !== 'string') return null;
  const spreadSize = typeof spec.spreadSize === 'number' ? spec.spreadSize : null;
  const starCount = typeof spec.starCount === 'number' ? spec.starCount : null;
  const starDensity = typeof spec.starDensity === 'number' ? spec.starDensity : 1;
  const starLifeMs = typeof spec.starLifeMs === 'number' ? spec.starLifeMs : null;
  const shellType = spec.shellType;
  const color =
    typeof spec.outerColor === 'string'
      ? hexToRendererColor(spec.outerColor)
      : typeof spec.color === 'string'
        ? hexToRendererColor(spec.color)
        : null;
  const secondaryColor =
    typeof spec.secondColor === 'string'
      ? hexToRendererColor(spec.secondColor)
      : typeof spec.innerColor === 'string'
        ? hexToRendererColor(spec.innerColor)
        : null;
  const pistilColor =
    typeof spec.pistilColor === 'string' ? hexToRendererColor(spec.pistilColor) : secondaryColor;
  const geometry = shellTypeToGeometry(shellType);
  const trailProfile = glitterToTrailProfile(spec.glitter, shellType);
  const size =
    starCount ?? (spreadSize == null ? undefined : Math.round(spreadSize * 52 * starDensity));
  const lifeSeconds = starLifeMs == null ? undefined : starLifeMs / 1000;
  const spreadSpeed = spreadSize == null ? null : Math.max(0.8, spreadSize);

  return {
    pattern: shellTypeToPattern(shellType),
    geometry,
    trailProfile,
    ...(size == null ? {} : { size }),
    ...(color == null ? {} : { color }),
    ...(secondaryColor == null ? {} : { secondaryColor }),
    trail: trailProfileToSettings(trailProfile),
    burst: {
      ...(spreadSpeed == null
        ? {}
        : { speed: [Math.max(0.6, spreadSpeed * 0.42), spreadSpeed * 0.82] }),
      ...(lifeSeconds == null ? {} : { life: [Math.max(0.45, lifeSeconds * 0.45), lifeSeconds] }),
      flairColorMode: spec.glitter === 'none' ? 'bombColor' : 'mixed',
      ...(shellType === 'strobe' ? { flairSizeStrobe: [8, 180] } : {}),
    },
    flair: { enabled: trailProfile !== 'none' && shellType !== 'ring' },
    crackle: {
      enabled: spec.crackle === true || shellType === 'crackle',
      probability: spec.crackle === true || shellType === 'crackle' ? 0.08 : 0,
      sound: 'crackle',
    },
    pistil: {
      enabled: spec.pistil === true || geometry === 'pistil',
      ...(pistilColor == null ? {} : { color: pistilColor }),
      sizeRatio: 0.34,
      speedRatio: 0.48,
    },
    strobe: {
      enabled: spec.strobe === true || shellType === 'strobe',
      frequencyHz: shellType === 'strobe' ? 14 : 9,
      dutyCycle: 0.42,
    },
    split: {
      enabled: spec.crossette === true || shellType === 'crossette',
      fragments: 4,
      speed: shellType === 'crossette' ? 1.8 : 1.4,
      delayRatio: 0.42,
    },
    sound: { boom: size != null && size > 240 ? 'heavy' : 'auto' },
    mortar: { sound: true, smokeParticles: size != null && size > 240 ? 130 : 100 },
  };
}

export function compileFireworkDesign(params: {
  baseModel?: unknown;
  variantOverrides?: unknown;
  primaryColor?: string | null;
  colorPalette?: string[] | null;
  legacySpec?: unknown;
}): FireworkDesign {
  const legacyDesignLike = isRecord(params.legacySpec)
    ? (fireworkSpecToDesignLike(params.legacySpec) ?? params.legacySpec)
    : params.legacySpec;
  const baseDefaults = extractBaseDefaults(params.baseModel);
  const legacyOrDefault = legacyDesignLike ?? DEFAULT_DESIGN;
  const withBase = deepMergeDesign(legacyOrDefault, baseDefaults);
  const withVariant = deepMergeDesign(withBase, params.variantOverrides);
  const compiled = isRecord(withVariant) ? { ...withVariant } : {};

  if (!isRecord(compiled.trail) && typeof compiled.trailProfile === 'string') {
    compiled.trail = trailProfileToSettings(compiled.trailProfile as FireworkTrailProfile);
  }

  const explicitColor = params.primaryColor
    ? hexToRendererColor(params.primaryColor)
    : params.colorPalette?.[0]
      ? hexToRendererColor(params.colorPalette[0])
      : null;
  if (explicitColor) {
    compiled.color = explicitColor;
  }
  if (params.colorPalette?.[1]) {
    const secondaryColor = hexToRendererColor(params.colorPalette[1]);
    if (secondaryColor) compiled.secondaryColor = secondaryColor;
  }

  return safeParseFireworkDesign(compiled);
}

const CALIBER_BASELINE_MM = 30;

function parseCaliberMm(caliber: string): number | null {
  const mm = caliber.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return parseFloat(mm[1]);
  const inches = caliber.match(/^(\d+(?:\.\d+)?)\s*["""]/);
  if (inches) return parseFloat(inches[1]) * 25.4;
  return null;
}

export function scaleDesignForCaliber(
  design: FireworkDesign,
  caliber: string | null,
): FireworkDesign {
  if (!caliber) return design;
  const mm = parseCaliberMm(caliber);
  if (!mm) return design;
  const scale = mm / CALIBER_BASELINE_MM;
  return {
    ...design,
    size: Math.round(Math.max(20, Math.min(370, design.size * scale))),
    burst: {
      ...design.burst,
      speed: [design.burst.speed[0] * scale, design.burst.speed[1] * scale],
    },
  };
}

export type LaunchPosition = { x: number; y: number; z: number };

export const DEFAULT_LAUNCH_POSITIONS: LaunchPosition[] = [
  { x: -200, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 200, y: 0, z: 0 },
];

export function parseLaunchPositions(input: unknown): LaunchPosition[] {
  if (!Array.isArray(input)) return DEFAULT_LAUNCH_POSITIONS;
  const positions = input
    .slice(0, 3)
    .map((entry): LaunchPosition | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const r = entry as Record<string, unknown>;
      const x = Number(r.x);
      const y = Number(r.y);
      const z = Number(r.z);
      if (![x, y, z].every(Number.isFinite)) return null;
      return { x, y, z };
    })
    .filter((p): p is LaunchPosition => p !== null);
  while (positions.length < 3) {
    positions.push(DEFAULT_LAUNCH_POSITIONS[positions.length]);
  }
  return positions.slice(0, 3);
}
