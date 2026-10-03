// Generated music analysis structure from schema/music-analysis.v1.json.
import { z } from 'zod';
const AnalysisTimingsModelSchema = z
  .object({
    download_ms: z.number().finite().gte(0),
    decode_ms: z.number().finite().gte(0),
    beat_ms: z.number().finite().gte(0),
    energy_ms: z.number().finite().gte(0),
    onset_ms: z.number().finite().gte(0),
    section_ms: z.number().finite().gte(0),
    profile_ms: z.number().finite().gte(0),
    validation_ms: z.number().finite().gte(0),
    total_ms: z.number().finite().gte(0),
  })
  .strict();
const AnalysisMetaModelSchema = z
  .object({
    mode: z.literal('fast'),
    runner_version: z.string().min(1),
    timings_ms: AnalysisTimingsModelSchema,
  })
  .strict();
const AnchorWindowModelSchema = z
  .object({
    type: z.enum(['climax', 'buildup']),
    anchor_time: z.number().finite().gte(0),
    start: z.number().finite().gte(0),
    end: z.number().finite().gte(0),
    energy: z.union([z.number().finite().gte(0).lte(1), z.null()]).optional(),
    energy_rise: z.union([z.number().finite().gte(0), z.null()]).optional(),
  })
  .strict();
const BlendWeightsModelSchema = z
  .object({ user: z.number().finite().gte(0).lte(1), music: z.number().finite().gte(0).lte(1) })
  .strict();
const BuildupModelSchema = z
  .object({
    start: z.number().finite().gte(0),
    peak: z.number().finite().gte(0),
    duration: z.number().finite().gte(0),
    energy_rise: z.number().finite().gte(0),
  })
  .strict();
const FinaleWindowModelSchema = z
  .object({ start: z.number().finite().gte(0), end: z.number().finite().gte(0) })
  .strict();
const DerivedFeaturesModelSchema = z
  .object({
    finale_window: z.union([FinaleWindowModelSchema, z.null()]),
    quietest_section_index: z.union([z.number().finite().int().gte(0), z.null()]),
    highest_energy_section_index: z.union([z.number().finite().int().gte(0), z.null()]),
    repeated_chorus_count: z.number().finite().int().gte(0),
    section_rank_by_energy: z.array(z.number().finite().int().gte(0)),
    anchor_windows: z.array(AnchorWindowModelSchema),
  })
  .strict();
const DescriptorModelSchema = z
  .object({
    energy: z.number().finite().gte(0).lte(1),
    drive: z.number().finite().gte(0).lte(1),
    brightness: z.number().finite().gte(0).lte(1),
    warmth: z.number().finite().gte(0).lte(1),
    tension: z.number().finite().gte(0).lte(1),
    grandeur: z.number().finite().gte(0).lte(1),
    playfulness: z.number().finite().gte(0).lte(1),
    precision: z.number().finite().gte(0).lte(1),
    dynamic_range: z.number().finite().gte(0).lte(1),
    bass_impact: z.number().finite().gte(0).lte(1),
    section_contrast: z.number().finite().gte(0).lte(1),
  })
  .strict();
const EnergyPointModelSchema = z
  .object({ time: z.number().finite().gte(0), energy: z.number().finite().gte(0).lte(1) })
  .strict();
const FireworkCueModelSchema = z
  .object({
    time: z.number().finite().gte(0),
    end: z.union([z.number().finite().gte(0), z.null()]).optional(),
    effect: z.enum(['barrage', 'accent', 'crackle', 'single']),
    reason: z.string().min(1),
    energy: z.number().finite().gte(0).lte(1),
    section: z.enum([
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
    ]),
    palette: z.string().min(1),
    shape: z.string().min(1),
    height: z.string().min(1),
    spread: z.string().min(1),
    density: z.string().min(1),
    style_tags: z.array(z.string().min(1)),
    genre_hint: z.string().min(1),
  })
  .strict();
