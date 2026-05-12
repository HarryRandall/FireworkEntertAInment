# ShowCrafter: Music Analysis for Pyromusical Cueing

ShowCrafter analyzes a song and generates style-aware firework cue suggestions.
It extracts rhythm, structure, and musical character from audio, then maps them into a usable show plan in Markdown (and optional JSON).

## Folder Contents

This folder contains the current Python prototype for ShowCrafter's audio-analysis pipeline and the supporting documentation needed to maintain and extend it.

- `showcrafter.py`
  Main analysis script. It loads an audio file, extracts musical structure and style information, and produces firework cue suggestions plus Markdown/JSON outputs.
- `requirements.txt`
  Python dependency list for the librosa/scipy/scikit-learn analysis stack and optional playback tools.
- `README.md`
  High-level overview of the prototype, installation steps, CLI usage, and output summary.
- `agent.md`
  Maintenance and architecture guide for future contributors or agents working on this prototype. It explains the pipeline, output contract, compatibility expectations, and safe extension points.
- `llm-harness.md`
  Design notes for downstream LLM integration. It explains how to package this analyser's outputs for a choreography model, what fields to send, how to structure prompts, and how to validate model outputs.
- `llm-test-results/`
  Example analysis outputs for three real songs. Each example contains the full analysis JSON (`_analysis.json`), the human-readable Markdown report (`_analysis.md`), the compact LLM payload (`_llm.json`), and a `payload*.json` alias used by older harness notes.

## What This Prototype Covers

This folder is currently focused on the **music analysis and cue suggestion** stage of the wider ShowCrafter system.

It is responsible for:

- extracting beats, onsets, energy curves, section boundaries, climaxes, and build-ups from audio
- inferring a music personality profile and blending it with a selected show preset
- generating heuristic firework cue suggestions
- producing outputs that are useful for both human review and later LLM-driven choreography

It does **not** yet handle:

- real inventory selection
- budget optimisation
- safety validation
- Finale 3D export
- full end-to-end choreography authoring

## Core Features

