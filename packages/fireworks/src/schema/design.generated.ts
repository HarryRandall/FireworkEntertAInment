// Generated design-schema validators and public types for renderer input validation.
// Generated from schema/design.v1.json; run pnpm generate:schema rather than editing this file.
import { z } from 'zod';
export const hexColourSchema = z.string().regex(new RegExp('^#[0-9a-fA-F]{6}$'));
export const vectorMSchema = z.tuple([
  z.number().gte(-1000).lte(1000),
  z.number().gte(-1000).lte(1000),
  z.number().gte(-1000).lte(1000),
]);
export const directionSchema = z.tuple([
  z.number().gte(-1).lte(1),
  z.number().gte(-1).lte(1),
  z.number().gte(-1).lte(1),
]);
export const colourValueSchema = z.union([
  hexColourSchema,
  z.array(hexColourSchema).min(1).max(16),
]);
export const colourStopSchema = z.tuple([z.number().gte(0).lte(2), colourValueSchema]);
export const colourSchema = z
  .object({
    mode: z.enum(['solid', 'alternate', 'random', 'per_star']),
    stops: z.array(colourStopSchema).min(2).max(32),
    reignition: z
      .object({
        at: z.number().gte(0).lte(1),
        duration: z.number().gt(0).lte(1),
        amount: z.number().gte(0).lte(10),
      })
      .strict()
      .optional(),
  })
  .strict();
export const brightnessStopSchema = z.tuple([z.number().gte(0).lte(1), z.number().gte(0).lte(10)]);
export const brightnessSchema = z.array(brightnessStopSchema).min(2).max(32);
export const headSchema = z
  .object({
    size: z.number().gte(0).lte(10),
    visible: z.boolean(),
    halo: z.number().gte(0).lte(4).optional(),
  })
  .strict();
export const trailSchema = z
  .object({
    sparks: z.number().int().gte(0).lte(10000),
    length_s: z.number().gte(0.001).lte(20),
    spread_m_s: z.number().gte(0).lte(200),
    gravity_m_s2: z.number().gte(-40).lte(100),
    drag_per_s: z.number().gte(0.001).lte(30),
    size: z.number().gte(0).lte(10),
    flicker: z.number().gte(0).lte(1),
    colour: z.union([z.enum(['house', 'star']), hexColourSchema]),
    glitter: z.number().gte(0).lte(1),
    glitter_delay_s: z.number().gte(0).lte(20),
    fork: z.number().gte(0).lte(1),
  })
  .strict();
export const modifierSchema = z
  .object({
    kind: z.enum([
      'crackle',
      'strobe',
      'twinkle',
      'crossette',
      'ghost',
      'fish',
      'bees',
      'flutter',
      'pop',
      'glitter',
      'twist',
      'split',
      'whistle',
    ]),
    at: z.number().gte(0).lte(1),
    rate_hz: z.number().gte(0.001).lte(500),
    count: z.number().int().gte(1).lte(400),
    amount: z.number().gte(-20).lte(20),
    spread: z.enum(['burst', 'continuous']),
    gap: z.number().gte(0).lte(1),
    angular_speed_rad_s: z.number().gte(-500).lte(500),
    rate_rad_s: z.number().gte(0).lte(500),
  })
  .strict();
export const layerSchema = z
  .object({
    id: z.string().regex(new RegExp('^[A-Za-z0-9][A-Za-z0-9_-]*$')).min(1).max(64),
    name: z.string().min(1).max(120),
    pattern: z.enum([
      'sphere',
      'ring',
      'double_ring',
      'heart',
      'spiral',
      'random',
      'fan',
      'cone',
      'straight',
      'sequence',
      'bottom',
    ]),
    count: z.number().int().gte(0).lte(10000),
    radius_m: z.number().gte(0).lte(500),
    tilt: z.number().gte(-1).lte(1),
    speed_var: z.number().gte(0).lte(1),
    drag_per_s: z.number().gte(0.001).lte(30),
    gravity_m_s2: z.number().gte(-40).lte(100),
    life_s: z.number().gte(0.001).lte(120),
    life_var: z.number().gte(0).lte(1),
    delay_s: z.number().gte(0).lte(120),
    offset_m: vectorMSchema,
    flash: z.boolean(),
    hidden: z.boolean(),
    colour: colourSchema,
    brightness: brightnessSchema,
    head: headSchema,
    trail: trailSchema,
    modifiers: z.array(modifierSchema).min(0).max(16),
  })
  .strict();
export const coreSchema = z
  .object({
    enabled: z.boolean(),
    colour: z.string().regex(new RegExp('^#[0-9a-fA-F]{6}$')),
    count: z.number().int().gte(0).lte(10000),
    radius: z.number().gte(0).lte(4),
    flash: z.number().gte(0).lte(10),
    flash_on: z.boolean(),
    ring: z.boolean(),
  })
  .strict();
