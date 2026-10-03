/** Validate measured image-space evidence and untrusted template proposals before simulation. */
import { z } from 'zod';
import { effectTemplates, upgradeDesign, type Design } from '@showcrafter/fireworks';

// Operational caps shared with the decoder: milliseconds, shot count and bounded override depth.
const MAX_DURATION_MS = 120000;
const MAX_SHOTS = 100;
const MAX_OVERRIDE_DEPTH = 12;
// Decoder raster dimensions in pixels and chromatic summary limits from features.py.
const WIDTH_PX = 256;
const HEIGHT_PX = 192;
const MAX_SWATCHES = 3;
const MAX_COLOUR_SAMPLES = 480;
// A tube's projected direction spans a half turn, in degrees from vertical (composition schema).
const MAX_ANGLE_DEG = 90;
const LETTER_PATTERN = /^[a-z]{1,2}$/;
const ratio = z.number().finite().min(0).max(1);
const milliseconds = z.number().int().min(0).max(MAX_DURATION_MS);
const swatch = z.object({ rgb: z.tuple([ratio, ratio, ratio]), fraction: ratio });
const featureSchema = z.object({
  shot_index: z.number().int().nonnegative(),
  content_box_px: z.tuple([
    z.number().int().min(0).max(WIDTH_PX),
    z.number().int().min(0).max(HEIGHT_PX),
    z.number().int().min(2).max(WIDTH_PX),
    z.number().int().min(2).max(HEIGHT_PX),
  ]),
  apex_ratio: ratio,
  radius_ratio: ratio,
  life_ms: milliseconds,
  trail_present: z.boolean(),
  trail_length_ratio: ratio,
  crackle: z.boolean().nullable(),
  strobe: z.boolean(),
  truncated: z.boolean(),
  colours: z.array(swatch).max(MAX_SWATCHES),
  colours_over_time: z
    .array(z.object({ t_ms: milliseconds, colours: z.array(swatch).max(MAX_SWATCHES) }))
    .max(MAX_COLOUR_SAMPLES),
});

/** Validated measurement window, with absolute times in ms and projected content ratios. */
export type Evidence = z.infer<typeof evidenceSchema>;
/** Validated shot features in the measurement raster's content coordinates. */
export type Feature = z.infer<typeof featureSchema>;
/** Template proposal compatible with the database's recursive design overrides. */
export type Proposal = z.infer<typeof proposalSchema>;

const evidenceSchema = z.object({
  duration_ms: milliseconds.positive(),
  shots: z
    .array(
      z.object({
        t_ms: milliseconds,
        x: ratio,
        angle_deg: z.number().finite().min(-MAX_ANGLE_DEG).max(MAX_ANGLE_DEG).nullable(),
      }),
    )
    .min(1)
    .max(MAX_SHOTS),
  features: z.array(featureSchema).min(1).max(MAX_SHOTS),
});
const proposalSchema = z
  .object({
    effects: z.record(
      z.string().regex(LETTER_PATTERN),
      z.object({ template: z.string(), overrides: z.record(z.unknown()) }).strict(),
    ),
    composition: z
      .object({
        tubes: z
          .array(
            z
              .object({
                i: z.number().int().nonnegative(),
                letter: z.string().regex(LETTER_PATTERN),
                t_ms: milliseconds,
                angle_deg: z.number().finite().min(-MAX_ANGLE_DEG).max(MAX_ANGLE_DEG),
              })
              .strict(),
          )
          .min(1)
          .max(MAX_SHOTS),
      })
      .strict(),
  })
  .strict();

/** Parse evidence and require exactly one ordered feature record per measured onset. */
export function parseEvidence(input: unknown): Evidence {
  const evidence = evidenceSchema.parse(input);
  if (evidence.shots.length !== evidence.features.length) {
    throw new Error('Feature coverage required');
  }
  evidence.shots.forEach((shot, index) => {
    if (
      evidence.features[index]?.shot_index !== index ||
      shot.t_ms >= evidence.duration_ms ||
      (index > 0 && shot.t_ms <= (evidence.shots[index - 1]?.t_ms ?? 0))
    ) {
      throw new Error('Ordered measured shots required');
    }
  });
  return evidence;
}

function merge(base: unknown, overrides: unknown, depth: number): unknown {
  if (depth > MAX_OVERRIDE_DEPTH) {
    throw new Error('Overrides too deep');
  }
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return overrides;
  }
  const result: Record<string, unknown> =
    base !== null && typeof base === 'object' ? { ...base } : {};
  for (const [key, value] of Object.entries(overrides)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error('Unsafe override key');
    }
    result[key] = merge(result[key], value, depth + 1);
  }
  return result;
}

function validateJson(value: unknown, depth = 0): void {
  if (depth > MAX_OVERRIDE_DEPTH) {
    throw new Error('Model JSON too deep');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Finite JSON required');
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error('Unsafe model key');
    }
    validateJson(child, depth + 1);
  }
}

/** Resolve a catalogue template and recursive overrides to the sole canonical v1 design. */
export function proposalDesign(effect: Proposal['effects'][string]): Design {
  const template = effectTemplates.find((entry) => entry.key === effect.template);
  if (!template) {
    throw new Error('Unknown effect template');
  }
  const design = upgradeDesign(merge(template.design, effect.overrides, 0), 1);
  if (design.kind !== template.design.kind) {
    throw new Error('Template kind cannot change');
  }
  return design;
}

/** Validate model JSON, canonical designs and exact measured shot/letter/tube coverage. */
export function parseProposal(input: unknown, evidence: Evidence): Proposal {
  validateJson(input);
  const proposal = proposalSchema.parse(input);
  const letters = new Set<string>();
  if (proposal.composition.tubes.length !== evidence.shots.length) {
    throw new Error('Tube coverage required');
  }
  proposal.composition.tubes.forEach((tube, index) => {
    if (
      tube.i !== index ||
      tube.t_ms !== evidence.shots[index]?.t_ms ||
      !proposal.effects[tube.letter]
    ) {
      throw new Error('Tube sequence must match measured onsets');
    }
    letters.add(tube.letter);
  });
  if (letters.size !== Object.keys(proposal.effects).length) {
    throw new Error('Unused effect proposal');
  }
  Object.values(proposal.effects).forEach(proposalDesign);
  return proposal;
}