- Automatic music analysis from audio:
	- Tempo and beat timeline
	- Onset (hit/transient) timeline
	- Energy timeline (RMS, normalised with 5th/95th percentile clipping, then smoothed for stability on compressed mixes)
	- Song structure segmentation via Laplacian spectral clustering (intro / verse / chorus / bridge / outro)
	- Key moments (builds and climaxes) — climaxes are prominence-ranked, section-aware, spaced, and capped for usable choreography
	- Build-up detection (rise threshold is relative to the song's own dynamic range, with noisy duplicate ramps filtered)
- Personality-driven show design:
	- 8 quantified style dimensions: `boldness`, `elegance`, `playfulness`, `warmth`, `brightness`, `grandeur`, `tension`, `precision`
	- 6 presets: `balanced`, `bold`, `elegant`, `playful`, `cinematic`, `intimate`
	- Music style + selected preset are blended into a final `show_personality`
- Style-aware cue scheduling:
	- Cue density changes by section and personality
	- Adds syncopated onset accents for suitable styles/genres
	- Not limited to fixed `%2 / %4 / %8` beat patterns
- Section intensity classification:
	- `high` / `medium` / `low` thresholds are derived from the song's own energy distribution (40th and 70th percentiles), not fixed values
- Visual recommendation per cue:
	- `palette`, `shape`, `height`, `spread`, `density`, `section`
- Rich output:
	- Human-readable Markdown report
	- Optional machine-readable JSON
	- Optional terminal live player (`--play`) with section and cue display

## New Personality-Oriented Additions

This version introduces a measurable personality workflow:

- `music_profile` now includes:
	- `genre_hint`
	- `key_signature` (root/mode/confidence)
	- `descriptors`
	- `style_vector` (8-dimensional scores)
- `show_personality` now includes:
	- Selected preset
	- Blend weights
	- Final blended dimension scores
	- Dominant traits
	- Palette direction
	- Cue density level
- Markdown report now includes a `Personality Mapping` section and expanded cue table columns.

## Installation

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## CLI Usage

```bash
python showcrafter.py [path_to_audio] [--json] [--play] [--personality PRESET]
                      [--analysis-out PATH] [--markdown-out PATH]
                      [--llm-out PATH] [--no-json-file]
```

Arguments:

- `path_to_audio` (optional): path to input audio file. Default: `song.mp3`
- `--json`: also print the full analysis JSON to stdout
- `--play`: launch live terminal playback visualizer
- `--personality PRESET`: choose show personality preset
- `--analysis-out PATH`: override the full analysis JSON output path (default: `<song>_analysis.json`)
- `--markdown-out PATH`: override the Markdown report output path (default: `<song>_analysis.md`)
- `--llm-out PATH`: override the compact LLM payload JSON output path (default: `<song>_llm.json`)
- `--no-json-file`: skip writing both JSON files (Markdown only)

Allowed personality presets:

- `balanced`
- `bold`
- `elegant`
- `playful`
- `cinematic`
- `intimate`

## Example Commands

```bash
python showcrafter.py song.mp3
python showcrafter.py song.mp3 --json
python showcrafter.py song.mp3 --play
python showcrafter.py song.mp3 --personality cinematic
python showcrafter.py song.mp3 --personality bold --json
python showcrafter.py song.mp3 --play --personality elegant
```

## Output

By default, ShowCrafter writes three files alongside each run:

- `<song_name>_analysis.md` — verbose human-readable report
- `<song_name>_analysis.json` — full analysis result, schema-stable, suitable for programmatic post-processing
- `<song_name>_llm.json` — **compact, token-efficient payload** for downstream LLM consumption (shape per `llm-harness.md`)

All JSON outputs include a top-level `schema_version` field so downstream harnesses can gate compatibility. The current version is **`1.2.0`**.

Both JSON outputs are validated with Pydantic before they are written. Invalid output fails the CLI with a `Validation error:` message instead of silently emitting a drifting contract.

#### Schema changelog

- **1.2.0** — Added Pydantic validation for the full analysis JSON and compact LLM payload. The compact LLM payload no longer duplicates the full heuristic cue list as `firework_cues_baseline`; it now emits `firework_cue_summary`, up to 12 `firework_cue_samples`, and `cue_reference` pointing to `analysis_json.firework_cues`. The smoothed energy curve is clamped back to `0.0-1.0` after filtering so downstream scores stay in range.
- **1.1.0** — Added `key_moments[].prominence`. Reclassified `key_moments[].type` from an absolute `energy > 0.8` threshold to relative prominence ranking (top quartile = `climax`). This fixes zero-climax output on heavily compressed mixes (modern EDM / pop).
- **1.0.0** — Initial versioned contract.

#### FIR-39 tuning notes

- Energy timeline output now uses the smoothed/clamped RMS curve, and section `peak_energy` uses a robust 90th percentile rather than a single-frame max. This avoids every compressed section reporting a peak of `1.0`.
- Climax selection now prefers spaced peaks in chorus/bridge/high-intensity sections and caps the count by song duration. This keeps early repeated loudness pulses from being mislabeled as climaxes.
- Build-up anchors are filtered by spacing and energy rise so the compact payload stays useful instead of listing every nearby ramp.

The Markdown report includes:

- Overview (duration, tempo, beats, key moments, genre hint, key/mode)
- Personality Mapping (music vs. show scores for all 8 dimensions)
- Song structure table and section details
- Key moments and build-ups
- Energy timeline graph
- Firework cue table with style fields (`palette`, `shape`, `height`)
- Full beat/onset timestamp lists

The full analysis JSON mirrors the in-memory result object (sections, beats, onsets, energy timeline, music profile, show personality, firework cues, etc.). Each `key_moments` entry includes `time`, `energy`, `prominence`, and `type` (`climax` or `build`).

The compact LLM payload contains only the highest-signal fields plus pre-computed derived features (`finale_window`, `quietest_section_index`, `highest_energy_section_index`, `repeated_chorus_count`, `section_rank_by_energy`, `anchor_windows`) and placeholder `user_constraints` / `inventory` blocks for the next stage to populate. It deliberately omits raw beat/onset/energy arrays and the full heuristic cue list — fetch those from the full analysis JSON when micro-timing or every baseline cue is needed.

When `--json` is enabled, the full analysis JSON is **also** echoed to stdout (in addition to the file) for programmatic piping. Use `--no-json-file` if you only want the Markdown.

## Supporting Documentation

In addition to the Python prototype itself, this folder now includes two documents intended to make later development easier:

- `agent.md`
  Use this when maintaining or extending the analyser. It documents the current pipeline, important output fields, and the compatibility rules that downstream systems may depend on.
- `llm-harness.md`
  Use this when integrating the analyser with a later choreography LLM. It describes recommended payload shapes, token strategy, prompt structure, validation rules, and common failure modes.

## Notes

- Best results come from clear, full-length music tracks.
- Generated cues are creative suggestions and should be adapted to your firework inventory, venue limits, and safety rules.
