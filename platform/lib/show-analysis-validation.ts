import { z } from 'zod';

export const ANALYSER_SCHEMA_VERSION = '1.4.0';
export const ANALYSER_ARRAY_LIMITS = {
  beats: 10_000,
  onsets: 50_000,
  energyPoints: 2_000,
  sections: 256,
  keyMoments: 512,
  buildups: 512,
  fireworkCues: 12_000,
  anchorWindows: 1_024,
} as const;

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const positiveNumber = finiteNumber.positive();
const audioDuration = positiveNumber.max(15 * 60);
const score = finiteNumber.min(0).max(1);
const nonNegativeInteger = z.number().int().finite().nonnegative();
const nonEmptyString = z.string().min(1);
const sectionLabel = z.enum([
  'intro',
  'verse',
  'pre-chorus',
  'chorus',
  'bridge',
  'drop',
  'build',
  'breakdown',
  'outro',
  'unknown',
]);

const styleVectorSchema = z
  .object({
    boldness: score,
    elegance: score,
    playfulness: score,
    warmth: score,
    brightness: score,
    grandeur: score,
    tension: score,
    precision: score,
  })
  .strict();

const descriptorSchema = z
  .object({
    energy: score,
    drive: score,
    brightness: score,
    warmth: score,
    tension: score,
    grandeur: score,
    playfulness: score,
    precision: score,
    dynamic_range: score,
    bass_impact: score,
    section_contrast: score,
  })
  .strict();

const timingBreakdownSchema = z
  .object({
    download_ms: nonNegativeNumber,
    decode_ms: nonNegativeNumber,
    beat_ms: nonNegativeNumber,
    energy_ms: nonNegativeNumber,
    onset_ms: nonNegativeNumber,
    section_ms: nonNegativeNumber,
    profile_ms: nonNegativeNumber,
    validation_ms: nonNegativeNumber,
    total_ms: nonNegativeNumber,
  })
  .strict();

const sectionSchema = z
  .object({
    start: nonNegativeNumber,
    end: nonNegativeNumber,
    duration: nonNegativeNumber,
    avg_energy: score,
    peak_energy: score,
    intensity: z.enum(['low', 'medium', 'high']),
    cluster_id: z.number().int().finite(),
    label: sectionLabel,
  })
  .strict()
  .superRefine((section, context) => {
    if (section.end < section.start) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'must not precede section start',
      });
    }
    if (Math.abs(section.duration - (section.end - section.start)) > 0.06) {
      context.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'must match section end minus start',
      });
    }
  });

const buildupSchema = z
  .object({
    start: nonNegativeNumber,
    peak: nonNegativeNumber,
    duration: nonNegativeNumber,
    energy_rise: nonNegativeNumber,
  })
  .strict()
  .superRefine((buildup, context) => {
    if (buildup.peak < buildup.start) {
      context.addIssue({ code: 'custom', path: ['peak'], message: 'must not precede start' });
    }
    if (Math.abs(buildup.duration - (buildup.peak - buildup.start)) > 0.06) {
      context.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'must match buildup peak minus start',
      });
    }
  });

