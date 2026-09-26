import { z } from 'zod';

/**
 * Shape-specific settings. Only the group matching the design's geometry is
 * read. Star counts and fountain rates belong to the individual star layers;
 * ground emission duration is shared by both layers.
 */
export const GEOMETRY_TUNING_DEFAULTS = {
  ring: {
    wobble: 0.18,
    verticalSquash: 0.96,
    tiltVariation: 1.1,
    lifePercent: 82,
  },
  crown: { lift: 0.55, liftVariation: 0.62, spread: 0.65, spreadVariation: 0.35 },
  weeping: {
    lift: 0.35,
    liftVariation: 0.45,
    spread: 0.65,
    spreadVariation: 0.35,
    lifePercent: 125,
    gravityPercent: 52,
    dragPercent: 58,
  },
  radialArms: {
    arms: 7,
    angleJitter: 0.1,
    armLength: 0.74,
    lift: 0.22,
    liftVariation: 0.44,
    dragPercent: 82,
  },
  fallingTail: {
    spread: 0.28,
    spreadVariation: 0.5,
    sink: 0.05,
    sinkVariation: 0.42,
    lifePercent: 125,
    gravityPercent: 45,
    dragPercent: 58,
  },
  pearls: {
    spread: 0.45,
    spreadVariation: 0.28,
    lift: 0.5,
    liftVariation: 0.35,
    lifePercent: 62,
    gravityPercent: 115,
    dragPercent: 135,
  },
  fragmentCloud: { speedBase: 0.72, speedVariation: 0.78 },
  heart: {
    scaleX: 1,
    scaleY: 1,
    depthScale: 0.08,
    outlineJitter: 0.035,
    tiltVariation: 0.45,
    rotationDegrees: 0,
  },
  fivePointStar: {
    points: 5,
    innerRadius: 0.44,
    scaleX: 1,
    scaleY: 1,
    depthScale: 0.08,
    outlineJitter: 0.035,
    tiltVariation: 0.45,
    rotationDegrees: -90,
  },
  bowtie: {
    fanAngleDegrees: 111.6,
    verticalScale: 0.34,
    depthScale: 0.16,
    lengthBase: 0.82,
    lengthVariation: 0.22,
  },
  fish: {
    verticalScale: 0.25,
    lifeBaseSeconds: 0.8,
    lifeVariationSeconds: 1.8,
    wiggleStrength: 1.8,
    wiggleRate: 14,
    wiggleRateCross: 17,
    gravityPercent: 55,
    dragPercent: 55,
    headSizePercent: 65,
    trailLifePercent: 60,
  },
  waterfall: {
    width: 220,
    scatterX: 28,
    scatterZ: 24,
    dropStart: 58,
    fallSpeed: 1,
    fallSpeedVariation: 1.45,
    sideDrift: 0.28,
    depthDrift: 0.2,
    lifePercent: 135,
    gravityBase: -0.32,
    gravityVariation: 0.34,
    dragPercent: 28,
    headSizePercent: 75,
  },
  whirl: {
    verticalBias: -0.15,
    spinStrength: 2.4,
    spinRate: 18,
    lifeBaseSeconds: 1,
    lifeVariationSeconds: 2,
    gravityPercent: 70,
    dragPercent: 62,
    headSizePercent: 80,
    trailLifePercent: 70,
  },
  singleTail: {
    inheritPercent: 35,
    driftPercent: 12,
    riseFactor: 0.55,
    pushFactor: 0.35,
    lifePercent: 90,
    headSizePercent: 60,
    trailLifePercent: 125,
  },
  upwardFan: {
    spreadAngleDegrees: 165.6,
    fanBase: 0.45,
    fanVariation: 0.8,
    spawnScatter: 34,
    riseBase: 24,
    riseVariation: 22,
    riseSpeed: 1.2,
    riseSpeedVariation: 0.85,
    depthScale: 0.45,
    lifePercent: 72,
    dragPercent: 57.6,
    headSizePercent: 75,
    trailLifePercent: 60,
  },
  romanCandle: {
    durationSeconds: 8,
    spread: 0.55,
    azimuth: 0.4,
    speedBase: 0.95,
    speedVariation: 0.35,
    muzzleScatter: 12,
    lateralScale: 0.28,
    depthScale: 0.22,
    riseBase: 1,
    riseVariation: 0.32,
    lifePercent: 92,
    dragPercent: 68,
    headSizePercent: 92,
    trailLifePercent: 85,
  },
  fountain: {
    durationSeconds: 5.2,
    // Exactly the old 0.85 rad cone so default fountains are unchanged.
    coneAngleDegrees: (0.85 * 180) / Math.PI,
    speedBase: 0.45,
    speedVariation: 0.75,
    spawnScatter: 10,
    lateralScale: 0.55,
    lifePercent: 60,
    dragPercent: 115,
    headSizePercent: 40,
    trailLifePercent: 40,
  },
} as const;

