---
notion-url: https://www.notion.so/Firework-Scripting-Simulation-Research-32ccd8a5bf0880bdb882c91be1b33dff
title: Firework Scripting/Simulation Research
date: '2026-03-23 03:46:00.000'
from_notion: https://www.notion.so/Firework-Scripting-Simulation-Research-32ccd8a5bf0880bdb882c91be1b33dff
author: From Notion
last_edited_time: '2026-04-17 10:53:00.000'
---
🧪 How ShowCrafter emits executable show scripts and how those shows are previewed - both for the MVP (Finale 3D CSV round-trip) and for later phases (in-browser simulation and direct firing-system integration).

[//]: # (table_of_contents is not supported)

---

## 📜 Scripting

### 🟢 Finale 3D Generic CSV · Current MVP target

- **Source of truth**: Finale 3D's documentation ([finale3d.com](http://finale3d.com/)).

- **Shape**: one row per cue with columns for firing timestamp, position, effect / product ID, angle, tilt, safety distance and notes. Product metadata is resolved from the imported database rather than being duplicated in every row.

- **Why it works for us**: a valid CSV plus Robert's database renders a full choreographed show inside Finale 3D, which is enough to validate MVP quality with the stakeholder.

- **What we ship**: [FIR-32 'Build a script to generate sample Finale 3D CSVs from our database'](https://linear.app/fireworkentertainment/issue/FIR-32/build-a-script-to-generate-sample-finale-3d-csvs-from-our-database) produces a CSV from the Supabase catalogue for a given show plan.

### 🔵 Ignite Firing-System Script · Phase 3 target

- **Source of truth**: Ignite Firing Systems designer platform ([ignitefiringsystem.com](http://ignitefiringsystem.com/)).

- **Observed behaviour**: the Ignite designer already supports import / share, so we believe we can round-trip a show via a file format that Ignite accepts. Robert will confirm the exact specification after his 7-8 April meeting with the Ignite team.

- **Why it matters**: Ignite is the consumer-facing firing system Robert's customers already use (GLOW Fireworks exports to it via a 4-letter code). Direct integration is the ultimate distribution path.

- **Current capability**: we can produce a machine-readable plan suitable for Finale 3D and have a plausible path to Ignite; the Ignite spec itself is blocked on Robert.

### 🧩 Firing Plan Structure Inside ShowCrafter

- **Track metadata** (song title, duration, BPM, key, MIR output per section).

- **Cue list** (timestamp, product ID from the Supabase catalogue, position, angle, optional safety distance override).

- **Show metadata** (budget, location, display duration, authoring prompt).

---

## 🎬 Simulation

### 🌐 Browser-Side Simulator

- **Constraints**: must run on a retail tablet or phone, stay at 60 fps during a multi-minute show, load the audio track and cue list without a long boot time, and accept refinement prompts without a full reload.

- **Godot via web export (current frontrunner)**: Godot 4's web export supports the particle system we need for firework bursts, audio-synced playback and exports to WebAssembly. We can pass the mp3 and the cue list in through a JavaScript bridge. Risk: Godot web exports are still heavy (first-load cost) and integration with the Next.js app needs work.

- **Three.js / WebGL (backup)**: a hand-rolled particle system in Three.js gives us finer-grained control over load size and React integration but requires us to implement particle physics and audio sync ourselves.

- **Canvas 2D (fallback)**: lowest fidelity, lowest risk. Suitable as a last resort for devices where WebGL is unavailable.

### 🔄 Data Flow Into the Simulator

1. ShowCrafter emits a cue list and references the product catalogue in Supabase.

1. The simulator pulls the matching animation assets Robert supplied (and any we generate ourselves) to render each cue.

1. Audio is played through the Web Audio API; cues are triggered against the audio clock rather than wall-clock time to avoid drift.

---

## 📎 Sprint 1 Evidence

- Godot spike documented in Harrison's reflection ([Sprint 1 page](https://www.notion.so/333cd8a5bf0880f59cc5dbbb1b0331ac)).

- Finale 3D installation verified on Harrison's machine with Robert's help; CSV import confirmed against the replacement sample database.

---

## ❓ Open Questions for Sprint 2

- Choose between Godot web export and a WebGL-based simulator as the primary path.

- Define a safety-distance baseline for consumer fireworks and surface it in the simulator, since consumer fireworks have no formal regulations (raised by Robert in Meeting 1).

- Prototype rendering for a 'mixed salad' consumer cake (15+ effects over 20 seconds) rather than a single-effect professional shell (raised by Robert in Meeting 2).