const analyserResultSchema = z
  .object({
    schema_version: z.literal(ANALYSER_SCHEMA_VERSION),
    file: nonEmptyString,
    analysis_meta: z
      .object({
        mode: z.literal('fast'),
        runner_version: nonEmptyString,
        timings_ms: timingBreakdownSchema,
      })
      .strict(),
    duration_seconds: audioDuration,
    // Tempo can be zero when slow, ambient, or irregular music has no defensible pulse.
    tempo_bpm: nonNegativeNumber,
    total_beats: nonNegativeInteger,
    beat_times: z.array(nonNegativeNumber).max(ANALYSER_ARRAY_LIMITS.beats),
    onset_times: z.array(nonNegativeNumber).max(ANALYSER_ARRAY_LIMITS.onsets),
    energy_timeline: z
      .array(z.object({ time: nonNegativeNumber, energy: score }).strict())
      .max(ANALYSER_ARRAY_LIMITS.energyPoints),
    sections: z.array(sectionSchema).min(1).max(ANALYSER_ARRAY_LIMITS.sections),
    key_moments: z
      .array(
        z
          .object({
            time: nonNegativeNumber,
            energy: score,
            prominence: nonNegativeNumber,
            type: z.enum(['build', 'climax']),
          })
          .strict(),
      )
      .max(ANALYSER_ARRAY_LIMITS.keyMoments),
    buildups: z.array(buildupSchema).max(ANALYSER_ARRAY_LIMITS.buildups),
    music_profile: z
      .object({
        genre_hint: nonEmptyString,
        key_signature: z
          .object({ root: nonEmptyString, mode: z.enum(['major', 'minor']), confidence: score })
          .strict(),
        descriptors: descriptorSchema,
        style_vector: styleVectorSchema,
        dominant_traits: z.array(nonEmptyString),
        raw_metrics: z
          .object({
            tempo_bpm: nonNegativeNumber,
            onset_density_per_sec: nonNegativeNumber,
            key_moments_per_min: nonNegativeNumber,
            buildups_per_min: nonNegativeNumber,
            beat_stability: score,
            section_contrast: nonNegativeNumber,
            bass_ratio: nonNegativeNumber,
          })
          .strict(),
      })
      .strict(),
    show_personality: z
      .object({
        preset: z.enum(['balanced', 'bold', 'cinematic', 'elegant', 'intimate', 'playful']),
        blend_weights: z.object({ user: score, music: score }).strict(),
        dimensions: styleVectorSchema,
        dominant_traits: z.array(nonEmptyString),
        palette_direction: z
          .object({ primary: nonEmptyString, secondary: nonEmptyString, accent: nonEmptyString })
          .strict(),
        density_level: z.enum(['low', 'medium', 'high']),
        genre_hint: nonEmptyString,
      })
      .strict(),
    firework_cues: z
      .array(
        z
          .object({
            time: nonNegativeNumber,
            end: nonNegativeNumber.optional(),
            effect: z.enum(['barrage', 'accent', 'crackle', 'single']),
            reason: nonEmptyString,
            energy: score,
            section: sectionLabel,
            palette: nonEmptyString,
            shape: nonEmptyString,
            height: nonEmptyString,
            spread: nonEmptyString,
            density: nonEmptyString,
            style_tags: z.array(nonEmptyString),
            genre_hint: nonEmptyString,
          })
          .strict()
          .refine((cue) => cue.end == null || cue.end >= cue.time, {
            path: ['end'],
            message: 'must not precede cue time',
          }),
      )
      .max(ANALYSER_ARRAY_LIMITS.fireworkCues),
    derived: z
      .object({
        finale_window: z
          .object({ start: nonNegativeNumber, end: nonNegativeNumber })
          .strict()
          .refine((window) => window.end >= window.start, {
            path: ['end'],
            message: 'must not precede finale start',
          })
          .nullable(),
        quietest_section_index: nonNegativeInteger.nullable(),
        highest_energy_section_index: nonNegativeInteger.nullable(),
        repeated_chorus_count: nonNegativeInteger,
        section_rank_by_energy: z.array(nonNegativeInteger),
        anchor_windows: z
          .array(
            z
              .object({
                type: z.enum(['climax', 'buildup']),
                anchor_time: nonNegativeNumber,
                start: nonNegativeNumber,
                end: nonNegativeNumber,
                energy: score.optional(),
                energy_rise: nonNegativeNumber.optional(),
              })
              .strict()
              .superRefine((window, context) => {
                if (window.end < window.start) {
                  context.addIssue({
                    code: 'custom',
                    path: ['end'],
                    message: 'must not precede start',
                  });
                }
                if (window.anchor_time < window.start || window.anchor_time > window.end) {
                  context.addIssue({
                    code: 'custom',
                    path: ['anchor_time'],
                    message: 'must be inside the anchor window',
                  });
                }
                if (window.type === 'climax' && window.energy == null) {
                  context.addIssue({ code: 'custom', path: ['energy'], message: 'is required' });
                }
                if (window.type === 'buildup' && window.energy_rise == null) {
                  context.addIssue({
                    code: 'custom',
                    path: ['energy_rise'],
                    message: 'is required',
                  });
                }
              }),
          )
          .max(ANALYSER_ARRAY_LIMITS.anchorWindows),
      })
      .strict(),
    downbeat_times: z.array(nonNegativeNumber).max(ANALYSER_ARRAY_LIMITS.beats),
    beats_per_bar: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict()
  .superRefine((analysis, context) => {
    const maximumTime = analysis.duration_seconds + 0.75;
    const addIssue = (path: PropertyKey[], message: string) => {
      context.addIssue({ code: 'custom', path, message });
    };

    if (analysis.total_beats !== analysis.beat_times.length) {
      addIssue(['total_beats'], 'must equal the number of beat_times');
    }
    validateOrderedTimes(analysis.beat_times, (value) => value, true, ['beat_times'], addIssue);
    validateOrderedTimes(analysis.onset_times, (value) => value, false, ['onset_times'], addIssue);
    validateOrderedTimes(
      analysis.downbeat_times,
      (value) => value,
      true,
      ['downbeat_times'],
      addIssue,
    );
    validateOrderedTimes(
      analysis.energy_timeline,
      (point) => point.time,
      true,
      ['energy_timeline'],
      addIssue,
    );
    validateOrderedTimes(
      analysis.key_moments,
      (moment) => moment.time,
      false,
      ['key_moments'],
      addIssue,
    );
    validateOrderedTimes(
      analysis.buildups,
      (buildup) => buildup.peak,
      false,
      ['buildups'],
      addIssue,
    );
    validateOrderedTimes(
      analysis.firework_cues,
      (cue) => cue.time,
      false,
      ['firework_cues'],
      addIssue,
    );

    if (
      someTimeExceeds(analysis.beat_times, (value) => value, maximumTime) ||
      someTimeExceeds(analysis.onset_times, (value) => value, maximumTime) ||
      someTimeExceeds(analysis.downbeat_times, (value) => value, maximumTime) ||
      someTimeExceeds(analysis.energy_timeline, (point) => point.time, maximumTime) ||
      someTimeExceeds(analysis.sections, (section) => section.end, maximumTime) ||
      someTimeExceeds(analysis.key_moments, (moment) => moment.time, maximumTime) ||
      someTimeExceeds(analysis.buildups, (buildup) => buildup.peak, maximumTime) ||
      someTimeExceeds(analysis.firework_cues, (cue) => cue.end ?? cue.time, maximumTime)
    ) {
      addIssue([], 'timed analysis fields must not exceed song duration');
    }

    for (let index = 1; index < analysis.sections.length; index += 1) {
      if (analysis.sections[index].start < analysis.sections[index - 1].end) {
        addIssue(['sections', index, 'start'], 'sections must be ordered and non-overlapping');
        break;
      }
    }
    if (!everyTimeMatchesGrid(analysis.downbeat_times, analysis.beat_times, 0.06)) {
      addIssue(['downbeat_times'], 'every downbeat must align with a beat within 60 ms');
    }

    const sectionCount = analysis.sections.length;
    for (const key of ['quietest_section_index', 'highest_energy_section_index'] as const) {
      const value = analysis.derived[key];
      if (value != null && value >= sectionCount) {
        addIssue(['derived', key], 'must refer to an existing section');
      }
    }
    const rank = analysis.derived.section_rank_by_energy;
    if (
      rank.length !== sectionCount ||
      new Set(rank).size !== rank.length ||
      rank.some((index) => index >= sectionCount)
    ) {
      addIssue(
        ['derived', 'section_rank_by_energy'],
        'must contain every section index exactly once',
      );
    }
    const finale = analysis.derived.finale_window;
    if (finale && finale.end > maximumTime) {
      addIssue(['derived', 'finale_window', 'end'], 'must not exceed song duration');
    }
    analysis.derived.anchor_windows.forEach((window, index) => {
      if (window.end > maximumTime) {
        addIssue(['derived', 'anchor_windows', index, 'end'], 'must not exceed song duration');
      }
    });
  });

type AddIssue = (path: PropertyKey[], message: string) => void;

function validateOrderedTimes<T>(
  values: T[],
  getTime: (value: T) => number,
  strict: boolean,
  path: PropertyKey[],
  addIssue: AddIssue,
) {
  for (let index = 1; index < values.length; index += 1) {
    const current = getTime(values[index]);
    const previous = getTime(values[index - 1]);
    if (strict ? current <= previous : current < previous) {
      addIssue(
        [...path, index],
        strict ? 'times must be strictly increasing' : 'times must be sorted',
      );
      return;
    }
  }
}

function someTimeExceeds<T>(values: T[], getTime: (value: T) => number, maximumTime: number) {
  return values.some((value) => getTime(value) > maximumTime);
}

function everyTimeMatchesGrid(values: number[], grid: number[], tolerance: number) {
  let gridIndex = 0;
  for (const value of values) {
    while (gridIndex < grid.length && grid[gridIndex] < value - tolerance) gridIndex += 1;
    if (gridIndex >= grid.length || Math.abs(grid[gridIndex] - value) > tolerance) return false;
  }
  return true;
}

export class AnalyserOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyserOutputValidationError';
  }
}

