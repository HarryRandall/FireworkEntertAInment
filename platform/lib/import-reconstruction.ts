import { z } from 'zod';
import {
  FireworkDesignSchema,
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  normaliseBurstTrailStops,
  scaleDesignForCaliber,
  type FireworkDesign,
  type FireworkGeometry,
} from './fireworks/design';
import {
  DEFAULT_FIREWORK_SPEC,
  FireworkSpecSchema,
  type FireworkSpec,
  type ShellType,
} from './fireworks/spec';
import { FIREWORK_EFFECT_CATALOGUE } from './fireworks/effect-catalogue';
import type { ReplayCue } from './show-domain';
import { quantiseFireworksEngineTimeSeconds } from './fireworks/import-renderer-contract';

const MAX_RECONSTRUCTION_SECONDS = 60;
const MAX_RECONSTRUCTION_DESIGNS = 64;
const MAX_RECONSTRUCTION_SHOTS = 500;
const MAX_RECONSTRUCTION_SEED = 2_147_483_647;
const MAX_RECONSTRUCTION_POSITION = 1_000;

export const IMPORT_RECONSTRUCTION_VALIDATOR_VERSION = 'showcrafter.firework-design.v1';

/** Manual database effects that are intentionally outside the generated base catalogue. */
export const IMPORT_RECONSTRUCTION_MANUAL_EFFECT_SLUGS = [
  'heart-shell',
  'outlined-star-shell',
] as const;

export const IMPORT_RECONSTRUCTION_EFFECT_SLUGS = [
  ...FIREWORK_EFFECT_CATALOGUE.map((effect) => effect.slug),
  ...IMPORT_RECONSTRUCTION_MANUAL_EFFECT_SLUGS,
];
const IMPORT_RECONSTRUCTION_EFFECT_SLUG_SET = new Set(IMPORT_RECONSTRUCTION_EFFECT_SLUGS);

const EffectSlugSchema = z
  .string()
  .refine((value) => IMPORT_RECONSTRUCTION_EFFECT_SLUG_SET.has(value), 'Unknown base-effect slug.');

const CanonicalHexColourSchema = z.string().regex(/^#[0-9a-f]{6}$/);
const CanonicalColourPaletteSchema = z
  .array(CanonicalHexColourSchema)
  .max(12)
  .refine((colours) => new Set(colours).size === colours.length, 'Colour palette must be unique.');

const PositionSchema = z
  .object({
    x: z
      .number()
      .finite()
      .min(-MAX_RECONSTRUCTION_POSITION)
      .max(MAX_RECONSTRUCTION_POSITION)
      .default(0),
    y: z
      .number()
      .finite()
      .min(-MAX_RECONSTRUCTION_POSITION)
      .max(MAX_RECONSTRUCTION_POSITION)
      .default(0),
    z: z
      .number()
      .finite()
      .min(-MAX_RECONSTRUCTION_POSITION)
      .max(MAX_RECONSTRUCTION_POSITION)
      .default(0),
  })
  .strict()
  .default({ x: 0, y: 0, z: 0 });

const ObservedEventSchema = z
  .object({
    timeSeconds: z.number().finite().min(0).max(MAX_RECONSTRUCTION_SECONDS),
    type: z.string().trim().min(1).max(80),
    confidence: z.number().finite().min(0).max(1),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const ReconstructionObservationsSchema = z
  .object({
    observedEvents: z.array(ObservedEventSchema).max(1_000).default([]),
    fieldConfidence: z.record(z.string(), z.number().finite().min(0).max(1)).default({}),
    unknowns: z.array(z.string().trim().min(1).max(500)).max(200).default([]),
  })
  .strict()
  .default({ observedEvents: [], fieldConfidence: {}, unknowns: [] });

const ReconstructionDesignInputSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    effectSlug: EffectSlugSchema,
    label: z.string().trim().min(1).max(180).optional(),
    durationSeconds: z.number().finite().min(0.1).max(MAX_RECONSTRUCTION_SECONDS),
    heightMeters: z.number().finite().min(0).max(220).nullable(),
    caliber: z.string().trim().min(1).max(40).nullable(),
    confidence: z.number().finite().min(0).max(1),
    colorPalette: CanonicalColourPaletteSchema,
    design: z.unknown(),
  })
  .strict();

const ReconstructionShotInputSchema = z
  .object({
    designKey: z.string().trim().min(1).max(64),
    timeOffsetSeconds: z.number().finite().min(0).max(MAX_RECONSTRUCTION_SECONDS),
    sourceTimeOffsetSeconds: z.number().finite().min(0).max(MAX_RECONSTRUCTION_SECONDS).optional(),
    observedBurstTimeSeconds: z.number().finite().min(0).max(MAX_RECONSTRUCTION_SECONDS).optional(),
    observedFadeEndSeconds: z.number().finite().min(0).max(MAX_RECONSTRUCTION_SECONDS).optional(),
    position: PositionSchema,
    launchPositionIndex: z.number().int().min(0).max(2).default(0),
    panDegrees: z.number().int().min(-30).max(30).default(0),
    tiltDegrees: z.number().int().min(-50).max(50).default(0),
    seed: z.number().int().min(0).max(MAX_RECONSTRUCTION_SEED).optional(),
    scale: z.number().finite().min(0.2).max(2).default(1),
  })
  .strict();

const ImportReconstructionInputSchema = z
  .object({
    version: z.literal(1),
    source: z.literal('video_inferred').default('video_inferred'),
    name: z.string().trim().min(1).max(180),
    description: z.string().trim().max(1_200).nullable().default(null),
    durationSeconds: z.number().finite().min(0.1).max(MAX_RECONSTRUCTION_SECONDS),
    heightMeters: z.number().finite().min(0).max(220).nullable().default(null),
    caliber: z.string().trim().min(1).max(40).nullable().default(null),
    confidence: z.number().finite().min(0).max(1),
    designs: z.array(ReconstructionDesignInputSchema).min(1).max(MAX_RECONSTRUCTION_DESIGNS),
    shots: z.array(ReconstructionShotInputSchema).min(1).max(MAX_RECONSTRUCTION_SHOTS),
    observations: ReconstructionObservationsSchema,
  })
  .strict();

const LegacyImportedFireworkSpecSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    description: z.string().trim().max(1_200).nullable().optional(),
    durationSeconds: z.number().finite().min(0.1).max(MAX_RECONSTRUCTION_SECONDS),
    heightMeters: z.number().finite().min(0).max(220).nullable().optional(),
    caliber: z.string().trim().min(1).max(40).nullable().optional(),
    confidence: z.number().finite().min(0).max(1).default(0.5),
    spec: FireworkSpecSchema,
    fieldConfidence: z.record(z.string(), z.number().finite().min(0).max(1)).optional(),
  })
  .passthrough();

