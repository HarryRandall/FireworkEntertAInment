# ShowCrafter Audio Analyser Agent Guide

## Purpose

This prototype is the music-analysis front end for ShowCrafter.
Its job is to turn a single audio track into structured timing, section, energy, and style data that a downstream choreography system can trust.

Today, the prototype does **not** produce a final retail-ready show.
It produces:

- deterministic-enough music analysis
- heuristic firework cue suggestions
- a Markdown report for humans and LLMs
- optional JSON for programmatic downstream use

The analyser is therefore best treated as a **pre-processor for a later choreography agent**, not as the final creative decision-maker.

## Product Context

At the project level, ShowCrafter is intended to:

1. accept a song plus user constraints
2. analyse the music structure
3. combine that structure with user intent and firework inventory
4. generate a choreographed show plan
5. later export outputs such as PDF guides and Finale 3D-compatible data

This prototype currently covers step 2 and a lightweight approximation of step 3.

## Scope

### In Scope

- loading one audio file
- estimating tempo and beat locations
- detecting onsets and energy changes
- segmenting the song into musical sections
- identifying climaxes and build-ups
- inferring a music personality profile
- blending that profile with a selected show preset
- generating heuristic cue suggestions
- writing Markdown and optional JSON output
- optionally playing a terminal visualiser

### Out of Scope

- retailer inventory selection
- pricing and budget optimisation
- venue/safety rule validation
- finale scripting or firing hardware formats
- multi-song medleys
- human revision workflow
- persistence, APIs, queues, or web integration

## Working Files

- `showcrafter.py`
  Main prototype implementation.
- `requirements.txt`
  Python dependencies for the analysis stack.
- `README.md`
  Human-facing usage overview.
- `agent.md`
  This file. Use it as the maintenance and architecture guide.
- `llm-harness.md`
  Downstream guidance for using this analyser inside a later LLM pipeline.

## Quick Start

```bash
cd prototypes/audio-analyser
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python showcrafter.py song.mp3
python showcrafter.py song.mp3 --json
python showcrafter.py song.mp3 --personality cinematic
python showcrafter.py song.mp3 --play
```

Default output:

- `<song_name>_analysis.md`

Optional stdout output:

- full JSON result with `--json`

## Pipeline Overview

The core orchestration function is `analyse_song()`.
Its current flow is:

1. load mono audio with `librosa`
2. estimate tempo and beat frames
3. compute RMS energy and downsample it into a coarse energy timeline
4. detect onsets
5. segment musical structure via Laplacian spectral clustering
6. detect key moments from energy peaks
7. detect build-ups from sustained rising energy ramps
8. infer a music personality profile
9. blend music personality with a selected show preset
10. generate heuristic firework cue suggestions
11. return a structured result object

## Architecture Map

### Analysis Functions

- `analyse_song(...)`
  Main orchestration entry point.
- `laplacian_segment(...)`
  Beat-synchronised structural segmentation using CQT + MFCC features.
- `detect_buildups(...)`
  Finds sustained energy ramps before peaks.
- `analyse_music_personality(...)`
  Converts raw features into style descriptors and an 8-dimensional style vector.
- `build_show_personality(...)`
  Blends the inferred music style with a user-selected preset.

### Cueing Functions

- `generate_firework_cues(...)`
  Produces heuristic cue events from sections, peaks, build-ups, and beat logic.
- `style_firework_cue(...)`
  Adds palette, shape, height, spread, density, and section labels to each cue.
- `cue_steps_from_personality(...)`
  Sets cue density rules from the blended personality profile.

### Output Functions

- `write_markdown(...)`
  Writes an LLM-readable Markdown report.
- `live_player(...)`
  Plays audio with a terminal visualisation overlay.

## Core Output Contract

Downstream systems should assume the top-level result object contains:

- `file`
- `duration_seconds`
- `tempo_bpm`
- `total_beats`
- `beat_times`
- `onset_times`
- `energy_timeline`
- `sections`
- `key_moments`
- `buildups`
- `music_profile`
- `show_personality`
- `firework_cues`

