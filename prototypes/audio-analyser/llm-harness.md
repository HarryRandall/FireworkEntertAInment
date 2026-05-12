# LLM Harness Notes for ShowCrafter Audio Analysis

## Why This Exists

`showcrafter.py` already produces data that is useful for an LLM, but the raw output is not yet the final choreography contract.
This document describes how to use the analyser as a reliable upstream stage in a later LLM-based choreography system.

The goal is not to make the LLM rediscover musical structure.
The goal is to make the LLM **consume structured musical evidence** and then combine it with:

- user intent
- budget
- venue constraints
- retailer inventory
- export-format requirements

## Recommended Role Split

Treat the pipeline as three separate jobs:

1. **Audio analyser**
   Produces timing, structure, energy, and style features.
2. **Choreography LLM**
   Decides creative direction, effect pacing, and section-level show logic.
3. **Deterministic post-processor**
   Validates constraints, maps to real inventory, and emits export-ready outputs.

Do not ask the LLM to do all three at once unless you accept lower reliability.

## Recommended Harness Architecture

### Stage 1: Analyse the Song Once

Run:

```bash
python showcrafter.py path/to/song.mp3 --json
```

Store the JSON result.
Do not repeatedly re-run the analyser during iterative prompting unless the song or preset changed.

### Stage 2: Build a Compact LLM Payload

Do not blindly send the entire verbose Markdown report and every raw array into the model.
Instead, create a compact payload that keeps the highest-signal fields.

Recommended always-on fields:

- `duration_seconds`
- `tempo_bpm`
- `sections`
- `key_moments`
- `buildups`
- `music_profile.genre_hint`
- `music_profile.key_signature`
- `music_profile.style_vector`
- `music_profile.dominant_traits`
- `show_personality.preset`
- `show_personality.dimensions`
- `show_personality.palette_direction`
- `show_personality.density_level`

Recommended optional fields:

- `firework_cue_summary`
  Useful for understanding the analyser's suggested density by effect type and section.
- `firework_cue_samples`
  Up to 12 high-signal heuristic cues. Treat these as examples or fallback anchors, not as authoritative choreography.
- `cue_reference`
  Points to `analysis_json.firework_cues` when the complete heuristic cue list is needed.
- `energy_timeline`
  Useful if the model needs macro energy pacing.
- `beat_times`
- `onset_times`
  Only send these when the model needs precise micro-timing.

## Token Strategy

The full beat, onset, energy, and heuristic cue arrays can become expensive.
A good harness should use **progressive disclosure**:

1. first pass: send section summaries, key moments, build-ups, cue summary/samples, and style/personality data
2. second pass: send beat windows only for sections that need dense cue placement
3. final pass: convert approved section plans into exact timed events

This prevents the LLM from wasting context on low-value raw timestamps too early.

## Recommended Inputs Beyond Audio Analysis

The choreography LLM should also receive structured non-audio inputs such as:

- `user_preferences`
  Example: patriotic, romantic, cinematic, playful, dramatic finale
- `budget`
  Hard cap and preferred cap
- `venue_constraints`
  Height limits, noise limits, launch-space assumptions, weather-related caveats
- `inventory`
  Available fireworks with IDs, cost, category, duration, color tags, height, spread, pace, and stock
- `show_constraints`
  Maximum cue count, target density, safety exclusions, export format

If those are unavailable, the model should produce a **plan template** rather than pretending it selected real products.

## Source-of-Truth Rules

The harness should explicitly tell the model:

1. treat analyser timing as authoritative
2. do not invent extra sections
3. do not reorder the song
4. do not invent inventory that is not supplied
5. do not ignore hard budget or venue constraints
6. keep outputs machine-parseable and deterministic

## Suggested Compact Payload Shape

An effective LLM payload can look like this:

```json
{
  "song": {
    "duration_seconds": 214.2,
    "tempo_bpm": 124.0,
    "genre_hint": "edm",
    "key_signature": {
      "root": "A",
      "mode": "minor",
      "confidence": 0.81
    }
  },
  "music_style": {
    "dominant_traits": ["grandeur", "tension", "boldness"],
    "style_vector": {
      "boldness": 0.81,
      "elegance": 0.42,
      "playfulness": 0.36,
      "warmth": 0.33,
      "brightness": 0.58,
      "grandeur": 0.88,
      "tension": 0.79,
      "precision": 0.67
    }
  },
  "show_personality": {
    "preset": "cinematic",
    "density_level": "medium",
    "palette_direction": {
      "primary": "deep_blue",
      "secondary": "silver",
      "accent": "crimson"
    }
  },
  "sections": [
    {
      "index": 1,
      "label": "intro",
      "start": 0.0,
      "end": 18.4,
      "avg_energy": 0.22,
      "intensity": "low"
    },
    {
      "index": 2,
      "label": "verse",
      "start": 18.4,
      "end": 46.8,
      "avg_energy": 0.44,
      "intensity": "medium"
    }
  ],
  "anchors": {
    "key_moments": [],
    "buildups": []
  },
  "firework_cue_summary": {
    "total_count": 42,
    "counts_by_effect": {
      "barrage": 4,
      "accent": 22,
      "crackle": 5,
      "single": 11
    },
    "counts_by_section": []
  },
  "firework_cue_samples": [
    {
      "time": 92.1,
      "effect": "barrage",
      "reason": "climax",
      "energy": 0.91,
      "section": "chorus",
      "palette": "crimson/deep_blue",
      "shape": "layered_chrysanthemum",
      "height": "high",
      "spread": "wide",
      "density": "dense",
      "style_tags": ["grandeur", "tension"],
      "genre_hint": "edm"
    }
  ],
  "cue_reference": {
    "full_cues_source": "analysis_json",
    "json_path": "firework_cues"
  },
  "user_constraints": {},
  "inventory": []
}
```

