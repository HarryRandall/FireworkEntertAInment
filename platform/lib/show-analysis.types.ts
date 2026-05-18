import type { Json } from "@/lib/database.types";

export type AnalysisStatus = "running" | "completed" | "failed";

export type AnalyzerEnergyPoint = {
  time: number;
  energy: number;
};

export type AnalyzerSection = {
  start: number;
  end: number;
  duration: number;
  avg_energy: number;
  peak_energy: number;
  intensity: "low" | "medium" | "high";
  cluster_id: number;
  label: string;
};

export type AnalyzerKeyMoment = {
  time: number;
  energy: number;
  prominence: number;
  type: "build" | "climax";
};

export type AnalyzerBuildup = {
  start: number;
  peak: number;
  duration: number;
  energy_rise: number;
};

export type AnalyzerFireworkCue = {
  time: number;
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

export type AnalyzerMusicProfile = {
  genre_hint?: string;
  key_signature?: {
    root?: string;
    mode?: string;
    confidence?: number;
  };
  dominant_traits?: string[];
  style_vector?: Record<string, number>;
  descriptors?: Record<string, number>;
};

export type AnalyzerShowPersonality = {
  preset?: string;
  dominant_traits?: string[];
  dimensions?: Record<string, number>;
  palette_direction?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  density_level?: "low" | "medium" | "high" | string;
};

export type AnalyzerFinaleWindow = {
  start: number;
  end: number;
};

export type AnalyzerAnchorWindow = {
  type: "climax" | "buildup" | string;
  anchor_time: number;
  start: number;
  end: number;
  energy?: number;
  energy_rise?: number;
};

export type AnalyzerDerivedFeatures = {
  finale_window?: AnalyzerFinaleWindow | null;
  quietest_section_index?: number | null;
  highest_energy_section_index?: number | null;
  repeated_chorus_count?: number;
  section_rank_by_energy?: number[];
  anchor_windows?: AnalyzerAnchorWindow[];
};

export type AnalyzerResult = {
  schema_version: string;
  file: string;
  duration_seconds: number;
  tempo_bpm: number;
  total_beats: number;
  energy_timeline: AnalyzerEnergyPoint[];
  sections: AnalyzerSection[];
  key_moments: AnalyzerKeyMoment[];
  buildups: AnalyzerBuildup[];
  beat_times?: number[];
  onset_times?: number[];
  music_profile?: AnalyzerMusicProfile;
  show_personality?: AnalyzerShowPersonality;
  firework_cues?: AnalyzerFireworkCue[];
};

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
  analysis: AnalyzerResult | null;
  llmPayload: Json | null;
  markdown: string | null;
};