type ReconstructionInput = z.infer<typeof ImportReconstructionInputSchema>;
type ReconstructionShotInput = z.infer<typeof ReconstructionShotInputSchema>;

export type ImportReconstructionIssue = {
  path: Array<string | number>;
  message: string;
};

export type ImportReconstructionDesign = {
  key: string;
  effectSlug: string;
  label?: string;
  durationSeconds: number;
  heightMeters: number | null;
  caliber: string | null;
  confidence: number;
  colorPalette: string[];
  design: FireworkDesign;
};

export type ImportReconstructionShot = Omit<ReconstructionShotInput, 'seed'> & {
  seed: number;
};

export type ImportReconstructionPlan = Omit<ReconstructionInput, 'designs' | 'shots'> & {
  designs: ImportReconstructionDesign[];
  shots: ImportReconstructionShot[];
};

export type ImportReconstructionParseResult =
  | { success: true; data: ImportReconstructionPlan }
  | { success: false; issues: ImportReconstructionIssue[] };

export type ImportReconstructionPersistencePlan = {
  reconstructionVersion: 1;
  name: string;
  description: string | null;
  durationSeconds: number;
  heightMeters: number | null;
  productCaliber: string | null;
  confidence: number;
  isMultishot: boolean;
  fireworks: Array<{
    designKey: string;
    effectSlug: string;
    name: string;
    durationSeconds: number;
    heightMeters: number | null;
    confidence: number;
    baseEffectSnapshot: Record<string, unknown>;
    renderOverridesJson: FireworkDesign;
    variantJson: Record<string, unknown>;
    primaryColor: string | null;
    secondaryColor: string | null;
    colorPalette: string[];
    caliber: string;
    metadata: Record<string, unknown>;
  }>;
  shots: Array<{
    sequenceIndex: number;
    designKey: string;
    timeOffsetSeconds: number;
    panDegrees: number;
    tiltDegrees: number;
    positionOverrideJson: { x: number; y: number; z: number };
    launchPositionIndex: number;
    caliber: string;
    seedOverride: number;
    scale: number;
    metadata: Record<string, unknown>;
  }>;
  catalogueMetadata: Record<string, unknown>;
};

export class ImportReconstructionValidationError extends Error {
  readonly issues: ImportReconstructionIssue[];

