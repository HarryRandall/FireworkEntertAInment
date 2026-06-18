/**
 * Shared schemas, constants, and helpers for the supplier "import job" flow.
 *
 * Import jobs let suppliers submit firework videos / glossaries / stock CSVs
 * for AI-assisted normalisation into the catalogue. This module hosts:
 *
 * - Storage bucket names and limits (e.g. {@link IMPORT_VIDEO_BUCKET})
 * - The OpenRouter model dropdown options used in the admin UI
 * - Zod schemas for validating spec drafts ({@link ImportedFireworkSpecSchema})
 * - Pure helpers for projecting `import_outputs` rows into a UI-ready shape
 *
 * Imported by both server actions (`app/actions/admin/*`) and server modules
 * (`lib/admin/imports.server.ts`).
 */
import { z } from 'zod';
import type { ReplayCue } from '@/lib/show-domain';
import { compileFireworkDesign } from '@/lib/fireworks/design';
import {
  FIREWORK_COLORS,
  FireworkSpecSchema,
  GLITTER_KINDS,
  SHELL_TYPES,
  type FireworkSpec,
  type GlitterKind,
  type ShellType,
} from '@/lib/fireworks/spec';

export const IMPORT_VIDEO_BUCKET = 'import-videos';
export const MAX_IMPORT_VIDEO_SECONDS = 60;

export const OPENROUTER_MODEL_OPTIONS = [
  {
    value: 'openai/gpt-4.1',
    label: 'OpenAI GPT-4.1',
    description: 'Best default for detailed firework video reconstruction.',
  },
  {
    value: 'openai/gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    description: 'Lower-cost OpenAI fallback for faster review passes.',
  },
] as const;

export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_MODEL_OPTIONS[0].value;

const ImportedFireworkSpecBaseSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  durationSeconds: z.coerce.number().min(0.1).max(MAX_IMPORT_VIDEO_SECONDS),
  heightMeters: z.coerce.number().min(0).max(220).optional().nullable(),
  caliber: z.string().trim().min(1).max(40).optional().nullable(),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  spec: FireworkSpecSchema,
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

export const ImportedFireworkSpecSchema = z.preprocess(
  normalizeImportedFireworkSpecInput,
  ImportedFireworkSpecBaseSchema,
);

export type ImportedFireworkSpec = z.infer<typeof ImportedFireworkSpecSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function textValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

function firstHexColor(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  for (const value of values) {
    const color = hexColor(value);
    if (color) return color;
  }
  return null;
}

function uniqueHexColors(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const nested of uniqueHexColors(...value)) {
        if (seen.has(nested)) continue;
        seen.add(nested);
        colors.push(nested);
      }
      continue;
    }
    const color = hexColor(value);
    if (!color || seen.has(color)) continue;
    seen.add(color);
    colors.push(color);
  }
  return colors;
}

function isWhiteColor(color: string): boolean {
  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  return r > 224 && g > 224 && b > 224;
}

function firstNonWhiteColor(colors: string[]): string | null {
  return colors.find((color) => !isWhiteColor(color)) ?? null;
}

function coerceShellType(value: unknown, fallback: unknown): ShellType {
  const normalized = String(value ?? fallback ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '');
  const aliases: Record<string, ShellType> = {
    chrysanthemum: 'crysanthemum',
    crysanthemum: 'crysanthemum',
    peony: 'crysanthemum',
    ghost: 'ghost',
    strobe: 'strobe',
    palm: 'palm',
    ring: 'ring',
    crossette: 'crossette',
    floral: 'floral',
    flower: 'floral',
    fallingleaves: 'fallingLeaves',
    willow: 'willow',
    crackle: 'crackle',
    horsetail: 'horsetail',
    comet: 'comet',
    mine: 'comet',
    singleshot: 'comet',
    rocket: 'comet',
  };
  const aliased = aliases[normalized];
  if (aliased) return aliased;
  // Match against the canonical list using the normalised form so spaced or
  // differently-cased camelCase types (e.g. "silver fish", "Falling Leaves")
  // still resolve instead of silently collapsing to crysanthemum.
  const direct = SHELL_TYPES.find((shell) => shell.toLowerCase() === normalized);
  return direct ?? 'crysanthemum';
}

function coerceGlitter(value: unknown, fallback: GlitterKind): GlitterKind {
  return GLITTER_KINDS.includes(value as GlitterKind) ? (value as GlitterKind) : fallback;
}

