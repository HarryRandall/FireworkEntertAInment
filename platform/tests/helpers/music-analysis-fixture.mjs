const styleVector = {
  boldness: 0.6,
  elegance: 0.5,
  playfulness: 0.4,
  warmth: 0.5,
  brightness: 0.5,
  grandeur: 0.7,
  tension: 0.4,
  precision: 0.6,
};

const descriptors = {
  energy: 0.5,
  drive: 0.6,
  brightness: 0.5,
  warmth: 0.5,
  tension: 0.4,
  grandeur: 0.7,
  playfulness: 0.4,
  precision: 0.6,
  dynamic_range: 0.5,
  bass_impact: 0.5,
  section_contrast: 0.2,
};

export function makeAnalysisFixture(profile) {
  const interval = profile.tempo > 0 ? 60 / profile.tempo : 0;
  const beatTimes = interval
    ? Array.from({ length: Math.floor((profile.duration - interval) / interval) }, (_, index) =>
        Number(((index + 1) * interval).toFixed(3)),
      )
    : [];
  const downbeatTimes = beatTimes.filter((_, index) => index % 4 === 0);
  const rankedSections = profile.sections
    .map((section, index) => ({ index, energy: section.energy }))
    .sort((left, right) => right.energy - left.energy)
    .map(({ index }) => index);
  const quietest = [...rankedSections].reverse()[0];

  return {
    schema_version: '1.4.0',
    file: `${profile.name}.mp3`,
    analysis_meta: {
      mode: 'fast',
      runner_version: 'fixture-librosa',
      timings_ms: {
        download_ms: 1,
        decode_ms: 2,
        beat_ms: 3,
        energy_ms: 4,
        onset_ms: 5,
        section_ms: 6,
        profile_ms: 7,
        validation_ms: 1,
        total_ms: 29,
      },
    },
    duration_seconds: profile.duration,
    tempo_bpm: profile.tempo,
    total_beats: beatTimes.length,
    beat_times: beatTimes,
    onset_times: beatTimes.filter((_, index) => index % 2 === 0),
    downbeat_times: downbeatTimes,
    beats_per_bar: 4,
    energy_timeline: profile.sections.map((section) => ({
      time: section.start,
      energy: section.energy,
    })),
    sections: profile.sections.map((section, index) => ({
      start: section.start,
      end: section.end,
      duration: section.end - section.start,
      avg_energy: section.energy,
      peak_energy: Math.min(1, section.energy + 0.08),
      intensity: section.intensity,
      cluster_id: index,
      label: section.label,
    })),
    key_moments: [{ time: profile.climax, energy: 0.92, prominence: 0.75, type: 'climax' }],
    buildups: [
      {
        start: Math.max(0, profile.climax - 6),
        peak: profile.climax,
        duration: Math.min(6, profile.climax),
        energy_rise: 0.5,
      },
    ],
    music_profile: {
      genre_hint: profile.genre,
      key_signature: { root: 'C', mode: 'major', confidence: 0.7 },
      descriptors,
      style_vector: styleVector,
      dominant_traits: ['grandeur', 'precision'],
      raw_metrics: {
        tempo_bpm: profile.tempo,
        onset_density_per_sec: beatTimes.length / profile.duration,
        key_moments_per_min: 60 / profile.duration,
        buildups_per_min: 60 / profile.duration,
        beat_stability: profile.tempo > 0 ? 0.8 : 0,
        section_contrast: 0.5,
        bass_ratio: 1,
      },
    },
    show_personality: {
      preset: 'balanced',
      blend_weights: { user: 0.55, music: 0.45 },
      dimensions: styleVector,
      dominant_traits: ['grandeur', 'precision'],
      palette_direction: { primary: 'gold', secondary: 'silver', accent: 'blue' },
      density_level: profile.tempo >= 120 ? 'high' : 'medium',
      genre_hint: profile.genre,
    },
    firework_cues: [],
    derived: {
      finale_window: { start: profile.finaleStart, end: profile.duration },
      quietest_section_index: quietest,
      highest_energy_section_index: rankedSections[0],
      repeated_chorus_count: profile.sections.filter((section) => section.label === 'chorus')
        .length,
      section_rank_by_energy: rankedSections,
      anchor_windows: [
        {
          type: 'climax',
          anchor_time: profile.climax,
          start: Math.max(0, profile.climax - 4),
          end: Math.min(profile.duration, profile.climax + 4),
          energy: 0.92,
        },
      ],
    },
  };
}