export const percent = (def: number, min = 1, max = 300) =>
  z.coerce.number().min(min).max(max).default(def);

export const GeometryTuningSchema = z
  .object({
    /** Halo hoop: stars break in a flat, randomly tilted circle. */
    ring: z
      .object({
        /** Percentage of the layer's star count used by the ring. */
        /** Out-of-plane jitter so the hoop doesn't read as a razor line. */
        wobble: z.coerce.number().min(0).max(1).default(0.18),
        /** Vertical scale of the hoop; 1 is a perfect circle. */
        verticalSquash: z.coerce.number().min(0.2).max(1.5).default(0.96),
        /** Random tilt range of the hoop plane, in radians. */
        tiltVariation: z.coerce.number().min(0).max(3).default(1.1),
        /** Star life as a percentage of the layer's burst life. */
        lifePercent: percent(82, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.ring),
    /** Palm / pine-tree crowns: stars thrown up and out, then drooping. */
    crown: z
      .object({
        /** Upward throw of each frond. */
        lift: z.coerce.number().min(0).max(2).default(0.55),
        /** Random extra upward throw. */
        liftVariation: z.coerce.number().min(0).max(2).default(0.62),
        /** Sideways reach of the fronds. */
        spread: z.coerce.number().min(0).max(2).default(0.65),
        /** Random extra sideways reach. */
        spreadVariation: z.coerce.number().min(0).max(2).default(0.35),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.crown),
    /** Weeping willow: low throw, long hang, slow fall. */
    weeping: z
      .object({
        lift: z.coerce.number().min(0).max(2).default(0.35),
        liftVariation: z.coerce.number().min(0).max(2).default(0.45),
        spread: z.coerce.number().min(0).max(2).default(0.65),
        spreadVariation: z.coerce.number().min(0).max(2).default(0.35),
        /** Star life as a percentage of the layer's burst life. */
        lifePercent: percent(125, 10, 300),
        /** Gravity strength as a percentage of the layer's burst gravity. */
        gravityPercent: percent(52, 5, 300),
        /** Air resistance as a percentage of the standard star drag. */
        dragPercent: percent(58, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.weeping),
    /** Spider / radial arms: stars grouped into straight spokes. */
    radialArms: z
      .object({
        /** Number of spokes. */
        arms: z.coerce.number().int().min(2).max(24).default(7),
        /** Random angular scatter of each star off its spoke, in radians. */
        angleJitter: z.coerce.number().min(0).max(1).default(0.1),
        /** Base length of each spoke relative to burst speed. */
        armLength: z.coerce.number().min(0.1).max(2).default(0.74),
        lift: z.coerce.number().min(-1).max(2).default(0.22),
        liftVariation: z.coerce.number().min(0).max(2).default(0.44),
        dragPercent: percent(82, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.radialArms),
    /** Horsetail: stars pushed out sideways and immediately sinking. */
    fallingTail: z
      .object({
        spread: z.coerce.number().min(0).max(2).default(0.28),
        spreadVariation: z.coerce.number().min(0).max(2).default(0.5),
        /** Initial downward speed. */
        sink: z.coerce.number().min(0).max(2).default(0.05),
        sinkVariation: z.coerce.number().min(0).max(2).default(0.42),
        lifePercent: percent(125, 10, 300),
        gravityPercent: percent(45, 5, 300),
        dragPercent: percent(58, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fallingTail),
    /** Pearls: a sparse ring of slow, bright individual stars. */
    pearls: z
      .object({
        spread: z.coerce.number().min(0).max(2).default(0.45),
        spreadVariation: z.coerce.number().min(0).max(2).default(0.28),
        lift: z.coerce.number().min(-1).max(2).default(0.5),
        liftVariation: z.coerce.number().min(0).max(2).default(0.35),
        lifePercent: percent(62, 10, 300),
        gravityPercent: percent(115, 5, 300),
        dragPercent: percent(135, 10, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.pearls),
    /** Fragment cloud: an irregular scatter with uneven star speeds. */
    fragmentCloud: z
      .object({
        /** Minimum speed factor applied to each star. */
        speedBase: z.coerce.number().min(0.1).max(2).default(0.72),
        /** Random extra speed on top of the base. */
        speedVariation: z.coerce.number().min(0).max(2).default(0.78),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fragmentCloud),
    /** Heart outline: a planar parametric heart with editable thickness and orientation. */
    heart: z
      .object({
        scaleX: z.coerce.number().min(0.2).max(2.5).default(1),
        scaleY: z.coerce.number().min(0.2).max(2.5).default(1),
        depthScale: z.coerce.number().min(0).max(1).default(0.08),
        outlineJitter: z.coerce.number().min(0).max(0.4).default(0.035),
        tiltVariation: z.coerce.number().min(0).max(3).default(0.45),
        rotationDegrees: z.coerce.number().min(-180).max(180).default(0),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.heart),
    /** Outlined star polygon. Five points by default, with editable point count. */
    fivePointStar: z
      .object({
        points: z.coerce.number().int().min(3).max(12).default(5),
        innerRadius: z.coerce.number().min(0.08).max(0.95).default(0.44),
        scaleX: z.coerce.number().min(0.2).max(2.5).default(1),
        scaleY: z.coerce.number().min(0.2).max(2.5).default(1),
        depthScale: z.coerce.number().min(0).max(1).default(0.08),
        outlineJitter: z.coerce.number().min(0).max(0.4).default(0.035),
        tiltVariation: z.coerce.number().min(0).max(3).default(0.45),
        rotationDegrees: z.coerce.number().min(-180).max(180).default(-90),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fivePointStar),
    /** Bow tie: two opposed fans fired in a flat plane. */
    bowtie: z
      .object({
        /** Total opening angle of each fan, in degrees. */
        fanAngleDegrees: z.coerce.number().min(10).max(180).default(111.6),
        /** Vertical thickness of the fans. */
        verticalScale: z.coerce.number().min(0).max(1.5).default(0.34),
        /** Front-to-back thickness of the fans. */
        depthScale: z.coerce.number().min(0).max(1.5).default(0.16),
        /** Base lobe length relative to burst speed. */
        lengthBase: z.coerce.number().min(0.1).max(2).default(0.82),
        lengthVariation: z.coerce.number().min(0).max(2).default(0.22),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.bowtie),
    /** Darting fish: stars swim away on wiggling paths. */
    fish: z
      .object({
        /** Percentage of the design size used as the swarm count. */
        /** Vertical flattening of the swarm; 1 is a full sphere. */
        verticalScale: z.coerce.number().min(0).max(1.5).default(0.25),
        lifeBaseSeconds: z.coerce.number().min(0.1).max(8).default(0.8),
        lifeVariationSeconds: z.coerce.number().min(0).max(8).default(1.8),
        /** Strength of the swimming force. */
        wiggleStrength: z.coerce.number().min(0).max(8).default(1.8),
        /** Wiggle oscillations per second on the primary axis. */
        wiggleRate: z.coerce.number().min(0).max(40).default(14),
        /** Wiggle oscillations per second on the crossing axis. */
        wiggleRateCross: z.coerce.number().min(0).max(40).default(17),
        gravityPercent: percent(55, 5, 300),
        dragPercent: percent(55, 10, 300),
        /** Star head size as a percentage of the layer's size budget. */
        headSizePercent: percent(65, 5, 200),
        trailLifePercent: percent(60, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fish),
    /** Waterfall: a wide curtain of stars pouring straight down. */
    waterfall: z
      .object({
        /** Curtain width relative to the design size. */
        width: z.coerce.number().min(0).max(1200).default(220),
        /** Random horizontal scatter of each spawn point, in world units. */
        scatterX: z.coerce.number().min(0).max(120).default(28),
        /** Random depth scatter of each spawn point, in world units. */
        scatterZ: z.coerce.number().min(0).max(120).default(24),
        /** How far below the burst point stars may start, in world units. */
        dropStart: z.coerce.number().min(0).max(240).default(58),
        /** Base downward speed. */
        fallSpeed: z.coerce.number().min(0).max(6).default(1),
        fallSpeedVariation: z.coerce.number().min(0).max(6).default(1.45),
        /** Sideways drift while falling. */
        sideDrift: z.coerce.number().min(0).max(2).default(0.28),
        depthDrift: z.coerce.number().min(0).max(2).default(0.2),
        lifePercent: percent(135, 10, 300),
        /** Base gravity while falling (negative pulls down). */
        gravityBase: z.coerce.number().min(-2).max(0).default(-0.32),
        gravityVariation: z.coerce.number().min(0).max(2).default(0.34),
        dragPercent: percent(28, 10, 300),
        headSizePercent: percent(75, 5, 200),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.waterfall),
    /** Whirl: spinning shower with corkscrew arms. */
    whirl: z
      .object({
        /** Minimum number of stars regardless of design size. */
        /** Vertical bias of the initial throw; negative sends more stars down. */
        verticalBias: z.coerce.number().min(-1).max(1).default(-0.15),
        /** Strength of the spiral force. */
        spinStrength: z.coerce.number().min(0).max(10).default(2.4),
        /** Spiral oscillations per second. */
        spinRate: z.coerce.number().min(0).max(40).default(18),
        lifeBaseSeconds: z.coerce.number().min(0.1).max(8).default(1),
        lifeVariationSeconds: z.coerce.number().min(0).max(8).default(2),
        gravityPercent: percent(70, 5, 300),
        dragPercent: percent(62, 10, 300),
        headSizePercent: percent(80, 5, 200),
        trailLifePercent: percent(70, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.whirl),
    /** Comet: one bright tailed head continuing along the trail. */
    singleTail: z
      .object({
        /** How much of the shell's velocity the comet keeps, as a percentage. */
        inheritPercent: percent(35, 0, 100),
        /** Random sideways drift as a percentage of burst speed. */
        driftPercent: percent(12, 0, 100),
        /** Minimum upward speed as a fraction of burst speed. */
        riseFactor: z.coerce.number().min(0).max(2).default(0.55),
        /** Extra upward push added to the inherited rise. */
        pushFactor: z.coerce.number().min(0).max(2).default(0.35),
        lifePercent: percent(90, 10, 300),
        headSizePercent: percent(60, 5, 200),
        trailLifePercent: percent(125, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.singleTail),
    /** Mine: a ground burst fanning stars straight up from the tube. */
    upwardFan: z
      .object({
        /** Percentage of the star count used by the fan. */
        /** Lower bound on the fan count regardless of shell size. */
        /** Total sideways opening angle of the fan, in degrees. */
        spreadAngleDegrees: z.coerce.number().min(10).max(300).default(165.6),
        /** Minimum sideways throw factor. */
        fanBase: z.coerce.number().min(0).max(2).default(0.45),
        fanVariation: z.coerce.number().min(0).max(2).default(0.8),
        /** Random horizontal scatter of each spawn point, in world units. */
        spawnScatter: z.coerce.number().min(0).max(120).default(34),
        /** Base spawn height above the tube, in world units. */
        riseBase: z.coerce.number().min(0).max(120).default(24),
        riseVariation: z.coerce.number().min(0).max(120).default(22),
        /** Base upward speed factor. */
        riseSpeed: z.coerce.number().min(0).max(4).default(1.2),
        riseSpeedVariation: z.coerce.number().min(0).max(4).default(0.85),
        /** Front-to-back thickness of the fan. */
        depthScale: z.coerce.number().min(0).max(1.5).default(0.45),
        lifePercent: percent(72, 10, 300),
        dragPercent: percent(57.6, 10, 300),
        headSizePercent: percent(75, 5, 200),
        trailLifePercent: percent(60, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.upwardFan),
    /** Roman candle: staggered single shots from a ground tube. */
    romanCandle: z
      .object({
        durationSeconds: z.coerce.number().min(0.1).max(30).default(8),
        /** Shots as a percentage of the star count. */
        /** Sequence length as a percentage of the shell life. */
        /** Sideways aim wobble per shot, in radians. */
        spread: z.coerce.number().min(0).max(2).default(0.55),
        /** Front-to-back aim wobble per shot, in radians. */
        azimuth: z.coerce.number().min(0).max(2).default(0.4),
        /** Minimum shot speed factor. */
        speedBase: z.coerce.number().min(0.1).max(3).default(0.95),
        speedVariation: z.coerce.number().min(0).max(3).default(0.35),
        /** Random muzzle scatter of each shot, in world units. */
        muzzleScatter: z.coerce.number().min(0).max(60).default(12),
        /** Sideways speed factor of each shot. */
        lateralScale: z.coerce.number().min(0).max(1.5).default(0.28),
        depthScale: z.coerce.number().min(0).max(1.5).default(0.22),
        /** Base upward speed factor. */
        riseBase: z.coerce.number().min(0).max(4).default(1),
        riseVariation: z.coerce.number().min(0).max(4).default(0.32),
        lifePercent: percent(92, 10, 300),
        dragPercent: percent(68, 10, 300),
        headSizePercent: percent(92, 5, 200),
        trailLifePercent: percent(85, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.romanCandle),
    /** Fountain: a steady ground glitter spray with no mortar burst. */
    fountain: z
      .object({
        durationSeconds: z.coerce.number().min(0.1).max(30).default(5.2),
        /** Spray length as a percentage of the shell life. */
        /** Sparks per second as a percentage of the star count. */
        /** Total opening angle of the spray cone, in degrees. */
        coneAngleDegrees: z.coerce
          .number()
          .min(2)
          .max(180)
          .default(GEOMETRY_TUNING_DEFAULTS.fountain.coneAngleDegrees),
        /** Minimum spark speed factor. */
        speedBase: z.coerce.number().min(0.05).max(3).default(0.45),
        speedVariation: z.coerce.number().min(0).max(3).default(0.75),
        /** Random scatter of each spark's spawn point, in world units. */
        spawnScatter: z.coerce.number().min(0).max(60).default(10),
        /** Sideways speed factor of the spray. */
        lateralScale: z.coerce.number().min(0).max(1.5).default(0.55),
        lifePercent: percent(60, 5, 300),
        dragPercent: percent(115, 10, 300),
        headSizePercent: percent(40, 5, 200),
        trailLifePercent: percent(40, 5, 300),
      })
      .default(GEOMETRY_TUNING_DEFAULTS.fountain),
  })
  .default(GEOMETRY_TUNING_DEFAULTS);

export type FireworkGeometryTuning = z.infer<typeof GeometryTuningSchema>;

export type GeometryTuningGroupKey = keyof FireworkGeometryTuning;
