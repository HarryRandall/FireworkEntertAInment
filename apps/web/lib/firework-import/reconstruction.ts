/** Version 2 video import reconstructions: fitted renderer designs and their timed shots. */
import { resolveDesign, upgradeDesign, type Design } from '@showcrafter/renderer';
import { z } from 'zod';
import type { ReplayCue } from '../show-domain';

/** Matches public.current_firework_import_validator_version() and the worker's candidates. */
export const IMPORT_RECONSTRUCTION_VALIDATOR_VERSION = 'showcrafter.firework-reconstruction.v2';
const IMPORT_FIT_EVIDENCE_SCHEMA_VERSION = 'showcrafter.import-fit-evidence.v1';

// Bounds shared with private.firework_import_reconstruction_v2_issue.
const MAX_PRODUCT_SECONDS = 120;
const MAX_DESIGNS = 64;
const MAX_SHOTS = 500;
const MAX_PAN_DEGREES = 30;
const MAX_PALETTE_COLOURS = 6;
// Rounding slack for a shot's offset plus duration against the stored product duration.
const DURATION_TOLERANCE_SECONDS = 0.001;
const STORED_DESIGN_SCHEMA = 1;

const ReconstructionDesignSchema = z.object({
  key: z.string().regex(/^[a-z]{1,2}$/),
  template: z.string().min(1).max(80),
  label: z.string().max(180).nullish(),
  design: z.unknown(),
  durationSeconds: z.number().finite().positive().max(MAX_PRODUCT_SECONDS),
  colorPalette: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
    .max(MAX_PALETTE_COLOURS)
    .default([]),
});

const ReconstructionShotSchema = z.object({
  id: z.string().max(40).optional(),
  designKey: z.string(),
  timeOffsetSeconds: z.number().finite().min(0).max(MAX_PRODUCT_SECONDS),
  panDegrees: z.number().int().min(-MAX_PAN_DEGREES).max(MAX_PAN_DEGREES),
  x: z.number().finite().min(0).max(1).nullish(),
});

const ImportReconstructionSchema = z.object({
  version: z.literal(2),
  name: z.string().trim().min(1).max(180),
  description: z.string().max(1_200).nullish(),
  durationSeconds: z.number().finite().positive().max(MAX_PRODUCT_SECONDS),
  designs: z.array(ReconstructionDesignSchema).min(1).max(MAX_DESIGNS),
  shots: z.array(ReconstructionShotSchema).min(1).max(MAX_SHOTS),
  source: z
    .object({
      durationSeconds: z.number().finite().nonnegative(),
      firstShotSeconds: z.number().finite().nonnegative(),
    })
    .passthrough()
    .nullish(),
});

export type ImportReconstructionIssue = { path: Array<string | number>; message: string };

type ImportReconstructionDesign = Omit<z.infer<typeof ReconstructionDesignSchema>, 'design'> & {
  design: Design;
};

export type ImportReconstructionPlan = Omit<
  z.infer<typeof ImportReconstructionSchema>,
  'designs'
> & { designs: ImportReconstructionDesign[] };

export type ImportReconstructionParseResult =
  | { success: true; data: ImportReconstructionPlan }
  | { success: false; issues: ImportReconstructionIssue[] };