const KeyMomentModelSchema = z
  .object({
    time: z.number().finite().gte(0),
    energy: z.number().finite().gte(0).lte(1),
    prominence: z.number().finite().gte(0),
    type: z.enum(['build', 'climax']),
  })
  .strict();
const KeySignatureModelSchema = z
  .object({
    root: z.string().min(1),
    mode: z.enum(['major', 'minor']),
    confidence: z.number().finite().gte(0).lte(1),
  })
  .strict();
const StyleVectorModelSchema = z
  .object({
    boldness: z.number().finite().gte(0).lte(1),
    elegance: z.number().finite().gte(0).lte(1),
    playfulness: z.number().finite().gte(0).lte(1),
    warmth: z.number().finite().gte(0).lte(1),
    brightness: z.number().finite().gte(0).lte(1),
    grandeur: z.number().finite().gte(0).lte(1),
    tension: z.number().finite().gte(0).lte(1),
    precision: z.number().finite().gte(0).lte(1),
  })
  .strict();
const RawMetricsModelSchema = z
  .object({
    tempo_bpm: z.number().finite().gte(0),
    onset_density_per_sec: z.number().finite().gte(0),
    key_moments_per_min: z.number().finite().gte(0),
    buildups_per_min: z.number().finite().gte(0),
    beat_stability: z.number().finite().gte(0).lte(1),
    section_contrast: z.number().finite().gte(0),
    bass_ratio: z.number().finite().gte(0),
  })
  .strict();
const MusicProfileModelSchema = z
  .object({
    genre_hint: z.string().min(1),
    key_signature: KeySignatureModelSchema,
    descriptors: DescriptorModelSchema,
    style_vector: StyleVectorModelSchema,
    dominant_traits: z.array(z.string().min(1)),
    raw_metrics: RawMetricsModelSchema,
  })
  .strict();
const PaletteDirectionModelSchema = z
  .object({ primary: z.string().min(1), secondary: z.string().min(1), accent: z.string().min(1) })
  .strict();
const SectionModelSchema = z
  .object({
    start: z.number().finite().gte(0),
    end: z.number().finite().gte(0),
    duration: z.number().finite().gte(0),
    avg_energy: z.number().finite().gte(0).lte(1),
    peak_energy: z.number().finite().gte(0).lte(1),
    intensity: z.enum(['low', 'medium', 'high']),
    cluster_id: z.number().finite().int(),
    label: z.enum([
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
    ]),
  })
  .strict();
const ShowPersonalityModelSchema = z
  .object({
    preset: z.enum(['balanced', 'bold', 'cinematic', 'elegant', 'intimate', 'playful']),
    blend_weights: BlendWeightsModelSchema,
    dimensions: StyleVectorModelSchema,
    dominant_traits: z.array(z.string().min(1)),
    palette_direction: PaletteDirectionModelSchema,
    density_level: z.enum(['low', 'medium', 'high']),
    genre_hint: z.string().min(1),
  })
  .strict();
export const analysisStructureSchema = z
  .object({
    schema_version: z.literal('1.4.0'),
    file: z.string().min(1),
    analysis_meta: AnalysisMetaModelSchema,
    duration_seconds: z.number().finite().gt(0),
    tempo_bpm: z.number().finite().gte(0),
    total_beats: z.number().finite().int().gte(0),
    beat_times: z.array(z.number().finite().gte(0)).max(200000),
    onset_times: z.array(z.number().finite().gte(0)).max(200000),
    energy_timeline: z.array(EnergyPointModelSchema).max(50000),
    sections: z.array(SectionModelSchema).min(1).max(1000),
    key_moments: z.array(KeyMomentModelSchema).max(10000),
    buildups: z.array(BuildupModelSchema).max(10000),
    music_profile: MusicProfileModelSchema,
    show_personality: ShowPersonalityModelSchema,
    firework_cues: z.array(FireworkCueModelSchema).max(200000),
    derived: DerivedFeaturesModelSchema,
    downbeat_times: z.array(z.number().finite().gte(0)).max(200000),
    beats_per_bar: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict();