  constructor(issues: ImportReconstructionIssue[]) {
    super(
      issues.length === 1
        ? issues[0].message
        : `Import reconstruction is invalid in ${issues.length} places.`,
    );
    this.name = 'ImportReconstructionValidationError';
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: unknown, key: string): boolean {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function zodIssues(
  issues: readonly z.core.$ZodIssue[],
  prefix: Array<string | number> = [],
): ImportReconstructionIssue[] {
  return issues.map((issue) => ({
    path: [
      ...prefix,
      ...issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
    ],
    message: issue.message,
  }));
}

function canonicalValue(value: unknown): string {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}

/** Reject values Zod would otherwise strip, coerce, clamp, round, or reorder. */
function findNonCanonicalDesignValues(
  input: unknown,
  parsed: unknown,
  path: Array<string | number>,
  issues: ImportReconstructionIssue[],
): void {
  if (Array.isArray(input)) {
    if (!Array.isArray(parsed)) {
      issues.push({ path, message: 'Expected an array.' });
      return;
    }
    if (input.length !== parsed.length) {
      issues.push({ path, message: 'Array length was changed by renderer validation.' });
      return;
    }
    input.forEach((value, index) => {
      findNonCanonicalDesignValues(value, parsed[index], [...path, index], issues);
    });
    return;
  }

  if (isRecord(input)) {
    if (!isRecord(parsed)) {
      issues.push({ path, message: 'Expected an object.' });
      return;
    }
    for (const [key, value] of Object.entries(input)) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
        issues.push({ path: [...path, key], message: 'Unknown renderer field.' });
        continue;
      }
      findNonCanonicalDesignValues(value, parsed[key], [...path, key], issues);
    }
    return;
  }

  if (!Object.is(input, parsed)) {
    issues.push({
      path,
      message: `Value must already be canonical; renderer validation would change it to ${canonicalValue(parsed)}.`,
    });
  }
}

function canonicaliseStops(
  stops: FireworkDesign['burstTrail']['stops'],
  path: Array<string | number>,
  issues: ImportReconstructionIssue[],
  suppliedByReconstruction: boolean,
): FireworkDesign['burstTrail']['stops'] {
  const normalised = normaliseBurstTrailStops(stops);
  if (suppliedByReconstruction && JSON.stringify(stops) !== JSON.stringify(normalised)) {
    issues.push({
      path,
      message: 'Trail stops must be ordered, unique, and already use canonical values.',
    });
  }
  return normalised;
}

function parseStrictFireworkDesign(
  input: unknown,
  path: Array<string | number>,
): { design: FireworkDesign | null; issues: ImportReconstructionIssue[] } {
  const parsed = FireworkDesignSchema.safeParse(input);
  if (!parsed.success) return { design: null, issues: zodIssues(parsed.error.issues, path) };

  const issues: ImportReconstructionIssue[] = [];
  findNonCanonicalDesignValues(input, parsed.data, path, issues);

  const inputStars = isRecord(input) && isRecord(input.stars) ? input.stars : null;
  const inputOuter = inputStars && isRecord(inputStars.outer) ? inputStars.outer : null;
  const inputCore = inputStars && isRecord(inputStars.core) ? inputStars.core : null;
  const inputOuterTrail =
    inputOuter && isRecord(inputOuter.burstTrail) ? inputOuter.burstTrail : null;
  const inputCoreTrail = inputCore && isRecord(inputCore.burstTrail) ? inputCore.burstTrail : null;

  const outerStops = canonicaliseStops(
    parsed.data.stars.outer.burstTrail.stops,
    [...path, 'stars', 'outer', 'burstTrail', 'stops'],
    issues,
    hasOwn(inputOuterTrail, 'stops'),
  );
  const coreStops = canonicaliseStops(
    parsed.data.stars.core.burstTrail.stops,
    [...path, 'stars', 'core', 'burstTrail', 'stops'],
    issues,
    hasOwn(inputCoreTrail, 'stops'),
  );

  if (hasOwn(input, 'size') && parsed.data.size !== parsed.data.stars.outer.count) {
    issues.push({
      path: [...path, 'size'],
      message: 'Top-level size must match stars.outer.count.',
    });
  }
  if (
    hasOwn(input, 'burst') &&
    JSON.stringify(parsed.data.burst) !== JSON.stringify(parsed.data.stars.outer.burst)
  ) {
    issues.push({
      path: [...path, 'burst'],
      message: 'Top-level burst must match stars.outer.burst.',
    });
  }
  if (
    hasOwn(input, 'burstTrail') &&
    JSON.stringify(parsed.data.burstTrail) !== JSON.stringify(parsed.data.stars.outer.burstTrail)
  ) {
    issues.push({
      path: [...path, 'burstTrail'],
      message: 'Top-level burstTrail must match stars.outer.burstTrail.',
    });
  }

  if (issues.length) return { design: null, issues };

  const outer = {
    ...parsed.data.stars.outer,
    burstTrail: { ...parsed.data.stars.outer.burstTrail, stops: outerStops },
  };
  const core = {
    ...parsed.data.stars.core,
    burstTrail: { ...parsed.data.stars.core.burstTrail, stops: coreStops },
  };
  const design: FireworkDesign = {
    ...parsed.data,
    geometry: parsed.data.geometry === 'pistil' ? 'sphere' : parsed.data.geometry,
    size: outer.count,
    burst: outer.burst,
    burstTrail: outer.burstTrail,
    stars: { outer, core },
  };
  return { design, issues: [] };
}

