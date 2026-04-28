---
notion-url: https://www.notion.so/Sprint-2-Platform-Skeleton-Database-MIR-345cd8a5bf0881139db2e8370f553d76
title: Sprint 2 - Platform Skeleton, Database & MIR
from_notion: https://www.notion.so/Sprint-2-Platform-Skeleton-Database-MIR-345cd8a5bf0881139db2e8370f553d76
author: From Notion
last_edited_time: '2026-04-27 07:08:00.000'
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
 | Platform | ShowCrafter design system — tokens, Lucide icons, component pack | Harry | [FIR-60](https://linear.app/fireworkentertainment/issue/FIR-60/design-system-skill-pack), [FIR-61](https://linear.app/fireworkentertainment/issue/FIR-61/ui-marketing-app-component-pack), [FIR-63](https://linear.app/fireworkentertainment/issue/FIR-63/foundation-refactor-tokens-lucide-deps-drop-material-symbols) | Delivered | [PR #80](https://github.com/HarryRandall/FireworkEntertAInment/pull/80), [PR #81](https://github.com/HarryRandall/FireworkEntertAInment/pull/81), [PR #82](https://github.com/HarryRandall/FireworkEntertAInment/pull/82) | 
 | Platform | `(marketing)`, `(app)`, `(dev)` route groups + redesigned landing / login / dashboard / shows pages on the new component pack | Harry | [FIR-62](https://linear.app/fireworkentertainment/issue/FIR-62/route-groups-marketing-app-dev), [FIR-64](https://linear.app/fireworkentertainment/issue/FIR-64/rebuild-landing-and-add-login-on-the-new-component-pack), [FIR-65](https://linear.app/fireworkentertainment/issue/FIR-65/authenticated-app-pages-dashboard-new-show-show-editor-sub-routes) | Delivered | [PR #83](https://github.com/HarryRandall/FireworkEntertAInment/pull/83), [PR #84](https://github.com/HarryRandall/FireworkEntertAInment/pull/84), [PR #85](https://github.com/HarryRandall/FireworkEntertAInment/pull/85) | 
 | Platform | Authentication flow on Next.js + Supabase (login, signup, OAuth callback, password reset, `proxy.ts` route guard) | Harry | [FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-56](https://linear.app/fireworkentertainment/issue/FIR-56/implement-supabase-authentication-flow) | Delivered | [PR #96](https://github.com/HarryRandall/FireworkEntertAInment/pull/96), [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) | 
 | Platform | Live-data wiring — dashboard, show detail, timeline, shopping list reading from Supabase; `/shows/new` server action with audio upload | Harry | [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface), [FIR-55](https://linear.app/fireworkentertainment/issue/FIR-55/build-catalogue-api-routes-backed-by-supabase), [FIR-57](https://linear.app/fireworkentertainment/issue/FIR-57/connect-platform-ui-to-live-database-data) | Delivered | [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) | 
 | Platform | Marketing landing rebuild — 3D WebGL hero, light/dark theme, interactive stepper, VendorNetwork map, branded 404, Vercel deploy fix | Harry | — | Delivered | [PR #94](https://github.com/HarryRandall/FireworkEntertAInment/pull/94), [PR #95](https://github.com/HarryRandall/FireworkEntertAInment/pull/95), commits `65f8186` → `862fa3f` | 
 | Database | Schema for `profiles`, `shows`, `show_cues`, `shopping_list_items` with RLS scoped to `auth.uid()` and a private `audio` storage bucket | Harry | [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface) | Delivered | [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) | 
 | Database | Evaluate DB options and lock choice; finalise schema for fireworks and shows | Liam | [FIR-25](https://linear.app/fireworkentertainment/issue/FIR-25/evaluate-database-options-for-backend-storage) | In progress | Choice locked (Supabase / Postgres + RLS); product-side schema finalised in PR #100; catalogue side still open with Liam | 
 | Database | Ingest Robert's updated Finale 3D CSV and re-format in Supabase | Liam | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) | In progress | Awaiting latest catalogue file from Robert | 
 | MIR | Select core MIR libraries / APIs and wire them into the audio analyser prototype | Fang | [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis) | In progress | Preprocessing module + LLM harness landed; final library selection ongoing | 
 | MIR | Improve audio analysis granularity and model generalisation; map to mood/energy profile | Fang | [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | In progress | Cue generation + Markdown / JSON output now in `showcrafter.py` | 
 | Simulation | Prototype browser-side firework simulation spike (Godot vs WebGL vs canvas) | Harrison | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) | In progress | Godot 2D particle spike running with two effect families | 
 | Simulation | Working Finale 3D CSV round-trip (import Robert's CSV, render a demo) | Harrison | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv) (export track; split into tighter GitHub issues as needed) | In progress | VDL / CSV field mapping next | 
 | Process | Sprint 2 docs — env vars, migrations, Notion ↔ GitHub sync, Linear close-outs | Harry | [FIR-53](https://linear.app/fireworkentertainment/issue/FIR-53/backfill-sprint-2-scrum-1-platform-progress-notes), [FIR-58](https://linear.app/fireworkentertainment/issue/FIR-58/document-sprint-2-platform-setup-and-next-steps) | Delivered | [PR #97](https://github.com/HarryRandall/FireworkEntertAInment/pull/97), `CLAUDE.md` updates in PR #100 | 

---

## Meetings

- **[Stakeholder Meeting 4 — 20 April 2026 (interim sync)](https://www.notion.so/34ccd8a5bf088143885cc94ca0c51bf3)** — Harrison + Fang with Robert; aligned **Finale 3D-first MVP** and **4 May** follow-up.

- **[Day Overview (21/04) — Scrum 1](https://www.notion.so/34ccd8a5bf0881b395c3cd41a62841cf)** — week-1 async scrum notes (stand-up disrupted by illness/travel).

- **[Day Overview (27/04) — Scrum 2](https://www.notion.so/34fcd8a5bf08819fac2cc31aaed3ede5)** — mid-sprint platform push: design system, route groups, real Supabase auth + schema + live data, redesigned landing.

- **Later scrums** — add day overviews as child pages when they run.

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

	- Harrison's reflection

	- Liam's reflection

	- Fang's reflection

	---

## Meetings & Daily Overviews

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

[//]: # (child_page is not supported)

