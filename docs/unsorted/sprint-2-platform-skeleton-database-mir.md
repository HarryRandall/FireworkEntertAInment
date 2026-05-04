---
notion-url: https://www.notion.so/Sprint-2-Platform-Skeleton-Database-MIR-345cd8a5bf0881139db2e8370f553d76
title: Sprint 2 - Platform Skeleton, Database & MIR
from_notion: https://www.notion.so/Sprint-2-Platform-Skeleton-Database-MIR-345cd8a5bf0881139db2e8370f553d76
author: From Notion
last_edited_time: '2026-05-04 06:22:00.000'
date: '2026-04-17 10:30:00.000'
---
[//]: # (column_list is not supported)

	[//]: # (column is not supported)

			[//]: # (column is not supported)

			[//]: # (column is not supported)

		[//]: # (table_of_contents is not supported)

---

## Sprint Context

---

## Planned Deliverables

 | Theme | Deliverable | Owner | Linear | Status | Evidence | 
 | ---- | ---- | ---- | ---- | ---- | ---- | 
 | Platform | ShowCrafter design system - tokens, Lucide icons, component pack | Harry | [FIR-60](https://linear.app/fireworkentertainment/issue/FIR-60/design-system-skill-pack), [FIR-61](https://linear.app/fireworkentertainment/issue/FIR-61/ui-marketing-app-component-pack), [FIR-63](https://linear.app/fireworkentertainment/issue/FIR-63/foundation-refactor-tokens-lucide-deps-drop-material-symbols) | Delivered | [PR #80](https://github.com/HarryRandall/FireworkEntertAInment/pull/80), [PR #81](https://github.com/HarryRandall/FireworkEntertAInment/pull/81), [PR #82](https://github.com/HarryRandall/FireworkEntertAInment/pull/82) | 
 | Platform | `(marketing)`, `(app)`, `(dev)` route groups + redesigned landing / login / dashboard / shows pages on the new component pack | Harry | [FIR-62](https://linear.app/fireworkentertainment/issue/FIR-62/route-groups-marketing-app-dev), [FIR-64](https://linear.app/fireworkentertainment/issue/FIR-64/rebuild-landing-and-add-login-on-the-new-component-pack), [FIR-65](https://linear.app/fireworkentertainment/issue/FIR-65/authenticated-app-pages-dashboard-new-show-show-editor-sub-routes) | Delivered | [PR #83](https://github.com/HarryRandall/FireworkEntertAInment/pull/83), [PR #84](https://github.com/HarryRandall/FireworkEntertAInment/pull/84), [PR #85](https://github.com/HarryRandall/FireworkEntertAInment/pull/85) | 
 | Platform | Authentication flow on Next.js + Supabase (login, signup, OAuth callback, password reset, `proxy.ts` route guard) | Harry | [FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-56](https://linear.app/fireworkentertainment/issue/FIR-56/implement-supabase-authentication-flow) | Delivered | [PR #96](https://github.com/HarryRandall/FireworkEntertAInment/pull/96), [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) | 
 | Platform | Live-data wiring — dashboard, show detail, timeline, shopping list reading from Supabase; `/shows/new` server action with audio upload | Harry | [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface), [FIR-55](https://linear.app/fireworkentertainment/issue/FIR-55/build-catalogue-api-routes-backed-by-supabase), [FIR-57](https://linear.app/fireworkentertainment/issue/FIR-57/connect-platform-ui-to-live-database-data) | Delivered | [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) | 
 | Platform | Marketing landing rebuild - 3D WebGL hero, light/dark theme, interactive stepper, VendorNetwork map, branded 404, Vercel deploy fix | Harry | — | Delivered | [PR #94](https://github.com/HarryRandall/FireworkEntertAInment/pull/94), [PR #95](https://github.com/HarryRandall/FireworkEntertAInment/pull/95), commits `65f8186` → `862fa3f` | 
 | Database | Schema for `profiles`, `shows`, `show_cues`, `shopping_list_items` with RLS scoped to `auth.uid()` and a private `audio` storage bucket | Harry | [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface) | Delivered | [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) | 
 | Database | Evaluate DB options and lock choice; finalise schema for fireworks and shows | Liam | [FIR-25](https://linear.app/fireworkentertainment/issue/FIR-25/evaluate-database-options-for-backend-storage) | Delivered | Choice locked (Supabase / Postgres + RLS); product-side schema finalised in PR #100; catalogue side still open with Liam | 
 | Database | Ingest Robert's updated Finale 3D CSV and re-format in Supabase | Liam | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) | Delivered | Awaiting latest catalogue file from Robert | 
 | MIR | Select core MIR libraries / APIs and wire them into the audio analyser prototype | Fang | [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis) | In progress | Preprocessing module + LLM harness landed; final library selection ongoing | 
 | MIR | Improve audio analysis granularity and model generalisation; map to mood/energy profile | Fang | [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | In progress | Cue generation + Markdown / JSON output now in `showcrafter.py` | 
 | Simulation | Prototype browser-side firework simulation spike (Godot vs WebGL vs canvas) | Harrison | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) | In progress | Godot 2D particle spike running with two effect families | 
 | Simulation | Working Finale 3D CSV round-trip (import Robert's CSV, render a demo) | Harrison | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv) (export track; split into tighter GitHub issues as needed) | In progress | VDL / CSV field mapping next | 
 | Process | Sprint 2 docs — env vars, migrations, Notion ↔ GitHub sync, Linear close-outs | Harry | [FIR-53](https://linear.app/fireworkentertainment/issue/FIR-53/backfill-sprint-2-scrum-1-platform-progress-notes), [FIR-58](https://linear.app/fireworkentertainment/issue/FIR-58/document-sprint-2-platform-setup-and-next-steps) | Delivered | [PR #97](https://github.com/HarryRandall/FireworkEntertAInment/pull/97), `CLAUDE.md` updates in PR #100 | 

---

## What We Did

- **Platform shipped**: design-system tokens, Lucide/shadcn primitives, marketing/app/dev route groups, redesigned landing/auth/dashboard/show pages, protected routes, Supabase auth, live show data, and private audio storage ([FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface), [FIR-57](https://linear.app/fireworkentertainment/issue/FIR-57/connect-platform-ui-to-live-database-data), [FIR-78](https://linear.app/fireworkentertainment/issue/FIR-78/migrate-platform-ui-primitives-to-shadcn-with-showcrafter-aligned-theming)).

- **Stakeholder demo shipped**: Meeting 6 showed Robert the app shell, catalogue/admin direction, reconstruction workflow, and renderer. The key correction was to keep simulation useful but secondary to a Finale 3D-importable CSV MVP ([FIR-75](https://linear.app/fireworkentertainment/issue/FIR-75/record-stakeholder-meeting-6-scrum-3-and-csv-mvp-backlog-alignment), [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv)).

- **Database/admin path matured**: Supabase/Postgres remained the selected data layer, supplier/catalogue helpers progressed, and Meeting 6 created a new approval requirement before reconstructed items become consumer-facing ([FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [FIR-50](https://linear.app/fireworkentertainment/issue/FIR-50/catalogue-config-documentation), [FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79/implement-stakeholder-approval-workflow-for-reconstructed-catalogue)).

- **MIR progressed**: the analyser now has versioned JSON/Markdown outputs, relative-threshold tuning, test fixtures, and a clear next contract step before website integration ([FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization), [FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12)).

---

## Rubric Coverage

 | Rubric area | How Sprint 2 answers it | Evidence | 
 | ---- | ---- | ---- | 
 | Stakeholder Engagement (20%) | We kept Robert in the loop through Meeting 4, async WhatsApp updates, and the full-team Meeting 6 demo. We captured his scope correction clearly: Finale 3D CSV output is the MVP proof; browser previews are support tooling, not the main deliverable. | ([https://www.notion.so/34ccd8a5bf088143885cc94ca0c51bf3](https://www.notion.so/34ccd8a5bf088143885cc94ca0c51bf3]), ([https://www.notion.so/356cd8a5bf0881138cf9f3099e1b619a](https://www.notion.so/356cd8a5bf0881138cf9f3099e1b619a]), [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144), [FIR-75](https://linear.app/fireworkentertainment/issue/FIR-75/record-stakeholder-meeting-6-scrum-3-and-csv-mvp-backlog-alignment) | 
 | Planning and Organisation (20%) | Planning was explicit in Notion and Linear: sprint goal, deliverables table, owners, risks, cycle metrics, PR evidence, and follow-up issues. The ANZAC/Easter calendar mismatch was called out instead of hidden. | Linear Sprint 2 cycle, ([https://www.notion.so/34ccd8a5bf0881b395c3cd41a62841cf](https://www.notion.so/34ccd8a5bf0881b395c3cd41a62841cf]), ([https://www.notion.so/34fcd8a5bf08819fac2cc31aaed3ede5](https://www.notion.so/34fcd8a5bf08819fac2cc31aaed3ede5]), ([https://www.notion.so/356cd8a5bf08818b9019ee7b1a211664](https://www.notion.so/356cd8a5bf08818b9019ee7b1a211664]) | 
 | Execution and Quality (40%) | The sprint delivered working software rather than only prototypes: auth, protected routes, RLS-backed schema, live-data UI, private uploads, renderer/admin improvements, shadcn primitives, and documented env/migration setup. Open work is traceable rather than vague. | [PR #94](https://github.com/HarryRandall/FireworkEntertAInment/pull/94), [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100), [PR #131](https://github.com/HarryRandall/FireworkEntertAInment/pull/131), [PR #133](https://github.com/HarryRandall/FireworkEntertAInment/pull/133), [PR #135](https://github.com/HarryRandall/FireworkEntertAInment/pull/135) | 
 | Reflection and Improvement (20%) | We recorded individual reflections, roadblocks, and follow-up process changes. Robert's feedback produced concrete backlog changes: CSV-first export priority, stakeholder approval before catalogue promotion, and a MIR payload contract before web integration. | Reflections below, [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv), [FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79/implement-stakeholder-approval-workflow-for-reconstructed-catalogue), [FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12) | 

---

## Sprint 2 Follow-Up Backlog

 | Feedback / gap | Response | Linear | 
 | ---- | ---- | ---- | 
 | CSV/export is the commercial MVP, not Glow-grade simulation. | Re-scoped export issue to Finale 3D-compatible CSV first and moved it into Sprint 2. | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv) | 
 | Reconstructed catalogue metadata must not pollute the live library. | Created an approval workflow issue so Robert/admins review reconstructed items before promotion. | [FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79/implement-stakeholder-approval-workflow-for-reconstructed-catalogue) | 
 | MIR payload shape must be stable before website integration. | Created schema v1.2 issue for the MIR-to-choreography contract and validation. | [FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12) | 

---

## Meetings

- **[Stakeholder Meeting 4 — 20 April 2026 (interim sync)](https://www.notion.so/34ccd8a5bf088143885cc94ca0c51bf3)** — Harrison + Fang with Robert; aligned **Finale 3D-first MVP** and **4 May** follow-up.

- **[Day Overview (21/04) — Scrum 1](https://www.notion.so/34ccd8a5bf0881b395c3cd41a62841cf)** — week-1 async scrum notes (stand-up disrupted by illness/travel).

- **[Day Overview (27/04) — Scrum 2](https://www.notion.so/34fcd8a5bf08819fac2cc31aaed3ede5)** — mid-sprint platform push: design system, route groups, real Supabase auth + schema + live data, redesigned landing.

- **[Day Overview (04/05)](https://www.notion.so/356cd8a5bf08818b9019ee7b1a211664)** — **Scrum 3** stakeholder session (**Meeting 6**), **[PR #131](https://github.com/HarryRandall/FireworkEntertAInment/pull/131)**, **[PR #133](https://github.com/HarryRandall/FireworkEntertAInment/pull/133)**, **[PR #135](https://github.com/HarryRandall/FireworkEntertAInment/pull/135)**; Linear [FIR-75](https://linear.app/fireworkentertainment/issue/FIR-75/record-stakeholder-meeting-6-scrum-3-and-csv-mvp-backlog-alignment)–[FIR-78](https://linear.app/fireworkentertainment/issue/FIR-78/migrate-platform-ui-primitives-to-shadcn-with-showcrafter-aligned-theming).

---

## Stakeholder Engagement Plan

- Demo the authenticated platform and Supabase-backed catalogue at the **4 May** checkpoint.

- Share the MIR output on a Robert-selected song so he can validate mood/emotion mapping.

- Capture any new feedback in [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144) and cross-link actions here.

---

## Risks to Watch

- Two-week gap around ANZAC Day / Easter reduces synchronous time with Robert; rely on async WhatsApp updates.

- First Finale 3D CSV imported cleanly but we have only a partial product set; MVP demo quality depends on the final database file landing early in the sprint.

- MIR accuracy on non-pop genres is unknown; spike in first week to avoid late surprises.

---

## Reflections

- Harry's reflection

	### What I worked on

					### What I struggled with

				### What I learned

			### What I will carry into Sprint 3

	- Harrison's reflection

		- Created a simple parser in Godot that can do simple fireworks simulations using it’s particle system, based on Finale3D’s VDL language.

	- Explored using cursor/codex on my system to speed up development + documentation.

		- Had some personal events happen in the second week of the sprint which tanked by productivity.

	- Public holiday slowed things down as we couldn’t communicate in-person.

		- Extend the current renderer in the LLM editing portion of the website into a full-on show renderer, pulling from supabase for the fireworks database.

	- Refine how the categorising LLM analyses fireworks to get more accurate simulation models by default.

	- Liam's reflection

				- At the beginning of week 1, I was stuck in sydney due to car complications. Week 2 there was a public holiday on our working day, and I did not complete much work.

	- I did not have a proper understanding of the speed of development when AI tools can be used. Harry has made a significant contribution to the group’s development with his skilled use of AI coding tools, while I was still writing most of my code manually.

				- Fang's reflection

	- **What You've Done**

				- **Phase A** (`4dd2450`): versioned output contract.
`SCHEMA_VERSION = 1.1.0`, split outputs into full
`<song>_analysis.json` and compact `<song>_llm.json`, added
`compute_derived_features()` (`finale_window`, `anchor_windows`,
`section_rank_by_energy`, etc.).

		- **Phase B** (`3d273b3`): hardened RMS normalisation with a
5/95 percentile clip — kills outlier-driven flattening of the
energy curve.

		- **Phase C** (`b64b269` + `8230c34`): three absolute thresholds
(climax classification, section intensity, build-up rise) moved
to song-relative percentiles. Fixes the zero-climax failure
mode on heavily compressed mixes (modern EDM / pop). This is
the change that triggered the schema bump and added
`key_moments[].prominence`.

		- **Phase D** (`94d00d0`): widened `finale_window.start` to
include the lead-in build-up rather than collapsing to the
climax instant; added a defensive sort that decouples
`compute_derived_features()` from `find_peaks`'s incidental
ordering.

			- **Roadblocks**

		- `firework_cues_baseline` is 47–58% of every LLM payload across
the three example tracks (17–43 KB each). Can't fix it
unilaterally — the right shape (keep + clarify / per-section
summary / separate file) depends on what the downstream
choreography harness wants on a first-pass payload, and I don't
own that component. Tracking issue filed with options and
acceptance criteria; needs a sync with the harness owner.
Whatever lands bumps schema to `1.2.0`.

		- No PR permission on `HarryRandall/FireworkEntertAInment`. Work
delivered as direct pushes to the feature branch; relying on a
maintainer to either open a PR or merge.(Once pass the tests)

		- Week-1 scrum (21/04) ran async because parts of the team were
out. I was unaffected and worked a normal
week, but the foundational commit `edd4a0f` (+625 / -25)
shipped without synchronous review. No problems surfaced from
it — but it's a pattern to avoid for foundational work in
future sprints.

		- Two edge cases identified but not yet exercised:
`classify_intensity()`'s fallback (snap-back to 0.4 / 0.7)
degrades poorly on narrow-dynamic-range tracks; `p60` peak
height in `detect_buildups()` can over-fire on tracks with
very long quiet intros. Likely to surface as soon as the test
suite expands beyond the three checked-in examples.

	- **What You're Gonna Do**

				- **Phase 1 — test suite + fine-tuning** (gates Phase 2). Build
`prototypes/audio-analyser/test-suite/` with 6–8 diverse songs
(varied genres, lengths, production styles; at least two
chosen specifically to provoke known weak spots). Commit
baseline outputs, document mismatches in `FINDINGS.md`. Then
tune — promote the magic constants (5/95, p40/p70, p60,
`0.35 × (p90-p10)`, `FINALE_BUILDUP_TOLERANCE_SEC = 3.0`) into
one configuration block at the top of `showcrafter.py`, fix
chorus-detection if it mislabels, replace the narrow-dynamic-
range fallback with `mean ± std/2`. All changes logged in
`TUNING_LOG.md`. Per Hazza: **constants only, no CLI flags
during tuning**.

		- **Cross-cutting work, before Phase 2 attaches.** Sync with the
choreography harness owner on `firework_cues_baseline` shape;
land the redesign; bump schema to `1.2.0`. Add a pydantic
model keyed on `schema_version` so the Phase 2 API endpoint
can fail loudly on contract drift instead of silently
misinterpreting a payload.

		- **Phase 2 — website integration** (after Phase 1 sign-off).
File upload → API endpoint → background queue (Bull-style) →
Python subprocess → results in a new `analyses` table with
RLS scoped to `user_id` → Markdown rendered via
`react-markdown`. Vercel can't run librosa synchronously, so
this needs a background-queue + sidecar pattern, not a plain
serverless route. Add malformed-audio handling in
`analyse_song()` before the endpoint goes live — librosa can
crash on corrupt input, which is fine for prototype CLI usage
but unacceptable user-facing. End-to-end gate: all 6 Phase 1
songs upload and analyse successfully via the web flow before
merge.

<br/>

---

## Meetings & Daily Overviews

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

<br/>

