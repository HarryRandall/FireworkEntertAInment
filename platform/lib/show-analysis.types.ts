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

export type AnalyzerFinaleWindow = {
  start: number;
  end: number;
};

export type AnalyzerDerivedFeatures = {
  finale_window?: AnalyzerFinaleWindow | null;
  quietest_section_index?: number | null;
  highest_energy_section_index?: number | null;
  repeated_chorus_count?: number;
  section_rank_by_energy?: number[];
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
};

export type ShowAnalysisSnapshot = {
  id: string;
  showId: string;
  status: AnalysisStatus;
  schemaVersion: string | null;
  personalityPreset: string;
  sourceAudioPath: string;
  runtimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  analysis: AnalyzerResult | null;
  derived: AnalyzerDerivedFeatures | null;
  markdown: string | null;
};