function positionFromShot(value: unknown): { x?: number; y?: number; z?: number } | undefined {
  if (!isRecord(value)) return undefined;
  return {
    x: finiteNumber(value.x) ?? undefined,
    y: finiteNumber(value.y) ?? undefined,
    z: finiteNumber(value.z) ?? undefined,
  };
}

function shotsFromEffectSpec(
  effectSpec: Record<string, unknown>,
  fallbackPalette: string[],
): FireworkSpec['shots'] {
  const directShots = Array.isArray(effectSpec.shots) ? effectSpec.shots : null;
  const shotSequence = isRecord(effectSpec.shotSequence) ? effectSpec.shotSequence : {};
  const sequenceShots = Array.isArray(shotSequence.shots) ? shotSequence.shots : null;
  const sourceShots = directShots ?? sequenceShots;
  if (!sourceShots?.length) return undefined;

  const shots: NonNullable<FireworkSpec['shots']> = [];
  sourceShots.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const shotPalette = uniqueHexColors(
      entry.colorPalette,
      entry.colors,
      entry.color,
      entry.peakColors,
      fallbackPalette,
    );
    shots.push({
      index: Math.round(finiteNumber(entry.index) ?? index),
      timeOffsetSeconds: clamp(
        finiteNumber(entry.timeOffsetSeconds) ?? 0,
        0,
        MAX_IMPORT_VIDEO_SECONDS,
      ),
      position: positionFromShot(entry.position),
      panDegrees: finiteNumber(entry.panDegrees) ?? undefined,
      tiltDegrees: finiteNumber(entry.tiltDegrees) ?? undefined,
      scale: clamp(finiteNumber(entry.scale) ?? 1, 0.2, 2),
      seedOffset: Math.round(finiteNumber(entry.seedOffset) ?? index * 101),
      heightMeters: finiteNumber(entry.heightMeters) ?? undefined,
      liftTimeSeconds: finiteNumber(entry.liftTimeSeconds) ?? undefined,
      color: hexColor(entry.color) ?? shotPalette[0],
      colorPalette: shotPalette.length ? shotPalette : undefined,
      pistilColor: hexColor(entry.pistilColor) ?? undefined,
      tailColor: hexColor(entry.tailColor) ?? undefined,
    });
  });
  return shots.length ? shots : undefined;
}