export function parseImportReconstruction(input: unknown): ImportReconstructionParseResult {
  const envelope = ImportReconstructionInputSchema.safeParse(input);
  if (!envelope.success) return { success: false, issues: zodIssues(envelope.error.issues) };

  const issues: ImportReconstructionIssue[] = [];
  const designs: ImportReconstructionDesign[] = [];
  const designKeys = new Set<string>();

  envelope.data.designs.forEach((entry, index) => {
    if (designKeys.has(entry.key)) {
      issues.push({
        path: ['designs', index, 'key'],
        message: `Duplicate design key '${entry.key}'.`,
      });
      return;
    }
    designKeys.add(entry.key);
    const parsed = parseStrictFireworkDesign(entry.design, ['designs', index, 'design']);
    issues.push(...parsed.issues);
    if (parsed.design) {
      designs.push({
        key: entry.key,
        effectSlug: entry.effectSlug,
        label: entry.label,
        durationSeconds: entry.durationSeconds,
        heightMeters: entry.heightMeters,
        caliber: entry.caliber,
        confidence: entry.confidence,
        colorPalette: entry.colorPalette,
        design: parsed.design,
      });
    }
  });

  const usedDesignKeys = new Set<string>();
  const parsedDesignByKey = new Map(designs.map((design) => [design.key, design]));

  const shots: ImportReconstructionShot[] = envelope.data.shots.map((shot, index) => {
    if (!designKeys.has(shot.designKey)) {
      issues.push({
        path: ['shots', index, 'designKey'],
        message: `Unknown design key '${shot.designKey}'.`,
      });
    } else {
      usedDesignKeys.add(shot.designKey);
    }
    if (shot.timeOffsetSeconds > envelope.data.durationSeconds) {
      issues.push({
        path: ['shots', index, 'timeOffsetSeconds'],
        message: 'Shot starts after the reconstructed product duration.',
      });
    }
    const designEntry = parsedDesignByKey.get(shot.designKey);
    const designDuration = designEntry?.durationSeconds;
    if (
      designDuration !== undefined &&
      shot.timeOffsetSeconds + designDuration > envelope.data.durationSeconds + 0.001
    ) {
      issues.push({
        path: ['shots', index, 'timeOffsetSeconds'],
        message: 'Shot and referenced design extend beyond the reconstructed product duration.',
      });
    }
    if (designEntry) {
      const sourceIndex = envelope.data.designs.findIndex(
        (design) => design.key === designEntry.key,
      );
      const rendererDuration = estimateDesignDurationSeconds(designEntry.design, shot.panDegrees);
      if (designEntry.durationSeconds + 0.001 < rendererDuration) {
        issues.push({
          path: ['designs', sourceIndex, 'durationSeconds'],
          message: `Design duration must cover the renderer's ${rendererDuration.toFixed(3)} second visible lifetime at ${shot.panDegrees} degrees pan.`,
        });
      }
      const scaledCaliber = caliberForScale(shot.scale, designEntry.caliber);
      const scaledDuration = estimateDesignDurationSeconds(
        scaleDesignForCaliber(designEntry.design, scaledCaliber),
        shot.panDegrees,
      );
      if (shot.timeOffsetSeconds + scaledDuration > envelope.data.durationSeconds + 0.001) {
        issues.push({
          path: ['shots', index, 'timeOffsetSeconds'],
          message: `Scaled renderer shot extends beyond the product duration by ${(shot.timeOffsetSeconds + scaledDuration - envelope.data.durationSeconds).toFixed(3)} seconds.`,
        });
      }
    }
    if (
      shot.observedBurstTimeSeconds !== undefined &&
      shot.observedBurstTimeSeconds < shot.timeOffsetSeconds
    ) {
      issues.push({
        path: ['shots', index, 'observedBurstTimeSeconds'],
        message: 'Observed burst time cannot precede the launch.',
      });
    }
    if (
      shot.observedFadeEndSeconds !== undefined &&
      shot.observedBurstTimeSeconds !== undefined &&
      shot.observedFadeEndSeconds < shot.observedBurstTimeSeconds
    ) {
      issues.push({
        path: ['shots', index, 'observedFadeEndSeconds'],
        message: 'Observed fade end cannot precede the burst.',
      });
    }
    if (
      shot.observedFadeEndSeconds !== undefined &&
      shot.observedFadeEndSeconds > envelope.data.durationSeconds
    ) {
      issues.push({
        path: ['shots', index, 'observedFadeEndSeconds'],
        message: 'Observed fade end exceeds the reconstructed product duration.',
      });
    }
    return { ...shot, seed: shot.seed ?? index * 101 };
  });

  envelope.data.designs.forEach((entry, index) => {
    if (!usedDesignKeys.has(entry.key)) {
      issues.push({
        path: ['designs', index, 'key'],
        message: `Design key '${entry.key}' is not used by any shot.`,
      });
    }
  });

  if (issues.length) return { success: false, issues };
  return {
    success: true,
    data: { ...envelope.data, designs, shots },
  };
}

