---
notion-url: https://www.notion.so/Sprint-2-Platform-Skeleton-Database-MIR-345cd8a5bf0881139db2e8370f553d76
title: "Sprint 2 - Platform Skeleton, Database & MIR"
from_notion: https://www.notion.so/Sprint-2-Platform-Skeleton-Database-MIR-345cd8a5bf0881139db2e8370f553d76
author: From Notion
last_edited_time: '2026-04-17T11:31:00.000Z'
---
> **Sprint Goal**
  Stand up the real product skeleton. Ship an authenticated Next.js platform backed by a Supabase-hosted firework catalogue, import Robert's consumer-firework database, and get a first end-to-end Music Information Retrieval (MIR) pipeline producing mood and energy features from a sample song.

> **Dates**
  20 Apr – 4 May

> **Linear cycle**
  [Sprint #2](https://linear.app/fireworkentertainment/team/FIR/cycles)

> **Status**
  In progress

> **Team** - Harry Randall, Harrison Black, Liam Maloney, Chongyang Fang
  **Stakeholder** - Robert Foti (ICON Pyrotechnics International)

  **Tutor** - Solomon Inyang

> **Scheduling note** - The Notion root page lists Sprint 2 as 20 April - 4 May. The Linear cycle runs 19 April - 10 May. We work to the Notion dates; Linear captures the buffer week that covers the ANZAC Day / Easter travel gap Robert flagged in [Meeting 2](https://www.notion.so/32ccd8a5bf08807a93d5c6ed3a582589).

---


## Sprint 1 Carry-Over Context

Sprint 1 ([Sprint 1 - Foundations, Tooling & Product Vision](https://www.notion.so/333cd8a5bf0880f59cc5dbbb1b0331ac)) delivered the Next.js skeleton, the repository conventions, Supabase integration, and the initial MIR research. Sprint 2 builds directly on top of that work to move from documentation to a running product.


---


## Planned Deliverables

| Theme | Deliverable | Owner | Linear issue |
| ---- | ---- | ---- | ---- |
| Platform | Authentication flow on Next.js + Supabase (login, session, protected routes) | Harry, Liam | [FIR-22](https://linear.app/fireworkentertainment/issue/FIR-22/research-login-flow-and-user-persistence-for-the-website) |
| Database | Evaluate DB options and lock choice; finalise schema for fireworks and shows | Liam | [FIR-25](https://linear.app/fireworkentertainment/issue/FIR-25/evaluate-database-options-for-backend-storage) |
| Database | Ingest Robert's updated Finale 3D CSV and re-format in Supabase | Liam | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) |
| MIR | Select core MIR libraries / APIs and wire them into the audio analyser prototype | Fang | [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis) |
| MIR | Improve audio analysis granularity and model generalisation; map to mood/energy profile | Fang | [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) |
| Simulation | Prototype browser-side firework simulation spike (Godot vs WebGL vs canvas) | Harrison | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) |
| Simulation | Working Finale 3D CSV round-trip (import Robert's CSV, render a demo) | Harrison | [FIR-32](https://linear.app/fireworkentertainment/issue/FIR-32/build-a-script-to-generate-sample-finale-3d-csvs-from-our-database) |

---


## Meetings

- **Stakeholder Meeting 4** - target week of 27-28 April (exact day to be confirmed based on Robert's return from Hong Kong on 21 April).
- **Scrum 3 & Scrum 4** - day overviews will be added as child pages as they happen.

---


## Stakeholder Engagement Plan

- Demo the authenticated platform and Supabase-backed catalogue at Meeting 4.
- Share the MIR output on a Robert-selected song so he can validate mood/emotion mapping.
- Capture any new feedback in [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144) and cross-link actions here.

---


## Risks to Watch

- Two-week gap around ANZAC Day / Easter reduces synchronous time with Robert; rely on async WhatsApp updates.
- First Finale 3D CSV imported cleanly but we have only a partial product set; MVP demo quality depends on the final database file landing early in the sprint.
- MIR accuracy on non-pop genres is unknown; spike in first week to avoid late surprises.

---


## Reflections

> Individual reflections will be filled in at the end of Sprint 2.

<details>
<summary>Harry's reflection</summary>

  *To be completed at end of Sprint 2.*

</details>


<details>
<summary>Harrison's reflection</summary>

  *To be completed at end of Sprint 2.*

</details>


<details>
<summary>Liam's reflection</summary>

  *To be completed at end of Sprint 2.*

</details>


<details>
<summary>Fang's reflection</summary>

  *To be completed at end of Sprint 2.*

</details>

