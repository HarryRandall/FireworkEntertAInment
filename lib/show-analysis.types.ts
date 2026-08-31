/**
 * Shared types for music analysis results.
 *
 * These mirror the JSON shape produced by `services/music-analyser/showcrafter.py` plus a
 * thin "snapshot" wrapper used by server reads. Pure types — safe to import
 * from both server and client code.
 */

/** Lifecycle state of an analyser run. */
export type AnalysisStatus = 'running' | 'completed' | 'failed';

export type AnalyserEnergyPoint = {
  time: number;
  energy: number;
};

export type AnalyserSection = {
  start: number;
  end: number;
  duration: number;
  avg_energy: number;
  peak_energy: number;
  intensity: 'low' | 'medium' | 'high';
  cluster_id: number;
  label: string;
};

export type AnalyserKeyMoment = {
  time: number;
  energy: number;
  prominence: number;
  type: 'build' | 'climax';
};

export type AnalyserBuildup = {
  start: number;
  peak: number;
  duration: number;
  energy_rise: number;
};

export type AnalyserFireworkCue = {
  time: number;
  end?: number;
  effect: string;
  reason?: string;
  energy?: number;
  section?: string;
  palette?: string;
  shape?: string;
  height?: string;
  spread?: string;
  density?: string;
  style_tags?: string[];
  genre_hint?: string;
};

export type AnalyserTimingBreakdown = {
  download_ms: number;
  decode_ms: number;
  beat_ms: number;
  energy_ms: number;
  onset_ms: number;
  section_ms: number;
  profile_ms: number;
  validation_ms: number;
  total_ms: number;
};

export type AnalyserAnalysisMeta = {
  mode: 'fast' | string;
  runner_version: string;
  timings_ms: AnalyserTimingBreakdown;
};

export type AnalyserMusicProfile = {
  genre_hint?: string;
  key_signature?: {
    root?: string;
    mode?: string;
    confidence?: number;
  };
  dominant_traits?: string[];
  style_vector?: Record<string, number>;
  descriptors?: Record<string, number>;
  raw_metrics?: {
    tempo_bpm: number;
    onset_density_per_sec: number;
    key_moments_per_min: number;
    buildups_per_min: number;
    beat_stability: number;
    section_contrast: number;
    bass_ratio: number;
  };
};

export type AnalyserShowPersonality = {
  preset?: string;
  blend_weights?: {
    user: number;
    music: number;
  };
  dominant_traits?: string[];
  dimensions?: Record<string, number>;
  palette_direction?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  density_level?: 'low' | 'medium' | 'high' | string;
  genre_hint?: string;
};

export type AnalyserFinaleWindow = {
  start: number;
  end: number;
};

export type AnalyserAnchorWindow = {
  type: 'climax' | 'buildup' | string;
  anchor_time: number;
  start: number;
  end: number;
  energy?: number;
  energy_rise?: number;
};

export type AnalyserDerivedFeatures = {
  finale_window?: AnalyserFinaleWindow | null;
  quietest_section_index?: number | null;
  highest_energy_section_index?: number | null;
  repeated_chorus_count?: number;
  section_rank_by_energy?: number[];
  anchor_windows?: AnalyserAnchorWindow[];
};

export type AnalyserResult = {
  schema_version: string;
  file: string;
  analysis_meta?: AnalyserAnalysisMeta;
  duration_seconds: number;
  tempo_bpm: number;
  total_beats: number;
  energy_timeline: AnalyserEnergyPoint[];
  sections: AnalyserSection[];
  key_moments: AnalyserKeyMoment[];
  buildups: AnalyserBuildup[];
  beat_times?: number[];
  onset_times?: number[];
  /** Bar grid (schema 1.4.0). Absent on older 1.3.0 analyses. */
  downbeat_times?: number[];
  beats_per_bar?: number;
  derived?: AnalyserDerivedFeatures;
  music_profile?: AnalyserMusicProfile;
  show_personality?: AnalyserShowPersonality;
  firework_cues?: AnalyserFireworkCue[];
};

export type CueGenerationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type ShowAnalysisSnapshot = {
  id: string;
  showId: string;
  status: AnalysisStatus;
  schemaVersion: string;
  personality: string;
  audioPath: string;
  runnerVersion: string | null;
  runtimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  contextMarkdown: string | null;
  analysis: AnalyserResult | null;
  cueGenerationStatus: CueGenerationStatus;
  cueGenerationError: string | null;
  cueCount: number | null;
};
