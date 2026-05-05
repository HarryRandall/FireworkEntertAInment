import { z } from "zod";

export const FIREWORK_PATTERNS = ["fibonacci", "wave", "strobe"] as const;
export type FireworkPattern = (typeof FIREWORK_PATTERNS)[number];

const ColorSchema = z.union([
  z.object({
    r: z.coerce.number().min(0).max(1),
    g: z.coerce.number().min(0).max(1),
    b: z.coerce.number().min(0).max(1),
  }),
  z.literal("random"),
]);

const RangeSchema = z.tuple([z.coerce.number(), z.coerce.number()]);

export const FireworkDesignSchema = z.object({
  size: z.coerce.number().min(20).max(370).default(120),
  color: ColorSchema.default("random"),
  liftVelocity: z.coerce.number().min(4).max(40).optional(),
  shellLife: z.coerce.number().min(2).max(60).default(20),
  pattern: z.enum(FIREWORK_PATTERNS).default("fibonacci"),
  burst: z
    .object({
      speed: RangeSchema.default([2, 4]),
      gravity: RangeSchema.default([-2.1, -0.1]),
      life: RangeSchema.default([0.5, 6.5]),
      flairSizeStrobe: RangeSchema.optional(),
      flairColorMode: z.enum(["bombColor", "random", "mixed"]).default("mixed"),
    })
    .default({
      speed: [2, 4],
      gravity: [-2.1, -0.1],
      life: [0.5, 6.5],
      flairColorMode: "mixed",
    }),
  flair: z
    .object({ enabled: z.boolean().default(true) })
    .default({ enabled: true }),
  crackle: z
    .object({
      enabled: z.boolean().default(true),
      probability: z.coerce.number().min(0).max(1).default(0.05),
      sound: z.enum(["crackle", "lightBoom", "heavyBoom"]).default("crackle"),
    })
    .default({ enabled: true, probability: 0.05, sound: "crackle" }),
  sound: z
    .object({
      boom: z.enum(["auto", "light", "heavy"]).default("auto"),
    })
    .default({ boom: "auto" }),
  mortar: z
    .object({
      smokeParticles: z.coerce.number().int().min(0).max(500).default(100),
      sound: z.boolean().default(true),
    })
    .default({ smokeParticles: 100, sound: true }),
});

export type FireworkDesign = z.infer<typeof FireworkDesignSchema>;

export const DEFAULT_DESIGN: FireworkDesign = FireworkDesignSchema.parse({});

export function safeParseFireworkDesign(input: unknown): FireworkDesign {
  const parsed = FireworkDesignSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_DESIGN;
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
      if (typeof entry !== "object" || entry === null) return null;
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
