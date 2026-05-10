---
notion-url: https://www.notion.so/Sprint-3-Show-Generation-Export-Catalogue-Governance-356cd8a5bf088133a867dfe56851b2ab
title: "Sprint 3 - Show Generation, Export & Catalogue Governance"
from_notion: https://www.notion.so/Sprint-3-Show-Generation-Export-Catalogue-Governance-356cd8a5bf088133a867dfe56851b2ab
author: From Notion
last_edited_time: '2026-05-04T06:54:00.000Z'
---
> **Sprint Goal**
  Ship the **catalogue to MIR to choreography to Finale 3D-importable CSV** loop on top of the Sprint 2 platform; gate reconstructed catalogue promotion behind stakeholder approval; stabilise MIR-to-choreography payload **v1.2**.

> **Dates**
  10 May - 31 May 2026 (Linear Sprint 3 cycle)

> **Linear cycle**
  [Sprint #3](https://linear.app/fireworkentertainment/team/FIR/cycles)

> **Status**
  Not started - planning scaffold

> **Team** - Harry Randall, Harrison Black, Liam Maloney, Chongyang Fang
  **Stakeholder** - Robert Foti (ICON Pyrotechnics International)

  **Tutor** - Solomon Inyang

> **Kickoff note** - Confirm owners during Sprint 3 kickoff. Meeting 6 (4 May 2026) framed **CSV/export as MVP proof**, browser previews as iteration support.

---


## Sprint Context

Continues after [Sprint 2 - Platform Skeleton, Database & MIR](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76): authenticated Next.js platform, Supabase catalogue, MIR prototype, reconstruction, unified renderer.

Stakeholder anchors:

- [Stakeholder Meeting 6](https://www.notion.so/356cd8a5bf0881138cf9f3099e1b619a)
- GitHub alignment issue [#145](https://github.com/HarryRandall/FireworkEntertAInment/issues/145)
- CSV/export focus [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv)

### Sprint objectives (draft)

- Authenticated **music to MIR to choreography/cues** path on-platform.
- **Finale 3D-compatible CSV/export** rehearsal with Robert.
- **Approval workflow** before reconstructed catalogue promotes ([FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79/implement-stakeholder-approval-workflow-for-reconstructed-catalogue)).
- MIR payload **schema v1.2 + validation** ([FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12)).

---


## Planned Deliverables

| Theme | Deliverable | Owner | Linear | Status | Evidence |
| ---- | ---- | ---- | ---- | ---- | ---- |
| Platform | Show-gen slice: MIR output in app plus cue timelines | Harry | (issues TBD) | Planned | (PR) |
| Export | Finale 3D CSV/spreadsheet spike + stakeholder import | Harrison | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv) | Planned | (sample file) |
| Database | Approval workflow before reconstructed rows go live | Liam / Harry | [FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79/implement-stakeholder-approval-workflow-for-reconstructed-catalogue) | Planned | (PR) |
| MIR | Payload v1.2 + pydantic validation | Fang | [FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12) | Planned | schema assets |
| MIR | Granularity/genre tuning + fixtures | Fang | [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | In progress | analyser PRs |
| Simulation | WebGL renderer + launch lanes via Supabase | Harrison | [FIR-74](https://linear.app/fireworkentertainment/issue/FIR-74/renderer-build-fireworks-renderer-using-javascript-webgl) | In progress | renderer PRs |
| Process | Scrum notes + Markdown export in docs/ | Harry | TBD | Planned | repo |

---


## Meetings

- Sprint kickoff (schedule nested page once booked)
- See [Stakeholder Meeting 6](https://www.notion.so/356cd8a5bf0881138cf9f3099e1b619a)

---


## Stakeholder Engagement Plan

- CSV import rehearsal with Robert mid/later sprint.
- Share MIR plus cue artefacts on Robert-selected repertoire before tightening export schemas.
- Log decisions in [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144).

---


## Risks to Watch

- Cue-model vs Finale field drift.
- Reconstructed catalogue without approval gates (**FIR-79**).
- Payload drift unless **FIR-80** completes before choreography UI hardens.

---


## Reflections

> Fill reflections at Sprint 3 close-out.

---


## Meetings & Daily Overviews

Add Scrum child pages as they run.