export const fadeSchema = z
  .object({
    white_hot: z.number().gte(0).lte(1),
    ember_at: z.number().gte(0).lte(1),
    fade_at: z.number().gte(0).lte(1),
    prime_s: z.number().gte(0).lte(10),
  })
  .strict();
export const breakSchema = z
  .object({
    at_s: z.number().gte(0).lte(120),
    core: coreSchema,
    fade: fadeSchema,
    layers: z.array(layerSchema).min(1).max(32),
  })
  .strict();
export const launchSchema = z
  .object({
    height_m: z.number().gte(0).lte(1000),
    time_s: z.number().gte(0.001).lte(120),
    tilt_deg: z.number().gte(-85).lte(85),
    tail: z.enum([
      'gold',
      'silver',
      'glitter',
      'comet',
      'crackle',
      'whistle',
      'heli',
      'rocket',
      'tiger',
      'willow',
      'strobe',
      'brocade',
      'dark',
      'flowers',
    ]),
    sparks: z.number().int().gte(0).lte(10000),
    spread: z.number().gte(0).lte(20),
    smoke: z.number().gte(0).lte(4),
  })
  .strict();
export const adjustmentsSchema = z
  .record(z.number().int().gte(-3).lte(3))
  .refine(
    (value) =>
      Object.keys(value).every((key) =>
        new RegExp(
          '^(launch\\.(height|tail|climb)|break\\.(flash|core_ring)|ground\\.(height|count|fan|climb|star_size|spin|duration|density|spray)|layer\\.[A-Za-z0-9][A-Za-z0-9_-]*\\.(size|stars|brightness|burn|droop|spread|star_size|trail\\.(length|density|spray|glitter)|modifier\\.(amount|timing)))$',
        ).test(key),
      ),
    { message: 'Unknown adjustment key' },
  );
export const soundSchema = z
  .object({
    lift: z.number().gte(0).lte(1),
    break: z.number().gte(0).lte(1),
    crackle: z.number().gte(0).lte(1),
    whistle: z.number().gte(0).lte(1),
  })
  .strict();
export const splitSchema = z
  .object({
    count: z.number().int().gte(1).lte(64),
    distance_m: z.number().gte(0.001).lte(500),
    life_s: z.number().gte(0.001).lte(30),
  })
  .strict();
export const cometsSchema = z
  .object({
    count: z.number().int().gte(1).lte(500),
    pattern: z.enum(['straight', 'fan', 'random', 'sequence', 'sweep']),
    spread_deg: z.number().gte(0).lte(180),
    height_m: z.number().gte(0.001).lte(1000),
    time_s: z.number().gte(0.001).lte(120),
    colour: colourSchema,
    trail: z.union([z.enum(['house', 'star']), hexColourSchema]),
    size: z.number().gte(0).lte(10),
    sparks: z.number().int().gte(0).lte(10000),
    tail_life_s: z.number().gte(0.001).lte(30),
    glitter: z.number().gte(0).lte(1),
    gap_s: z.number().gte(0.001).lte(120),
    spin_rad_s: z.number().gte(-500).lte(500),
    spin_radius_m: z.number().gte(0).lte(100),
    pop: z.boolean(),
    split: z.union([splitSchema, z.null()]),
    halo: z.number().gte(0).lte(4),
    whistle: z.boolean(),
  })
  .strict();
export const fountainSchema = z
  .object({
    duration_s: z.number().gte(0.001).lte(120),
    rate_per_s: z.number().gte(0).lte(20000),
    speed_m_s: z.number().gte(0).lte(200),
    cone: z.number().gte(0).lte(4),
    colour: hexColourSchema,
    life_s: z.number().gte(0.001).lte(30),
    emitters: z.number().int().gte(1).lte(500),
    spacing_m: z.number().gte(0.001).lte(100),
    height_m: z.number().gte(0).lte(1000),
    direction: directionSchema,
    streak: z.number().int().gte(0).lte(16),
    gravity_m_s2: z.number().gte(-40).lte(100),
    drag_per_s: z.number().gte(0.001).lte(30),
    size: z.number().gte(0).lte(10),
    flicker: z.number().gte(0).lte(1),
    glitter: z.number().gte(0).lte(1),
    fork: z.number().gte(0).lte(1),
    glow: z.number().gte(0).lte(20),
    glow_alpha: z.number().gte(0).lte(4),
  })
  .strict();