export class LegacyAnalyserUpgradeError extends AnalyserOutputValidationError {
  readonly schemaVersion: '1.2.0' | '1.3.0';

  constructor(schemaVersion: '1.2.0' | '1.3.0', cause: string) {
    super(
      `Stored schema ${schemaVersion} analysis could not be safely upgraded and requires re-analysis: ${cause}`,
    );
    this.name = 'LegacyAnalyserUpgradeError';
    this.schemaVersion = schemaVersion;
  }
}

export type AnalyserV14Result = z.infer<typeof analyserResultSchema>;

export function parseAnalyserResult(value: unknown): AnalyserV14Result {
  const parsed = analyserResultSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    throw new AnalyserOutputValidationError(
      `The analyser returned invalid schema ${ANALYSER_SCHEMA_VERSION} output: ${details}`,
    );
  }
  return parsed.data;
}

export function parseStoredAnalyserResult(value: unknown): AnalyserV14Result {
  if (typeof value !== 'object' || value == null || !('schema_version' in value)) {
    return parseAnalyserResult(value);
  }

  const legacy = value as Record<string, unknown>;
  if (legacy.schema_version !== '1.2.0' && legacy.schema_version !== '1.3.0') {
    return parseAnalyserResult(value);
  }
  const legacySections = Array.isArray(legacy.sections) ? legacy.sections : [];
  const sectionEnergy = legacySections.map((section, index) => {
    const candidate =
      typeof section === 'object' && section != null && 'avg_energy' in section
        ? section.avg_energy
        : Number.NaN;
    return { index, energy: typeof candidate === 'number' ? candidate : Number.NaN };
  });
  const rankedSections = [...sectionEnergy]
    .sort((left, right) => right.energy - left.energy)
    .map(({ index }) => index);
  const quietest = [...sectionEnergy].sort((left, right) => left.energy - right.energy)[0];

  const upgraded = {
    ...legacy,
    schema_version: ANALYSER_SCHEMA_VERSION,
    analysis_meta:
      legacy.schema_version === '1.2.0'
        ? {
            mode: 'fast',
            runner_version: 'legacy-schema-1.2',
            timings_ms: {
              download_ms: 0,
              decode_ms: 0,
              beat_ms: 0,
              energy_ms: 0,
              onset_ms: 0,
              section_ms: 0,
              profile_ms: 0,
              validation_ms: 0,
              total_ms: 0,
            },
          }
        : legacy.analysis_meta,
    downbeat_times: [],
    beats_per_bar: 4,
    derived: {
      finale_window: null,
      quietest_section_index: quietest?.index ?? null,
      highest_energy_section_index: rankedSections[0] ?? null,
      repeated_chorus_count: legacySections.filter(
        (section) =>
          typeof section === 'object' &&
          section != null &&
          'label' in section &&
          section.label === 'chorus',
      ).length,
      section_rank_by_energy: rankedSections,
      anchor_windows: [],
    },
  };

  try {
    return parseAnalyserResult(upgraded);
  } catch (error) {
    if (error instanceof AnalyserOutputValidationError) {
      throw new LegacyAnalyserUpgradeError(legacy.schema_version, error.message);
    }
    throw error;
  }
}

export function parseAnalyserResponse(bodyText: string): AnalyserV14Result {
  let value: unknown;
  try {
    value = JSON.parse(bodyText);
  } catch {
    throw new AnalyserOutputValidationError('The analyser did not return JSON output.');
  }
  return parseAnalyserResult(value);
}