### `sections[]`

Each section currently includes:

- `start`
- `end`
- `duration`
- `avg_energy`
- `peak_energy`
- `intensity`
- `cluster_id`
- `label`

Expected labels today include:

- `intro`
- `verse`
- `pre-chorus`
- `chorus`
- `bridge`
- `outro`
- `unknown`

### `key_moments[]`

Each moment currently includes:

- `time`
- `energy`
- `type`

Expected `type` values today:

- `build`
- `climax`

### `buildups[]`

Each build-up currently includes:

- `start`
- `peak`
- `duration`
- `energy_rise`

### `music_profile`

This currently includes:

- `genre_hint`
- `key_signature`
- `descriptors`
- `style_vector`
- `dominant_traits`
- `raw_metrics`

### `show_personality`

This currently includes:

- `preset`
- `blend_weights`
- `dimensions`
- `dominant_traits`
- `palette_direction`
- `density_level`
- `genre_hint`

### `firework_cues[]`

Each cue currently includes:

- `time`
- `effect`
- `reason`
- `energy`
- `section`
- `palette`
- `shape`
- `height`
- `spread`
- `density`

Some cues also include:

- `end`

Expected `effect` values today:

- `barrage`
- `accent`
- `crackle`
- `single`

## Compatibility Rules

If you modify this prototype, treat the following as stability rules unless you are intentionally versioning the schema:

1. Do not rename existing top-level keys casually.
2. Do not change the meaning of `sections`, `key_moments`, `buildups`, or `firework_cues` without updating downstream docs.
3. Prefer **adding fields** over replacing fields.
4. Keep `effect` names stable unless the downstream harness is updated in the same change.
5. Preserve the current preset names unless there is a deliberate migration plan.
6. Keep output JSON serialisable without custom encoders.

## Design Assumptions

- The analyser is heuristic, not ground-truth musicology.
- Section labels are estimated from clustering plus energy heuristics.
- Personality scores are soft signals intended for downstream creative use.
- Cue generation is suggestive, not physically validated or inventory-aware.
- Markdown readability matters because the report is explicitly intended for LLM consumption.

## Maintenance Guidance

### When Making Changes

- keep the pipeline easy to inspect end-to-end
- prefer explicit heuristics over opaque complexity unless accuracy gains are clear
- preserve determinism where possible
- document any schema changes in `README.md` and `llm-harness.md`
- keep the Markdown report aligned with the JSON contract

### Good Candidate Improvements

- inventory-aware cue generation
- better section naming confidence
- multi-pass climax/finale detection
- richer cue metadata for export targets
- compact machine-facing summary output separate from the verbose Markdown report
- formal schema validation for JSON output

### Risky Changes

- changing section label semantics
- replacing the cue taxonomy without a migration plan
- removing raw timing arrays before the LLM harness is redesigned
- adding randomness that breaks reproducibility
- making the Markdown output much less structured

## Recommended Validation After Changes

Run at least:

```bash
python showcrafter.py song.mp3
python showcrafter.py song.mp3 --json
python showcrafter.py song.mp3 --personality bold
```

Manually verify:

1. Markdown still writes successfully.
2. JSON still serialises cleanly.
3. All expected top-level keys are present.
4. Section labels remain plausible.
5. Cue counts are non-zero for a typical full-length song.
6. Personality fields remain bounded in `0.0..1.0` where expected.

## Agent Notes

If you are an implementation agent working in this folder:

- treat `showcrafter.py` as the source of truth for current behaviour
- do not assume this prototype already reflects inventory, safety, or retailer constraints
- do not overfit the code to one track unless you are explicitly creating a demo
- optimise for stable downstream consumption more than visual cleverness
- if you change output structure, update downstream harness docs in the same commit

## Short Summary

This folder is the bridge between raw audio and later pyromusical planning.
Protect the timing data, protect the schema, and keep the output easy for a downstream LLM pipeline to consume.
