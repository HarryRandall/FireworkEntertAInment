/**
 * Catalogue-facing {@link FireworkSpec} schema.
 *
 * This is the *human-meaningful* description of a firework (colour name,
 * shell type, glitter kind, caliber-friendly fields) that suppliers and the
 * import flow speak. The renderer-facing `FireworkDesign` (in `./design.ts`)
 * is derived from this at render time.
 */
import { z } from 'zod';

/** Named display colours and their hex values. */
export const FIREWORK_COLORS = {
  Red: '#ff0043',
  Green: '#14fc56',
  Blue: '#1e7fff',
  Purple: '#e60aff',
  Gold: '#ffbf36',
  White: '#ffffff',
} as const;

export type FireworkColor = (typeof FIREWORK_COLORS)[keyof typeof FIREWORK_COLORS];

export const FIREWORK_COLOR_VALUES: readonly FireworkColor[] = Object.values(FIREWORK_COLORS);

export const SHELL_TYPES = [
  'peony',
  'crysanthemum',
  'chrysanthemum',
  'brocade',
  'ghost',
  'strobe',
  'palm',
  'ring',
  'crossette',
  'floral',
  'fallingLeaves',
  'willow',
  'crackle',
  'horsetail',
  'comet',
  'tail',
  'mine',
  'pearls',
  'pistil',
  'silverFish',
  'waterfall',
  'whirl',
] as const;

export type ShellType = (typeof SHELL_TYPES)[number];

export const GLITTER_KINDS = [
  'none',
  'light',
  'medium',
  'heavy',
  'thick',
  'streamer',
  'willow',
] as const;

export type GlitterKind = (typeof GLITTER_KINDS)[number];

const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())
  .describe('Hex firework colour.');

const ColorChoiceSchema = z.union([
  HexColorSchema,
  z.tuple([HexColorSchema, HexColorSchema]),
  z.literal('random'),
]);

const FireworkShotSchema = z.object({
  index: z.coerce.number().int().min(0).optional(),
  timeOffsetSeconds: z.coerce.number().min(0).max(60).default(0),
  position: z
    .object({
      x: z.coerce.number().optional(),
      y: z.coerce.number().optional(),
      z: z.coerce.number().optional(),
    })
    .optional(),
  panDegrees: z.coerce.number().min(-180).max(180).optional(),
  tiltDegrees: z.coerce.number().min(0).max(180).optional(),
  scale: z.coerce.number().min(0.2).max(2).optional(),
  seedOffset: z.coerce.number().int().optional(),
  heightMeters: z.coerce.number().min(0).max(220).optional(),
  liftTimeSeconds: z.coerce.number().min(0.2).max(4).optional(),
  color: HexColorSchema.optional(),
  colorPalette: z.array(HexColorSchema).min(1).max(12).optional(),
  pistilColor: HexColorSchema.optional(),
  tailColor: HexColorSchema.optional(),
});

const LaunchSpecSchema = z.object({
  liftTimeSeconds: z.coerce.number().min(0.2).max(4).optional(),
  heightMeters: z.coerce.number().min(0).max(220).optional(),
  tracerColor: HexColorSchema.optional(),
  tailColor: HexColorSchema.optional(),
  sparkFrequency: z.coerce.number().min(0).max(1000).optional(),
  sparkLifeMs: z.coerce.number().min(50).max(4000).optional(),
  sparkSpeed: z.coerce.number().min(0).max(5).optional(),
  randomWobble: z.coerce.number().min(0).max(2).optional(),
});