export const tourbillonSchema = z
  .object({
    height_m: z.number().gte(0.001).lte(1000),
    time_s: z.number().gte(0.001).lte(120),
    radius_m: z.number().gte(0).lte(100),
    spin_rad_s: z.number().gte(-500).lte(500),
    count: z.number().int().gte(1).lte(500),
    sparks: z.number().int().gte(0).lte(10000),
  })
  .strict();
export const wheelSchema = z
  .object({
    radius_m: z.number().gte(0).lte(100),
    height_m: z.number().gte(0).lte(1000),
    spin_hz: z.number().gte(-100).lte(100),
    drivers: z.number().int().gte(1).lte(100),
    duration_s: z.number().gte(0.001).lte(120),
    colour: hexColourSchema,
    sparks: z.number().int().gte(0).lte(10000),
    glitter: z.number().gte(0).lte(1),
  })
  .strict();
export const spinnerSchema = z
  .object({
    count: z.number().int().gte(1).lte(500),
    duration_s: z.number().gte(0.001).lte(120),
    spin_rad_s: z.number().gte(-500).lte(500),
    wander_m: z.number().gte(0).lte(100),
    sparks: z.number().int().gte(0).lte(10000),
    colours: z.array(hexColourSchema).min(1).max(16),
  })
  .strict();
export const designSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('shell'),
      adjustments: adjustmentsSchema.optional(),
      launch: launchSchema,
      breaks: z.array(breakSchema).min(1).max(64),
      ground: z.null(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('mine'),
      adjustments: adjustmentsSchema.optional(),
      launch: launchSchema,
      breaks: z.array(breakSchema).min(1).max(64),
      ground: z.null(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('rocket'),
      adjustments: adjustmentsSchema.optional(),
      launch: launchSchema,
      breaks: z.array(breakSchema).min(1).max(64),
      ground: z.null(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('comet'),
      adjustments: adjustmentsSchema.optional(),
      launch: z.null(),
      breaks: z.array(breakSchema).min(0).max(0),
      ground: z.object({ kind: z.literal('comet'), comets: cometsSchema }).strict(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('candle'),
      adjustments: adjustmentsSchema.optional(),
      launch: z.null(),
      breaks: z.array(breakSchema).min(0).max(0),
      ground: z.object({ kind: z.literal('candle'), comets: cometsSchema }).strict(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('fountain'),
      adjustments: adjustmentsSchema.optional(),
      launch: z.null(),
      breaks: z.array(breakSchema).min(0).max(0),
      ground: z.object({ kind: z.literal('fountain'), fountain: fountainSchema }).strict(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('tourbillon'),
      adjustments: adjustmentsSchema.optional(),
      launch: z.null(),
      breaks: z.array(breakSchema).min(0).max(0),
      ground: z.object({ kind: z.literal('tourbillon'), tourbillon: tourbillonSchema }).strict(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('wheel'),
      adjustments: adjustmentsSchema.optional(),
      launch: z.null(),
      breaks: z.array(breakSchema).min(0).max(0),
      ground: z.object({ kind: z.literal('wheel'), wheel: wheelSchema }).strict(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
  z
    .object({
      kind: z.literal('spinner'),
      adjustments: adjustmentsSchema.optional(),
      launch: z.null(),
      breaks: z.array(breakSchema).min(0).max(0),
      ground: z.object({ kind: z.literal('spinner'), spinner: spinnerSchema }).strict(),
      sound: soundSchema,
      seed: z.number().int().gte(0).lte(4294967295),
    })
    .strict(),
]);
export type Design = z.infer<typeof designSchema>;
export type HexColour = z.infer<typeof hexColourSchema>;
export type VectorM = z.infer<typeof vectorMSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type ColourValue = z.infer<typeof colourValueSchema>;
export type ColourStop = z.infer<typeof colourStopSchema>;
export type Colour = z.infer<typeof colourSchema>;
export type BrightnessStop = z.infer<typeof brightnessStopSchema>;
export type Brightness = z.infer<typeof brightnessSchema>;
export type Head = z.infer<typeof headSchema>;
export type Trail = z.infer<typeof trailSchema>;
export type Modifier = z.infer<typeof modifierSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Core = z.infer<typeof coreSchema>;
export type Fade = z.infer<typeof fadeSchema>;
export type Break = z.infer<typeof breakSchema>;
export type Launch = z.infer<typeof launchSchema>;
export type Adjustments = z.infer<typeof adjustmentsSchema>;
export type Sound = z.infer<typeof soundSchema>;
export type Split = z.infer<typeof splitSchema>;
export type Comets = z.infer<typeof cometsSchema>;
export type Fountain = z.infer<typeof fountainSchema>;
export type Tourbillon = z.infer<typeof tourbillonSchema>;
export type Wheel = z.infer<typeof wheelSchema>;
export type Spinner = z.infer<typeof spinnerSchema>;
