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
	- Energy timeline
	- Song structure segmentation (intro / verse / chorus / bridge / outro)
	- Key moments (builds and climaxes)
	- Build-up detection
- Personality-driven show design:
	- 8 quantified style dimensions: `boldness`, `elegance`, `playfulness`, `warmth`, `brightness`, `grandeur`, `tension`, `precision`
	- 6 presets: `balanced`, `bold`, `elegant`, `playful`, `cinematic`, `intimate`
	- Music style + selected preset are blended into a final `show_personality`
- Style-aware cue scheduling:
	- Cue density changes by section and personality
	- Adds syncopated onset accents for suitable styles/genres
	- Not limited to fixed `%2 / %4 / %8` beat patterns
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
```

Arguments:

- `path_to_audio` (optional): path to input audio file. Default: `song.mp3`
- `--json`: print full analysis JSON to stdout
- `--play`: launch live terminal playback visualizer
- `--personality PRESET`: choose show personality preset

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

By default, ShowCrafter writes:

- `<song_name>_analysis.md`

The Markdown report includes:

- Overview (duration, tempo, beats, key moments, genre hint, key/mode)
- Personality Mapping (music vs. show scores for all 8 dimensions)
- Song structure table and section details
- Key moments and build-ups
- Energy timeline graph
- Firework cue table with style fields (`palette`, `shape`, `height`)
- Full beat/onset timestamp lists

When `--json` is enabled, it also prints the full analysis object, including:

- `music_profile`
- `show_personality`
- `firework_cues`

## Supporting Documentation

In addition to the Python prototype itself, this folder now includes two documents intended to make later development easier:

- `agent.md`
  Use this when maintaining or extending the analyser. It documents the current pipeline, important output fields, and the compatibility rules that downstream systems may depend on.
- `llm-harness.md`
  Use this when integrating the analyser with a later choreography LLM. It describes recommended payload shapes, token strategy, prompt structure, validation rules, and common failure modes.

## Notes

- Best results come from clear, full-length music tracks.
- Generated cues are creative suggestions and should be adapted to your firework inventory, venue limits, and safety rules.
