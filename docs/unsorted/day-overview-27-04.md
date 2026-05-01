---
notion-url: https://www.notion.so/Day-Overview-27-04-34fcd8a5bf08819fac2cc31aaed3ede5
title: "Day Overview (27/04)"
from_notion: https://www.notion.so/Day-Overview-27-04-34fcd8a5bf08819fac2cc31aaed3ede5
author: From Notion
last_edited_time: '2026-04-27T06:53:00.000Z'
---
> **Scrum 2 (Sprint 2)** · 27 April 2026
  Mid-sprint catch-up after the ANZAC Day / Easter gap. Building on the design-system + route-group foundation from [Scrum 1](https://www.notion.so/34ccd8a5bf0881b395c3cd41a62841cf), Harry landed real Supabase auth, RLS-scoped schema, end-to-end live-data wiring, and a polished marketing landing. Heading into the **4 May** stakeholder checkpoint with an authenticated demo path.


---


## What We've Done

| Theme | Deliverable | Owner | Linear | Evidence |
| ---- | ---- | ---- | ---- | ---- |
| Platform / auth | Real Supabase auth end-to-end — email/password login + signup, identifier-first flow, OAuth callback route, password reset flow, and a `proxy.ts` that gates protected routes and redirects authed users away from `/login` and `/signup` | Harry | [FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-56](https://linear.app/fireworkentertainment/issue/FIR-56/implement-supabase-authentication-flow) | [PR #96](https://github.com/HarryRandall/FireworkEntertAInment/pull/96), [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) |
| Platform / database | Supabase migrations for `profiles`, `shows`, `show_cues`, `shopping_list_items` with RLS scoped to `auth.uid()`, an `on_auth_user_created` profile trigger, and a private `audio` storage bucket with per-user RLS policies. Generated typed Database client and applied to client/server helpers | Harry | [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface), [FIR-55](https://linear.app/fireworkentertainment/issue/FIR-55/build-catalogue-api-routes-backed-by-supabase) | [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) |
| Platform / live data | Replaced hard-coded `SHOWS` demo data with server-only Supabase queries on dashboard, show detail, timeline, shopping list, show guide, and preview. `/shows/new` server action validates input, uploads audio to the private bucket, generates a slug, inserts the row | Harry | [FIR-57](https://linear.app/fireworkentertainment/issue/FIR-57/connect-platform-ui-to-live-database-data) | [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100) |
| Marketing site | Rebuilt `/` with a 3D WebGL hero (react-three-fiber), light theme + dark toggle, animated stats strip, interactive Cloudflare-style stepper (Choose song / Set preferences / Get show), and a stylised Australia VendorNetwork map. Cleaner navbar CTAs and a four-column footer | Harry | — | [PR #94](https://github.com/HarryRandall/FireworkEntertAInment/pull/94), commits `65f8186` → `862fa3f` |
| Polish / DX | Branded `/not-found` page; fixed Vercel root-directory build by moving the app into `platform/` with a matching `vercel.json`; suppressed THREE.Clock deprecation warning; tightened login/signup layout (max-width cap, fixed left panel, pointer cursors) | Harry | — | [PR #95](https://github.com/HarryRandall/FireworkEntertAInment/pull/95), [PR #98](https://github.com/HarryRandall/FireworkEntertAInment/pull/98), [PR #99](https://github.com/HarryRandall/FireworkEntertAInment/pull/99) |
| Docs / process | Documented env vars and migrations in `CLAUDE.md`; gitignored local IDE MCP config so tokens don’t get committed; synced Sprint 2 planning into the repo via the Notion-to-GitHub pipeline | Harry | [FIR-58](https://linear.app/fireworkentertainment/issue/FIR-58/document-sprint-2-platform-setup-and-next-steps) | [PR #97](https://github.com/HarryRandall/FireworkEntertAInment/pull/97) |
| Process / Linear | Closed the seven Sprint 2 platform issues that landed across Scrum 1 + Scrum 2 (FIR-51, 52, 53, 54, 55, 58, 59) and updated the Sprint 2 deliverables table with current statuses | Harry | [FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-59](https://linear.app/fireworkentertainment/issue/FIR-59/frontend-showcrafter-platform-redesign) | Linear |

---


## What We Plan to Do (before 4 May)

- **Harry**: Stitch the **MIR pipeline** into `/shows/new` so Robert sees a real song → mood / energy → cue list flow at the **4 May** demo, and finish polishing the authenticated app pages on the new design system ([FIR-65](https://linear.app/fireworkentertainment/issue/FIR-65/authenticated-app-pages-dashboard-new-show-show-editor-sub-routes)).
- **Liam**: Land the latest **Finale 3D CSV** import on top of the new schema and confirm the catalogue helpers still cover Robert's updated product list ([FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [FIR-25](https://linear.app/fireworkentertainment/issue/FIR-25/evaluate-database-options-for-backend-storage), [FIR-50](https://linear.app/fireworkentertainment/issue/FIR-50/catalogue-config-documentation)).
- **Fang**: Lock the MIR **JSON / Markdown contract** and prep a Robert-selected demo song so we can play the analysis live in the meeting ([FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization)).
- **Harrison**: Decide **Godot vs web** for the visualiser and start mapping VDL / CSV fields into sim parameters; time-permitting, stub a Finale export round-trip with Liam ([FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation), [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv)).
- **Team**: Confirm the **4 May** stakeholder session details on WhatsApp and finalise the demo agenda (auth + live catalogue + MIR + visualiser).

---


## Reflections


### Harry


<details>
<summary>What You’ve Done</summary>

  - Landed the **Supabase auth + schema + live data** slice in [PR #100](https://github.com/HarryRandall/FireworkEntertAInment/pull/100): RLS-scoped tables, a private audio bucket, generated typed clients, a `proxy.ts` route guard, real `/shows/new` server action, and dashboard / show pages reading from Supabase instead of hard-coded data ([FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface), [FIR-55](https://linear.app/fireworkentertainment/issue/FIR-55/build-catalogue-api-routes-backed-by-supabase), [FIR-56](https://linear.app/fireworkentertainment/issue/FIR-56/implement-supabase-authentication-flow), [FIR-57](https://linear.app/fireworkentertainment/issue/FIR-57/connect-platform-ui-to-live-database-data)).
  - Polished the auth UI — split layout with a firework-art panel, identifier-first flow, animated SVG bursts that work in light + dark mode, custom inline validation, and pointer cursors throughout ([PR #96](https://github.com/HarryRandall/FireworkEntertAInment/pull/96), [PR #98](https://github.com/HarryRandall/FireworkEntertAInment/pull/98), [PR #99](https://github.com/HarryRandall/FireworkEntertAInment/pull/99)).
  - Rebuilt the marketing landing page with a 3D WebGL hero, light theme, an interactive Cloudflare-style stepper, and a stylised Australia VendorNetwork map; added a branded 404 page and tightened nav/footer copy ([PR #94](https://github.com/HarryRandall/FireworkEntertAInment/pull/94), [PR #95](https://github.com/HarryRandall/FireworkEntertAInment/pull/95)).
  - Closed off the matching Linear issues ([FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-52](https://linear.app/fireworkentertainment/issue/FIR-52/review-existing-nextjssupabase-platform-skeleton-for-sprint-2), [FIR-53](https://linear.app/fireworkentertainment/issue/FIR-53/backfill-sprint-2-scrum-1-platform-progress-notes), [FIR-54](https://linear.app/fireworkentertainment/issue/FIR-54/define-sprint-2-platform-api-surface), [FIR-55](https://linear.app/fireworkentertainment/issue/FIR-55/build-catalogue-api-routes-backed-by-supabase), [FIR-58](https://linear.app/fireworkentertainment/issue/FIR-58/document-sprint-2-platform-setup-and-next-steps), [FIR-59](https://linear.app/fireworkentertainment/issue/FIR-59/frontend-showcrafter-platform-redesign)) and updated the Sprint 2 deliverables table with current statuses.
  - Documented env vars + migrations in `CLAUDE.md`, gitignored local MCP config paths, and kept the Notion ↔ GitHub sync running ([PR #97](https://github.com/HarryRandall/FireworkEntertAInment/pull/97)).
</details>


<details>
<summary>Roadblocks</summary>

  - The Next.js 16 upgrade renamed `middleware.ts` to `proxy.ts` and the conflicting files broke the build; had to consolidate auth into `proxy.ts` before the auth slice could merge.
  - Vercel was still building from the repo root after the move into `platform/`, so the deploy failed until a `vercel.json` pinned the root directory.
  - The TiltCard `FeatureGrid` jittered under the cursor and the BeatTimeline demo was technically wrong, so I dropped both and replaced them with the InteractiveSteps + VendorNetwork sections — cost a chunk of the day but the page reads as one cohesive narrative now.
  - ANZAC Day / Easter gap meant no synchronous time with Robert this week; relying on the **4 May** session to validate the auth + live-data demo.
</details>


<details>
<summary>What You’re Gonna Do</summary>

  - Wire Fang's MIR output into `/shows/new` so the **4 May** demo runs a real song through the full pipeline and shows the resulting cue list in the dashboard.
  - Polish the authenticated app pages on the new design system (timeline, shopping list, show guide) so the demo doesn't fall over on edge cases.
  - Lock the **4 May** agenda with Harrison, Liam and Fang and update the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144) once Robert’s confirmed.
</details>


### Liam


<details>
<summary>What You’ve Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You’re Gonna Do</summary>

  *To be completed.*

</details>


### Fang


<details>
<summary>What You’ve Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You’re Gonna Do</summary>

  *To be completed.*

</details>


### Harrison


<details>
<summary>What You’ve Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You’re Gonna Do</summary>

  *To be completed.*

</details>