export const FireworkSpecSchema = z.object({
  shellType: z.enum(SHELL_TYPES),
  spreadSize: z.coerce.number().min(0.4).max(40),
  starLifeMs: z.coerce.number().min(200).max(8000),
  starLifeVariation: z.coerce.number().min(0).max(1).optional(),
  starDensity: z.coerce.number().min(0.2).max(4).optional(),
  starCount: z.coerce.number().int().min(4).max(900).optional(),
  color: ColorChoiceSchema,
  colorPalette: z.array(HexColorSchema).min(1).max(12).optional(),
  innerColor: HexColorSchema.optional(),
  outerColor: HexColorSchema.optional(),
  secondColor: HexColorSchema.optional(),
  transitionTimeMs: z.coerce.number().min(50).max(8000).optional(),
  glitter: z.enum(GLITTER_KINDS).optional(),
  glitterColor: HexColorSchema.optional(),
  tailColor: HexColorSchema.optional(),
  trailEffect: z.enum(['none', 'silver', 'gold', 'streamer', 'crackle']).optional(),
  liftTimeSeconds: z.coerce.number().min(0.2).max(4).optional(),
  launch: LaunchSpecSchema.optional(),
  shots: z.array(FireworkShotSchema).max(500).optional(),
  pistil: z.boolean().optional(),
  pistilColor: HexColorSchema.optional(),
  streamers: z.boolean().optional(),
  strobe: z.boolean().optional(),
  strobeColor: HexColorSchema.optional(),
  ring: z.boolean().optional(),
  horsetail: z.boolean().optional(),
  crossette: z.boolean().optional(),
  crackle: z.boolean().optional(),
  floral: z.boolean().optional(),
  fallingLeaves: z.boolean().optional(),
});

export type FireworkSpec = z.infer<typeof FireworkSpecSchema>;

export type Vec3 = { x: number; y: number; z: number };
export type Rotation = { pan: number; tilt: number; roll: number };

export const DEFAULT_FIREWORK_SPEC: FireworkSpec = {
  shellType: 'crysanthemum',
  spreadSize: 4.6,
  starLifeMs: 1400,
  starLifeVariation: 0.125,
  starDensity: 1,
  color: FIREWORK_COLORS.Gold,
  glitter: 'light',
  glitterColor: FIREWORK_COLORS.Gold,
};

export function safeParseFireworkSpec(input: unknown): FireworkSpec {
  const parsed = FireworkSpecSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  return DEFAULT_FIREWORK_SPEC;
}

export function hexToRgb(hex: FireworkColor | string): [number, number, number] {
  const value = hex.replace('#', '');
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return [1, 1, 1];
  return [((int >> 16) & 0xff) / 255, ((int >> 8) & 0xff) / 255, (int & 0xff) / 255];
}

export function pickPrimaryColor(spec: FireworkSpec, rng: () => number): string {
  if (spec.outerColor) return spec.outerColor;
  if (spec.colorPalette?.length) {
    return spec.colorPalette[Math.floor(rng() * spec.colorPalette.length)] ?? spec.colorPalette[0];
  }
  const c = spec.color;
  if (c === 'random') {
    const palette = FIREWORK_COLOR_VALUES.filter((color) => color !== FIREWORK_COLORS.White);
    return palette[Math.floor(rng() * palette.length)] ?? FIREWORK_COLORS.Gold;
  }
  if (Array.isArray(c)) return c[Math.floor(rng() * 2)] ?? c[0];
  return c;
}

export const GLITTER_PROFILES: Record<
  GlitterKind,
  { sparkFreq: number; sparkSpeed: number; sparkLifeMs: number; sparkLifeVariation: number }
> = {
  none: { sparkFreq: 0, sparkSpeed: 0, sparkLifeMs: 0, sparkLifeVariation: 0 },
  light: { sparkFreq: 400, sparkSpeed: 0.3, sparkLifeMs: 300, sparkLifeVariation: 2 },
  medium: { sparkFreq: 200, sparkSpeed: 0.44, sparkLifeMs: 700, sparkLifeVariation: 2 },
  heavy: { sparkFreq: 80, sparkSpeed: 0.8, sparkLifeMs: 1400, sparkLifeVariation: 2 },
  thick: { sparkFreq: 16, sparkSpeed: 1.6, sparkLifeMs: 1400, sparkLifeVariation: 3 },
  streamer: { sparkFreq: 32, sparkSpeed: 1.05, sparkLifeMs: 620, sparkLifeVariation: 2 },
  willow: { sparkFreq: 120, sparkSpeed: 0.34, sparkLifeMs: 1400, sparkLifeVariation: 3.8 },
};