## Recommended LLM Output Shape

A useful intermediate output is a **show plan**, not yet a final CSV.
For example:

```json
{
  "show_concept": {
    "title": "Cinematic ascent with aggressive finale",
    "overall_rationale": "Use restrained early pacing, build width and height through repeated choruses, and save the densest effects for the final climax."
  },
  "global_rules": {
    "target_density": "medium",
    "palette_strategy": "deep_blue/silver base with crimson accents only at climaxes",
    "inventory_only": true
  },
  "section_plans": [
    {
      "section_index": 1,
      "label": "intro",
      "time_range": [0.0, 18.4],
      "creative_goal": "Establish atmosphere without spending budget early.",
      "density": "sparse",
      "color_direction": ["deep_blue", "silver"],
      "effect_strategy": ["low comets", "gentle mines"],
      "timing_strategy": "Hit only major downbeats and the section exit."
    }
  ],
  "anchor_cues": [
    {
      "time": 92.1,
      "purpose": "first major climax",
      "priority": "high",
      "effect_family": "wide aerial burst"
    }
  ],
  "shopping_intent": {
    "preferred_effect_families": [],
    "avoid_effect_families": []
  }
}
```

This gives the deterministic post-processor something structured to validate and refine.

## Suggested System Prompt

Use something close to this:

```text
You are a pyromusical choreography planner for consumer fireworks shows.
Use the provided song analysis as authoritative timing and structure data.
Do not re-analyse the music from scratch.
Do not invent inventory, safety clearance, or budget that is not provided.
Return only valid JSON matching the requested schema.
Prefer section-level reasoning first, then anchor-cue timing, then product selection logic.
Keep the plan artistically coherent across the whole song instead of treating each cue independently.
```

## Suggested User Prompt Template

Use something like:

```text
Create a choreography plan for the attached song analysis.

Goals:
- Mood: {{mood}}
- Budget cap: {{budget_cap}}
- Venue notes: {{venue_notes}}
- Audience/context: {{audience_context}}
- Special requests: {{special_requests}}

Constraints:
- Use only supplied inventory IDs.
- Respect hard budget and height constraints.
- Use the analyser's section labels, key moments, build-ups, and timing as the source of truth.
- Produce a section-by-section plan and a list of anchor cues.
```

## Guardrails for Better Reliability

### Tell the Model What Not to Do

- do not place a barrage on every detected climax
- do not fill every beat with a cue
- do not spend the full budget before the final third of the song unless requested
- do not use celebratory colors in quiet or tense sections without explicit reason
- do not contradict the supplied personality profile

### Tell the Model What to Prioritise

- strong contrast between low-energy and high-energy sections
- repeated visual language for repeated musical functions
- clear escalation into the final climax or outro
- budget discipline across the whole song
- explanation fields that justify decisions from the provided analysis

## Recommended Deterministic Validators

After the LLM returns a plan, validate:

1. all referenced timestamps fall within song duration
2. all section references exist
3. no inventory IDs are missing from the supplied catalogue
4. budget totals do not exceed the cap
5. no effect violates venue constraints
6. output JSON matches the expected schema
7. color/effect selections are not empty for required sections

If validation fails, prefer a **repair prompt** over re-running the full creative pass.

## Useful Derived Features to Compute Before Prompting

The harness can improve reliability by adding derived fields such as:

- `finale_window`
  Usually last major climax through outro
- `quietest_section`
- `highest_energy_section`
- `repeated_chorus_count`
- `section_rank_by_energy`
- `suggested_budget_weight_by_section`
- `anchor_windows`
  Time windows around climaxes and build-up peaks

These are cheap to compute deterministically and reduce reasoning load on the LLM.

## Common Failure Modes

### Failure: The model ignores section structure

Mitigation:
Ask for a section-by-section plan first and disallow free-form prose output.

### Failure: The model hallucinates products

Mitigation:
Require explicit inventory IDs and reject unknown IDs in validation.

### Failure: The model over-cues the whole song

Mitigation:
Provide a cue budget or density cap per section and ask for escalation discipline.

### Failure: The model treats cue suggestions from `firework_cues` as mandatory

Mitigation:
Explain that analyser cues are hints, not hard instructions.

### Failure: The model reinterprets music timing

Mitigation:
State that the analyser output is authoritative and that the model is not allowed to redefine sections or peaks.

## Practical Recommendation

For early product versions, use a two-pass LLM workflow:

1. pass 1
   Generate section strategy and anchor cues.
2. pass 2
   Map strategy onto actual products and exact timestamps.

That separation will usually be more stable than asking for a final fully populated show file in one step.

## Short Summary

Use this analyser as a factual music-structure stage.
Let the LLM focus on choreography decisions, and let deterministic code handle validation, inventory mapping, and export formatting.