export function parseImportReconstructionOrThrow(input: unknown): ImportReconstructionPlan {
  const parsed = parseImportReconstruction(input);
  if (parsed.success === false) throw new ImportReconstructionValidationError(parsed.issues);
  return parsed.data;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function atomicSpecForLegacyShot(
  spec: FireworkSpec,
  shot: NonNullable<FireworkSpec['shots']>[number],
): FireworkSpec {
  const color = shot.color ?? shot.colorPalette?.[0];
  return {
    ...spec,
    shots: undefined,
    ...(color ? { color, outerColor: color } : {}),
    ...(shot.colorPalette?.length ? { colorPalette: shot.colorPalette } : {}),
    ...(shot.pistilColor ? { pistil: true, pistilColor: shot.pistilColor } : {}),
    ...(shot.tailColor ? { tailColor: shot.tailColor } : {}),
  };
}

function legacyPrimaryColor(spec: FireworkSpec, shotColor?: string): string | null {
  if (shotColor) return shotColor;
  if (spec.outerColor) return spec.outerColor;
  return typeof spec.color === 'string' && /^#[0-9a-f]{6}$/i.test(spec.color) ? spec.color : null;
}

/**
 * Existing V3 outputs first pass through `ImportedFireworkSpecSchema`. This
 * adapter preserves their shots while making the unavoidable legacy loss
 * explicit in observations, rather than pretending they are native V1 plans.
 */
export function adaptLegacyImportedFireworkSpec(input: unknown): ImportReconstructionParseResult {
  const legacy = LegacyImportedFireworkSpecSchema.safeParse(input);
  if (!legacy.success) return { success: false, issues: zodIssues(legacy.error.issues) };

  const sourceShots = legacy.data.spec.shots?.length ? legacy.data.spec.shots : [null];
  const designs: Array<{
    key: string;
    effectSlug: string;
    label: string;
    durationSeconds: number;
    heightMeters: number | null;
    caliber: string | null;
    confidence: number;
    colorPalette: string[];
    design: FireworkDesign;
  }> = [];
  const designKeyByJson = new Map<string, string>();
  const shots: Array<Record<string, unknown>> = [];
  let adaptedDurationSeconds = legacy.data.durationSeconds;

  sourceShots.forEach((shot, index) => {
    const atomicSpec = shot ? atomicSpecForLegacyShot(legacy.data.spec, shot) : legacy.data.spec;
    const palette = shot?.colorPalette ?? atomicSpec.colorPalette;
    const primaryColor = legacyPrimaryColor(atomicSpec, shot?.color ?? palette?.[0]);
    const compiled = compileFireworkDesign({
      legacySpec: atomicSpec,
      primaryColor,
      colorPalette: palette,
    });
    const colorPalette = [
      ...(palette ?? []),
      ...(primaryColor ? [primaryColor] : []),
      ...collectDesignColours(compiled),
    ]
      .map((colour) => colour.toLowerCase())
      .filter((colour, colourIndex, colours) => colours.indexOf(colour) === colourIndex)
      .slice(0, 12);
    const effectSlug = effectSlugForLegacySpec(atomicSpec, compiled.geometry);
    const heightMeters = shot?.heightMeters ?? legacy.data.heightMeters ?? null;
    const timeOffsetSeconds = clamp(shot?.timeOffsetSeconds ?? 0, 0, legacy.data.durationSeconds);
    const shotScale = clamp(shot?.scale ?? 1, 0.2, 2);
    const designDurationSeconds = estimateDesignDurationSeconds(compiled);
    const scaledDurationSeconds = estimateDesignDurationSeconds(
      scaleDesignForCaliber(compiled, caliberForScale(shotScale, legacy.data.caliber ?? null)),
    );
    adaptedDurationSeconds = Math.max(
      adaptedDurationSeconds,
      timeOffsetSeconds + Math.max(designDurationSeconds, scaledDurationSeconds),
    );
    const encoded = JSON.stringify({
      compiled,
      effectSlug,
      heightMeters,
      caliber: legacy.data.caliber ?? null,
      colorPalette,
    });
    let designKey = designKeyByJson.get(encoded);
    if (!designKey) {
      designKey = `legacy-${designs.length + 1}`;
      designKeyByJson.set(encoded, designKey);
      designs.push({
        key: designKey,
        effectSlug,
        label: legacy.data.name,
        durationSeconds: designDurationSeconds,
        heightMeters,
        caliber: legacy.data.caliber ?? null,
        confidence: legacy.data.confidence,
        colorPalette,
        design: compiled,
      });
    }

    shots.push({
      designKey,
      timeOffsetSeconds,
      sourceTimeOffsetSeconds: timeOffsetSeconds,
      position: {
        x: clamp(shot?.position?.x ?? 0, -MAX_RECONSTRUCTION_POSITION, MAX_RECONSTRUCTION_POSITION),
        y: clamp(shot?.position?.y ?? 0, -MAX_RECONSTRUCTION_POSITION, MAX_RECONSTRUCTION_POSITION),
        z: clamp(shot?.position?.z ?? 0, -MAX_RECONSTRUCTION_POSITION, MAX_RECONSTRUCTION_POSITION),
      },
      launchPositionIndex: 0,
      panDegrees: Math.round(clamp(shot?.panDegrees ?? 0, -30, 30)),
      tiltDegrees: Math.round(clamp(shot?.tiltDegrees ?? 0, -50, 50)),
      seed: Math.abs(Math.trunc(shot?.seedOffset ?? index * 101)) % MAX_RECONSTRUCTION_SEED,
      scale: shotScale,
    });
  });

  return parseImportReconstruction({
    version: 1,
    source: 'video_inferred',
    name: legacy.data.name,
    description: legacy.data.description ?? null,
    durationSeconds: adaptedDurationSeconds,
    heightMeters: legacy.data.heightMeters ?? null,
    caliber: legacy.data.caliber ?? null,
    confidence: legacy.data.confidence,
    designs,
    shots,
    observations: {
      observedEvents: [],
      fieldConfidence: legacy.data.fieldConfidence ?? {},
      unknowns: [
        'This reconstruction used the legacy FireworkEffectSpecV3 adapter and may have lost renderer detail.',
      ],
    },
  });
}

function effectSlugForLegacySpec(spec: FireworkSpec, geometry: FireworkGeometry): string {
  const directAliases: Partial<Record<ShellType, string>> = {
    crysanthemum: 'chrysanthemum',
    chrysanthemum: 'chrysanthemum',
    fallingLeaves: 'willow',
    ghost: 'strobe',
    floral: 'peony',
    tail: 'comet',
  };
  const direct = directAliases[spec.shellType] ?? spec.shellType;
  if (IMPORT_RECONSTRUCTION_EFFECT_SLUG_SET.has(direct)) return direct;
  if (spec.crackle) return 'crackle';
  if (spec.strobe) return 'strobe';
  if (spec.crossette) return 'crossette';
  if (spec.horsetail) return 'horsetail';
  if (spec.ring) return 'ring';

  switch (geometry) {
    case 'crown':
      return 'brocade';
    case 'weeping':
    case 'falling_tail':
      return 'willow';
    case 'ring':
      return 'ring';
    case 'split_cross':
      return 'crossette';
    case 'single_tail':
      return 'comet';
    case 'upward_fan':
      return 'mine';
    case 'pearls':
      return 'pearls';
    case 'fish':
      return 'silverFish';
    case 'waterfall':
      return 'waterfall';
    case 'whirl':
      return 'whirl';
    case 'bowtie':
      return 'bowtie';
    case 'roman_candle':
      return 'roman_candle';
    case 'fountain':
      return 'fountain';
    default:
      return 'peony';
  }
}

function shellTypeForGeometry(geometry: FireworkGeometry): ShellType {
  switch (geometry) {
    case 'crown':
      return 'brocade';
    case 'weeping':
    case 'falling_tail':
      return 'willow';
    case 'ring':
      return 'ring';
    case 'split_cross':
      return 'crossette';
    case 'single_tail':
      return 'comet';
    case 'upward_fan':
      return 'mine';
    case 'roman_candle':
      return 'roman_candle';
    case 'fountain':
      return 'fountain';
    default:
      return 'crysanthemum';
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'video-reconstruction'
  );
}

function rgbToHex(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const channels = [value.r, value.g, value.b];
  if (!channels.every((channel) => typeof channel === 'number' && Number.isFinite(channel))) {
    return null;
  }
  return `#${channels
    .map((channel) =>
      Math.round(clamp(channel as number, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function collectDesignColours(design: FireworkDesign): string[] {
  const colours: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const hex = rgbToHex(value);
    if (!hex || seen.has(hex)) return;
    seen.add(hex);
    colours.push(hex);
  };
  const visit = (value: unknown) => {
    add(value);
    if (Array.isArray(value)) return value.forEach(visit);
    if (isRecord(value)) Object.values(value).forEach(visit);
  };

  add(design.color);
  add(design.secondaryColor);
  visit(design.stars);
  visit(design.brocade);
  visit(design.launch);
  return colours;
}

function removeColourFieldsFromBaseEffect(design: FireworkDesign): Record<string, unknown> {
  const base = JSON.parse(JSON.stringify(design)) as Record<string, unknown>;
  delete base.color;
  delete base.secondaryColor;
  delete base.secondaryColorRatio;

  const stars = isRecord(base.stars) ? base.stars : {};
  for (const layerKey of ['outer', 'core']) {
    const layer = isRecord(stars[layerKey]) ? stars[layerKey] : {};
    delete layer.color;
    delete layer.colourPattern;
    const head = isRecord(layer.head) ? layer.head : {};
    const opening = isRecord(head.opening) ? head.opening : {};
    const closing = isRecord(head.closing) ? head.closing : {};
    delete opening.colour;
    delete closing.colour;
    const trail = isRecord(layer.burstTrail) ? layer.burstTrail : {};
    delete trail.colourMode;
    delete trail.opening;
    delete trail.closing;
  }

  const topLevelTrail = isRecord(base.burstTrail) ? base.burstTrail : {};
  delete topLevelTrail.colourMode;
  delete topLevelTrail.opening;
  delete topLevelTrail.closing;
  const launch = isRecord(base.launch) ? base.launch : {};
  const shell = isRecord(launch.shell) ? launch.shell : {};
  const liftParticles = isRecord(launch.liftParticles) ? launch.liftParticles : {};
  delete shell.colour;
  delete liftParticles.colour;
  const brocade = isRecord(base.brocade) ? base.brocade : {};
  delete brocade.headColors;
  delete brocade.palette;
  return base;
}

function caliberForScale(scale: number, caliber: string | null): string {
  const millimetres = caliber?.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
  const inches = caliber?.match(/^(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["”])$/i);
  const baseline = millimetres ? Number(millimetres[1]) : inches ? Number(inches[1]) * 25.4 : 30;
  return `${Number((baseline * scale).toFixed(2))}mm`;
}

export function reconstructionToReplayCues(
  plan: ImportReconstructionPlan,
  options: { idPrefix?: string } = {},
): ReplayCue[] {
  const idPrefix = options.idPrefix ?? slugify(plan.name);
  const designs = new Map(plan.designs.map((entry) => [entry.key, entry]));

  return plan.shots
    .map((shot, sourceIndex) => ({ shot, sourceIndex }))
    .sort(
      (left, right) =>
        quantiseFireworksEngineTimeSeconds(left.shot.timeOffsetSeconds) -
          quantiseFireworksEngineTimeSeconds(right.shot.timeOffsetSeconds) ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(({ shot, sourceIndex }, cueIndex): ReplayCue => {
      const entry = designs.get(shot.designKey);
      if (!entry) {
        throw new ImportReconstructionValidationError([
          {
            path: ['shots', sourceIndex, 'designKey'],
            message: `Unknown design key '${shot.designKey}'.`,
          },
        ]);
      }
      const colours = entry.colorPalette;
      const shellType = shellTypeForGeometry(entry.design.geometry);
      const specificationId = `${idPrefix}-${entry.key}`;
      const cueId = `${idPrefix}-shot-${sourceIndex + 1}`;
      const spec: FireworkSpec = {
        ...DEFAULT_FIREWORK_SPEC,
        shellType,
        ...(colours[0] ? { color: colours[0], outerColor: colours[0] } : {}),
        ...(colours.length ? { colorPalette: colours } : {}),
      };
      return {
        id: cueId,
        position: cueIndex + 1,
        timeSeconds: quantiseFireworksEngineTimeSeconds(shot.timeOffsetSeconds),
        description: entry.label ?? plan.name,
        productId: specificationId,
        seedOverride: shot.seed,
        launchPositionIndex: shot.launchPositionIndex,
        shotPanDegrees: shot.panDegrees,
        shotTiltDegrees: shot.tiltDegrees,
        shotPositionOverride: shot.position,
        firework: {
          id: specificationId,
          slug: slugify(`${plan.name}-${entry.key}`),
          name: entry.label ?? plan.name,
          description: plan.description,
          sortOrder: cueIndex,
          durationSeconds: entry.durationSeconds,
          heightMeters: entry.heightMeters,
          caliber: caliberForScale(shot.scale, entry.caliber),
          shotCount: 1,
          spec,
          rawSpec: {
            reconstructionVersion: 1,
            designKey: entry.key,
            effectSlug: entry.effectSlug,
            scale: shot.scale,
            observedBurstTimeSeconds: shot.observedBurstTimeSeconds ?? null,
            observedFadeEndSeconds: shot.observedFadeEndSeconds ?? null,
          },
          renderDesign: entry.design,
          baseEffect: null,
          variant: null,
        },
      };
    });
}

export function buildImportReconstructionPersistencePlan(
  plan: ImportReconstructionPlan,
): ImportReconstructionPersistencePlan {
  const fireworks = plan.designs.map((entry) => {
    const colours = entry.colorPalette;
    const renderDefaults = removeColourFieldsFromBaseEffect(entry.design);
    const baseEffectSnapshot = canonicaliseEffectModelJson({
      version: 3,
      source: 'video_inferred',
      reconstructionVersion: 1,
      effectSlug: entry.effectSlug,
      geometry: entry.design.geometry,
      trailProfile: entry.design.trailProfile,
      renderDefaults,
    }) as Record<string, unknown>;
    return {
      designKey: entry.key,
      effectSlug: entry.effectSlug,
      name: entry.label ?? plan.name,
      durationSeconds: entry.durationSeconds,
      heightMeters: entry.heightMeters,
      confidence: entry.confidence,
      baseEffectSnapshot,
      renderOverridesJson: entry.design,
      variantJson: {
        reconstructionVersion: 1,
        designKey: entry.key,
        effectSlug: entry.effectSlug,
        source: 'video_inferred',
      },
      primaryColor: colours[0] ?? null,
      secondaryColor: colours[1] ?? null,
      colorPalette: colours,
      caliber: entry.caliber ?? '30mm',
      metadata: {
        reconstructionVersion: 1,
        designKey: entry.key,
        effectSlug: entry.effectSlug,
        confidence: entry.confidence,
        durationSeconds: entry.durationSeconds,
        heightMeters: entry.heightMeters,
      },
    };
  });

  const shots = plan.shots.map((shot, sequenceIndex) => ({
    sequenceIndex,
    designKey: shot.designKey,
    timeOffsetSeconds: quantiseFireworksEngineTimeSeconds(shot.timeOffsetSeconds),
    panDegrees: shot.panDegrees,
    tiltDegrees: shot.tiltDegrees,
    positionOverrideJson: shot.position,
    launchPositionIndex: shot.launchPositionIndex,
    caliber: caliberForScale(
      shot.scale,
      plan.designs.find((entry) => entry.key === shot.designKey)?.caliber ?? null,
    ),
    seedOverride: shot.seed,
    scale: shot.scale,
    metadata: {
      reconstructionVersion: 1,
      seedOverride: shot.seed,
      scale: shot.scale,
      sourceTimeOffsetSeconds: shot.sourceTimeOffsetSeconds ?? shot.timeOffsetSeconds,
      observedBurstTimeSeconds: shot.observedBurstTimeSeconds ?? null,
      observedFadeEndSeconds: shot.observedFadeEndSeconds ?? null,
    },
  }));

  return {
    reconstructionVersion: 1,
    name: plan.name,
    description: plan.description,
    durationSeconds: plan.durationSeconds,
    heightMeters: plan.heightMeters,
    productCaliber: plan.caliber,
    confidence: plan.confidence,
    isMultishot: shots.length > 1,
    fireworks,
    shots,
    catalogueMetadata: {
      source: 'video_import',
      reconstructionVersion: 1,
      confidence: plan.confidence,
      designCount: fireworks.length,
      shotCount: shots.length,
      observations: plan.observations,
    },
  };
}
