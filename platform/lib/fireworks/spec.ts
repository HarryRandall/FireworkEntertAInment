import { z } from "zod";

export const FIREWORK_COLORS = {
  Red: "#ff0043",
  Green: "#14fc56",
  Blue: "#1e7fff",
  Purple: "#e60aff",
  Gold: "#ffbf36",
  White: "#ffffff",
} as const;

export type FireworkColor = (typeof FIREWORK_COLORS)[keyof typeof FIREWORK_COLORS];

export const FIREWORK_COLOR_VALUES: readonly FireworkColor[] = Object.values(
  FIREWORK_COLORS,
);

export const SHELL_TYPES = [
  "crysanthemum",
  "ghost",
  "strobe",
  "palm",
  "ring",
  "crossette",
  "floral",
  "fallingLeaves",
  "willow",
  "crackle",
  "horsetail",
  "comet",
] as const;

export type ShellType = (typeof SHELL_TYPES)[number];

export const GLITTER_KINDS = [
  "none",
  "light",
  "medium",
  "heavy",
  "thick",
  "streamer",
  "willow",
] as const;

export type GlitterKind = (typeof GLITTER_KINDS)[number];

const HexColorSchema = z
  .enum([
    FIREWORK_COLORS.Red,
    FIREWORK_COLORS.Green,
    FIREWORK_COLORS.Blue,
    FIREWORK_COLORS.Purple,
    FIREWORK_COLORS.Gold,
    FIREWORK_COLORS.White,
  ])
  .describe("Allowed firework colour palette (matches the Caleb Miller exemplar).");

const ColorChoiceSchema = z.union([
  HexColorSchema,
  z.tuple([HexColorSchema, HexColorSchema]),
  z.literal("random"),
]);

export const FireworkSpecSchema = z.object({
  shellType: z.enum(SHELL_TYPES),
  spreadSize: z.coerce.number().min(0.4).max(40),
  starLifeMs: z.coerce.number().min(200).max(8000),
  starLifeVariation: z.coerce.number().min(0).max(1).optional(),
  starDensity: z.coerce.number().min(0.2).max(4).optional(),
  starCount: z.coerce.number().int().min(4).max(900).optional(),
  color: ColorChoiceSchema,
  secondColor: HexColorSchema.optional(),
  transitionTimeMs: z.coerce.number().min(50).max(8000).optional(),
  glitter: z.enum(GLITTER_KINDS).optional(),
  glitterColor: HexColorSchema.optional(),
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
  shellType: "crysanthemum",
  spreadSize: 4.6,
  starLifeMs: 1400,
  starLifeVariation: 0.125,
  starDensity: 1,
  color: FIREWORK_COLORS.Gold,
  glitter: "light",
  glitterColor: FIREWORK_COLORS.Gold,
};

export function safeParseFireworkSpec(input: unknown): FireworkSpec {
  const parsed = FireworkSpecSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  return DEFAULT_FIREWORK_SPEC;
}

export function hexToRgb(hex: FireworkColor | string): [number, number, number] {
  const value = hex.replace("#", "");
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return [1, 1, 1];
  return [
    ((int >> 16) & 0xff) / 255,
    ((int >> 8) & 0xff) / 255,
    (int & 0xff) / 255,
  ];
}

export function pickPrimaryColor(
  spec: FireworkSpec,
  rng: () => number,
): FireworkColor {
  const c = spec.color;
  if (c === "random") {
    const palette = FIREWORK_COLOR_VALUES.filter(
      (color) => color !== FIREWORK_COLORS.White,
    );
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
  light: { sparkFreq: 80, sparkSpeed: 0.6, sparkLifeMs: 320, sparkLifeVariation: 1.6 },
  medium: { sparkFreq: 140, sparkSpeed: 0.9, sparkLifeMs: 700, sparkLifeVariation: 1.8 },
  heavy: { sparkFreq: 220, sparkSpeed: 1.5, sparkLifeMs: 1200, sparkLifeVariation: 2 },
  thick: { sparkFreq: 320, sparkSpeed: 2.4, sparkLifeMs: 1300, sparkLifeVariation: 2.6 },
  streamer: { sparkFreq: 260, sparkSpeed: 2.0, sparkLifeMs: 700, sparkLifeVariation: 1.6 },
  willow: { sparkFreq: 180, sparkSpeed: 0.7, sparkLifeMs: 1400, sparkLifeVariation: 3 },
};