/** Parses a stored reconstruction and checks every design through the renderer's version gate. */
export function parseImportReconstruction(input: unknown): ImportReconstructionParseResult {
  const parsed = ImportReconstructionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map((key) => (typeof key === 'number' ? key : String(key))),
        message: issue.message,
      })),
    };
  }
  const issues: ImportReconstructionIssue[] = [];
  const designs: ImportReconstructionDesign[] = [];
  const durations = new Map<string, number>();
  parsed.data.designs.forEach((entry, index) => {
    if (durations.has(entry.key)) {
      issues.push({
        path: ['designs', index, 'key'],
        message: `Design ${entry.key} is duplicated.`,
      });
    }
    durations.set(entry.key, entry.durationSeconds);
    try {
      const design = upgradeDesign(entry.design, STORED_DESIGN_SCHEMA);
      resolveDesign(design);
      designs.push({ ...entry, design });
    } catch (error) {
      issues.push({
        path: ['designs', index, 'design'],
        message: `Design ${entry.key} is not a valid renderer design: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      });
    }
  });
  const used = new Set<string>();
  parsed.data.shots.forEach((shot, index) => {
    const duration = durations.get(shot.designKey);
    used.add(shot.designKey);
    if (duration == null) {
      issues.push({
        path: ['shots', index, 'designKey'],
        message: `Shot ${index + 1} uses unknown design ${shot.designKey}.`,
      });
    } else if (
      shot.timeOffsetSeconds + duration >
      parsed.data.durationSeconds + DURATION_TOLERANCE_SECONDS
    ) {
      issues.push({
        path: ['shots', index, 'timeOffsetSeconds'],
        message: `Shot ${index + 1} ends after the reconstruction.`,
      });
    }
  });
  for (const key of durations.keys()) {
    if (!used.has(key)) {
      issues.push({ path: ['designs'], message: `Design ${key} is not used by any shot.` });
    }
  }
  if (issues.length > 0) return { success: false, issues };
  return { success: true, data: { ...parsed.data, designs } };
}

const FitShotSchema = z.object({
  index: z.number().int().nonnegative(),
  overall: z.number().finite(),
  distances: z.record(z.string(), z.number().finite().nullable()),
});

const FitEvidenceSchema = z.object({
  schemaVersion: z.literal(IMPORT_FIT_EVIDENCE_SCHEMA_VERSION),
  rendererVersion: z.string(),
  overall: z.number().finite(),
  shots: z.array(FitShotSchema),
  timedOut: z.boolean(),
  iterations: z.record(z.string(), z.number().int().nonnegative()).optional(),
  initialOverall: z.number().finite().optional(),
});

const CandidateMetricsSchema = z.object({
  source: z.enum(['fitted', 'model']),
  fit: FitEvidenceSchema,
});

export type ImportFitEvidence = z.infer<typeof FitEvidenceSchema>;
export type ImportCandidateMetrics = z.infer<typeof CandidateMetricsSchema>;

/** Reads the worker's fit evidence; older candidates without it return null. */
export function parseImportCandidateMetrics(value: unknown): ImportCandidateMetrics | null {
  const parsed = CandidateMetricsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Expands a reconstruction into replay cues placed as approval will publish them. */
export function reconstructionToReplayCues(
  plan: ImportReconstructionPlan,
  options: { idPrefix?: string } = {},
): ReplayCue[] {
  const idPrefix = options.idPrefix ?? 'import';
  const designs = new Map(plan.designs.map((entry) => [entry.key, entry]));
  return plan.shots
    .map((shot, sourceIndex) => ({ shot, sourceIndex }))
    .sort(
      (left, right) =>
        left.shot.timeOffsetSeconds - right.shot.timeOffsetSeconds ||
        left.sourceIndex - right.sourceIndex,
    )
    .flatMap(({ shot, sourceIndex }, cueIndex): ReplayCue[] => {
      const entry = designs.get(shot.designKey);
      if (!entry) return [];
      const productId = `${idPrefix}-${entry.key}`;
      return [
        {
          id: `${idPrefix}-shot-${sourceIndex + 1}`,
          position: cueIndex + 1,
          timeSeconds: shot.timeOffsetSeconds,
          description: entry.label ?? plan.name,
          productId,
          launchPositionIndex: 0,
          shotPanDegrees: shot.panDegrees,
          shotTiltDegrees: 0,
          firework: {
            id: productId,
            slug: productId,
            name: entry.label ?? plan.name,
            description: plan.description ?? null,
            sortOrder: cueIndex,
            durationSeconds: entry.durationSeconds,
            heightMeters: null,
            caliber: null,
            shotCount: 1,
            spec: null,
            rawSpec: null,
            design: entry.design,
            kind: entry.design.kind,
            renderDesign: null,
            baseEffect: null,
            variant: null,
          },
        },
      ];
    });
}