function trailEffectFromLaunch(
  launch: Record<string, unknown>,
  shell: Record<string, unknown>,
): FireworkSpec['trailEffect'] {
  const text = [
    launch.trailEffect,
    launch.tailType,
    launch.description,
    shell.tailType,
    shell.glitter,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (text.includes('crackle')) return 'crackle';
  if (text.includes('silver')) return 'silver';
  if (text.includes('gold')) return 'gold';
  if (text.includes('streamer') || text.includes('tail') || text.includes('comet'))
    return 'streamer';
  return undefined;
}

function fireworkSpecFromEffectSpec(effectSpec: Record<string, unknown>): FireworkSpec {
  const shell = isRecord(effectSpec.shell) ? effectSpec.shell : {};
  const renderProfile = isRecord(effectSpec.renderProfile) ? effectSpec.renderProfile : {};
  const launch = isRecord(effectSpec.launch) ? effectSpec.launch : {};
  const palette = uniqueHexColors(
    shell.colorPalette,
    effectSpec.colorPalette,
    shell.colors,
    shell.color,
    shell.secondColor,
    shell.pistilColor,
  );
  const shellType = coerceShellType(shell.family, effectSpec.type);
  const innerColor = hexColor(shell.innerColor) ?? hexColor(shell.pistilColor);
  const outerColor =
    hexColor(shell.outerColor) ??
    (innerColor && hexColor(shell.color) === innerColor ? null : hexColor(shell.color)) ??
    firstNonWhiteColor(palette) ??
    firstHexColor(palette) ??
    FIREWORK_COLORS.Gold;
  const primaryColor = outerColor;
  const secondaryColor =
    hexColor(shell.secondColor) ??
    palette.find((color) => color !== primaryColor && color !== innerColor) ??
    null;
  const glitterColor =
    hexColor(shell.glitterColor) ?? hexColor(launch.tracerColor) ?? secondaryColor ?? primaryColor;
  const tailColor =
    hexColor(shell.tailColor) ??
    hexColor(launch.tailColor) ??
    hexColor(launch.tracerColor) ??
    undefined;
  const size = finiteNumber(shell.size) ?? finiteNumber(shell.spreadSize) ?? 3;
  const starLifeMs =
    finiteNumber(shell.starLifeMs) ??
    finiteNumber(renderProfile.starLifeMs) ??
    (shellType === 'willow' || shellType === 'fallingLeaves'
      ? 3000
      : shellType === 'comet'
        ? 2600
        : shellType === 'strobe'
          ? 1900
          : 1500);
  const inferredPistilColor =
    innerColor ??
    (palette.some(isWhiteColor) && palette.some((color) => !isWhiteColor(color))
      ? palette.find(isWhiteColor)
      : null);
  const shots = shotsFromEffectSpec(effectSpec, palette);

  return {
    shellType,
    spreadSize: clamp(finiteNumber(shell.spreadSize) ?? 2 + size * 0.55, 0.4, 40),
    starLifeMs: clamp(starLifeMs, 200, 8000),
    starLifeVariation: clamp(finiteNumber(shell.starLifeVariation) ?? 0.18, 0, 1),
    starDensity: clamp(finiteNumber(shell.starDensity) ?? 1, 0.2, 4),
    starCount:
      finiteNumber(shell.starCount) == null
        ? undefined
        : clamp(Math.round(finiteNumber(shell.starCount) ?? 0), 4, 900),
    color: primaryColor,
    colorPalette: palette.length ? uniqueHexColors(primaryColor, palette) : undefined,
    innerColor: innerColor ?? undefined,
    outerColor: primaryColor,
    secondColor: secondaryColor ?? undefined,
    transitionTimeMs:
      finiteNumber(shell.transitionTimeMs) == null
        ? undefined
        : clamp(finiteNumber(shell.transitionTimeMs) ?? 0, 50, 8000),
    glitter: coerceGlitter(
      shell.glitter,
      shellType === 'willow' ? 'willow' : shellType === 'comet' ? 'streamer' : 'light',
    ),
    glitterColor,
    tailColor,
    trailEffect: trailEffectFromLaunch(launch, shell),
    liftTimeSeconds:
      finiteNumber(launch.liftTimeSeconds) == null
        ? undefined
        : clamp(finiteNumber(launch.liftTimeSeconds) ?? 0, 0.2, 4),
    launch: {
      liftTimeSeconds:
        finiteNumber(launch.liftTimeSeconds) == null
          ? undefined
          : clamp(finiteNumber(launch.liftTimeSeconds) ?? 0, 0.2, 4),
      heightMeters:
        finiteNumber(launch.heightMeters) == null && finiteNumber(effectSpec.heightMeters) == null
          ? undefined
          : clamp(
              finiteNumber(launch.heightMeters) ?? finiteNumber(effectSpec.heightMeters) ?? 0,
              0,
              220,
            ),
      tracerColor: hexColor(launch.tracerColor) ?? undefined,
      tailColor,
      sparkFrequency:
        finiteNumber(launch.sparkFrequency) == null
          ? undefined
          : clamp(finiteNumber(launch.sparkFrequency) ?? 0, 0, 1000),
      sparkLifeMs:
        finiteNumber(launch.sparkLifeMs) == null
          ? undefined
          : clamp(finiteNumber(launch.sparkLifeMs) ?? 0, 50, 4000),
      sparkSpeed:
        finiteNumber(launch.sparkSpeed) == null
          ? undefined
          : clamp(finiteNumber(launch.sparkSpeed) ?? 0, 0, 5),
      randomWobble:
        finiteNumber(launch.randomWobble) == null
          ? undefined
          : clamp(finiteNumber(launch.randomWobble) ?? 0, 0, 2),
    },
    shots,
    pistil: Boolean(shell.pistil || inferredPistilColor),
    pistilColor: inferredPistilColor ?? undefined,
    streamers: Boolean(shell.streamers || shellType === 'ghost'),
    strobe: Boolean(shell.strobe || shellType === 'strobe'),
    strobeColor: hexColor(shell.strobeColor) ?? undefined,
    ring: Boolean(shell.ring || shellType === 'ring'),
    horsetail: Boolean(shell.horsetail || shellType === 'horsetail'),
    crossette: Boolean(shell.crossette || shellType === 'crossette'),
    crackle: Boolean(shell.crackle || shellType === 'crackle'),
    floral: Boolean(shell.floral || shellType === 'floral'),
    fallingLeaves: Boolean(shell.fallingLeaves || shellType === 'fallingLeaves'),
  };
}

function normalizeImportedFireworkLaunchInput(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const liftTimeSeconds = finiteNumber(value.liftTimeSeconds);
  const heightMeters = finiteNumber(value.heightMeters);
  const sparkFrequency = finiteNumber(value.sparkFrequency);
  const sparkLifeMs = finiteNumber(value.sparkLifeMs);
  const sparkSpeed = finiteNumber(value.sparkSpeed);
  const randomWobble = finiteNumber(value.randomWobble);

  return {
    ...value,
    liftTimeSeconds:
      liftTimeSeconds == null ? value.liftTimeSeconds : clamp(liftTimeSeconds, 0.2, 4),
    heightMeters: heightMeters == null ? value.heightMeters : clamp(heightMeters, 0, 220),
    sparkFrequency: sparkFrequency == null ? value.sparkFrequency : clamp(sparkFrequency, 0, 1000),
    sparkLifeMs: sparkLifeMs == null ? value.sparkLifeMs : clamp(sparkLifeMs, 50, 4000),
    sparkSpeed: sparkSpeed == null ? value.sparkSpeed : clamp(sparkSpeed, 0, 5),
    randomWobble: randomWobble == null ? value.randomWobble : clamp(randomWobble, 0, 2),
  };
}

function normalizeImportedFireworkSpecSpec(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    liftTimeSeconds:
      finiteNumber(value.liftTimeSeconds) == null
        ? value.liftTimeSeconds
        : clamp(finiteNumber(value.liftTimeSeconds) ?? 0, 0.2, 4),
    launch: normalizeImportedFireworkLaunchInput(value.launch),
  };
}

function normalizeImportedFireworkSpecInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if ('spec' in value) {
    return {
      ...value,
      spec: normalizeImportedFireworkSpecSpec(value.spec),
    };
  }

  if (!isRecord(value.effectSpec)) {
    return value;
  }

  const launch = isRecord(value.effectSpec.launch) ? value.effectSpec.launch : {};
  const shell = isRecord(value.effectSpec.shell) ? value.effectSpec.shell : {};
  const heightMeters =
    finiteNumber(value.heightMeters) ??
    finiteNumber(value.effectSpec.heightMeters) ??
    finiteNumber(launch.heightMeters);
  const caliber =
    textValue(value.caliber) ??
    textValue(value.effectSpec.caliber) ??
    textValue(value.effectSpec.bore) ??
    textValue(shell.caliber);

  return {
    ...value,
    heightMeters,
    caliber,
    spec: fireworkSpecFromEffectSpec(value.effectSpec),
  };
}

export function parseImportedFireworkSpec(value: unknown): ImportedFireworkSpec | null {
  const parsed = ImportedFireworkSpecSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  console.error(
    '[imports] parseImportedFireworkSpec failed',
    parsed.error.issues.slice(0, 3).map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  );
  return null;
}

export function importedSpecToReplayCues(imported: ImportedFireworkSpec): ReplayCue[] {
  const id = 'imported-spec';
  const spec: FireworkSpec = imported.spec;
  return [
    {
      id,
      position: 1,
      timeSeconds: 0,
      description: imported.description ?? imported.name,
      productId: id,
      seedOverride: null,
      launchPositionIndex: 0,
      firework: {
        id,
        slug: spec.shellType,
        name: imported.name,
        description: imported.description ?? null,
        sortOrder: 1,
        durationSeconds: imported.durationSeconds,
        heightMeters: imported.heightMeters ?? null,
        caliber: imported.caliber ?? null,
        shotCount: 1,
        spec,
        rawSpec: spec,
        renderDesign: compileFireworkDesign({ legacySpec: spec }),
        baseEffect: null,
        variant: null,
      },
    },
  ];
}

export function latestImportedSpecFromOutputs(
  outputs: { outputType: string; payload: unknown }[],
): ImportedFireworkSpec | null {
  for (const output of [...outputs].reverse()) {
    if (
      output.outputType !== 'draft_spec' &&
      output.outputType !== 'generated_spec' &&
      output.outputType !== 'refinement'
    ) {
      continue;
    }
    const candidate =
      typeof output.payload === 'object' && output.payload !== null && 'spec' in output.payload
        ? (output.payload as { spec?: unknown }).spec
        : output.payload;
    const parsed = parseImportedFireworkSpec(candidate);
    if (parsed) return parsed;
  }
  return null;
}
