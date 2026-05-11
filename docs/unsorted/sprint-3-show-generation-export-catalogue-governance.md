---
notion-url: https://www.notion.so/Sprint-3-Show-Generation-Export-Catalogue-Governance-356cd8a5bf088133a867dfe56851b2ab
title: "Sprint 3 - Show Generation, Export & Catalogue Governance"
from_notion: https://www.notion.so/Sprint-3-Show-Generation-Export-Catalogue-Governance-356cd8a5bf088133a867dfe56851b2ab
author: From Notion
last_edited_time: '2026-05-11T03:35:00.000Z'
---
> **Sprint Goal**
  Ship the **end-to-end MVP for Robert**: song + constraints in -> AI choreography -> **Finale 3D-importable export** out, with imported catalogue items rendered consistently in both our in-app preview and Finale 3D.

> **Dates**
  11 May - 31 May

> **Linear cycle**
  [Sprint #3](https://linear.app/fireworkentertainment/team/FIR/cycles)

> **Status**
  In progress

> **Team** - Harry Randall, Harrison Black, Liam Maloney, Chongyang Fang
  **Stakeholder** - Robert Foti (ICON Pyrotechnics International)

  **Tutor** - Solomon Inyang

> **Kickoff note** - First scrum is today (11 May 2026). We're carrying Meeting 6's correction into this sprint: the **Finale 3D-importable export is the MVP proof** for Robert, and the renderer plus the reconstructed catalogue back the demo rather than being deliverables in their own right. We haven't booked a Sprint 3 stakeholder meeting yet - aiming to lock one in mid-sprint.

---


## Sprint Context

Continues after [Sprint 2 - Platform Skeleton, Database & MIR](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76): we already have the authenticated Next.js platform, the RLS-scoped Supabase schema, the private audio bucket, the MIR analyser with versioned outputs, the unified browser renderer, and the reconstructed-catalogue admin shell. Sprint 3 stitches those building blocks into one end-to-end MVP demo for Robert.

The four sub-goals below map onto the four work streams we split this morning. We'll call Sprint 3 done when we can sit Robert in front of the app and run the whole loop on his song: log in, upload, set constraints, watch the AI produce cues, see them in our renderer, and export a Finale 3D-importable CSV that opens cleanly in his copy of Finale 3D.


### Sub-goals

1. **Music pipeline in-app** - upload a song, run the analyser server-side, persist the result, and visualise peaks / sections / energy on the show editor timeline.
2. **Catalogue parity** - import a Finale 3D firework spec, replicate it as our internal `spec_json`, and render it in our preview so what we draw matches what Finale 3D draws (gated by stakeholder approval before reconstructed items go live).
3. **Export round-trip** - generated show exports to a Finale 3D-importable CSV that Robert can actually load; mapping fields covered by [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35) / [FIR-82](https://linear.app/fireworkentertainment/issue/FIR-82).
4. **Renderer + pipeline glue** - WebGL particle simulation hooked up to live show data and AI cues, with audio sync, so a full demo run plays end-to-end.

---


## Planned Deliverables

| Stream | Deliverable | Owner | Linear | Status | Evidence |
| ---- | ---- | ---- | ---- | ---- | ---- |
| Music pipeline | In-app analyser runner endpoint: song upload -> Python analyser -> persisted analysis row | Fang | [FIR-89](https://linear.app/fireworkentertainment/issue/FIR-89/music-in-app-analyser-runner-endpoint) | Planned | (PR) |
| Music pipeline | Visualise peaks / sections / energy curve on the show editor timeline | Fang | [FIR-90](https://linear.app/fireworkentertainment/issue/FIR-90/music-visualise-peaks-sections-energy-on-show-editor-timeline) | Planned | (PR) |
| Music pipeline | Lock MIR-to-choreography payload schema v1.2 + pydantic validation | Fang | [FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12) | Planned | schema assets |
| Music pipeline | Analyser granularity / genre tuning + fixtures | Fang | [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | In progress | analyser PRs |
| Catalogue parity | Refine `fireworks` schema for imported Finale 3D catalogues (`source`, `source_payload`, `spec_json`, `preview_status`) | Liam | [FIR-91](https://linear.app/fireworkentertainment/issue/FIR-91/db-refine-fireworks-schema-for-imported-finale-3d-catalogues) | Planned | migration PR |
| Catalogue parity | Finale 3D firework type -> internal `spec_json` replication + side-by-side parity preview | Liam (Harrison assisting) | [FIR-92](https://linear.app/fireworkentertainment/issue/FIR-92/parity-finale-3d-firework-type-to-internal-spec-json-side-by-side) | Planned | catalogue detail page |
| Catalogue parity | Parse Finale 3D VDL strings into `spec_json.shots` | Liam | [FIR-84](https://linear.app/fireworkentertainment/issue/FIR-84/parse-finale3d-vdl-strings-into-spec-json-shots-arrays) | In progress | parser PR |
| Catalogue parity | Stakeholder approval workflow before reconstructed catalogue items go live | Liam (with Harry) | [FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79/implement-stakeholder-approval-workflow-for-reconstructed-catalogue) | Planned | admin PR |
| Export | Finale 3D-compatible CSV export (parent track) | Liam (with Harrison) | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv) | In progress | [FIR-82](https://linear.app/fireworkentertainment/issue/FIR-82/export-show-as-finale3d-compatible-csv) (done) |
| Renderer & simulation | WebGL renderer + configurable launch lanes via Supabase | Harrison + Harry | [FIR-74](https://linear.app/fireworkentertainment/issue/FIR-74/renderer-build-fireworks-renderer-using-javascript-webgl) | In progress | renderer PRs |
| Renderer & simulation | Connect WebGL renderer to live show cues + audio sync | Harrison + with Harry | [FIR-94](https://linear.app/fireworkentertainment/issue/FIR-94/renderer-connect-webgl-renderer-to-live-show-cues-audio-sync) | Planned | (PR) |
| Renderer & simulation | Improve LLM firework categorisation accuracy | Harrison | [FIR-73](https://linear.app/fireworkentertainment/issue/FIR-73/renderer-improve-the-llm-analysis-of-fireworks) | Planned | analysis PR |
| Pipeline glue | End-to-end MVP loop demo: song -> AI -> cues -> renderer -> Finale 3D CSV | Harry | [FIR-93](https://linear.app/fireworkentertainment/issue/FIR-93/mvp-loop-song-to-ai-to-cues-to-renderer-to-finale-3d-csv-demo) | Planned | (PR) |
| Pipeline glue | Cross-cutting integration fixes across teammates' branches (Sprint 3 umbrella) | Harry | [FIR-95](https://linear.app/fireworkentertainment/issue/FIR-95/sprint-3-umbrella-pipeline-glue-and-integration-fixes) | Planned | (linked PRs) |
| Process | Sprint 3 scrum skeletons + `docs/sprints/sprint-3/` mirror | Harry | [FIR-96](https://linear.app/fireworkentertainment/issue/FIR-96/sprint-3-process-notion-repo-docssprintssprint-3-skeletons) | In progress | this page |

## Stakeholder Engagement Plan

- Aim for a mid-sprint async demo of the MVP loop on a Robert-selected song before we tighten the CSV export schema.
- Send Robert one Finale 3D CSV from our pipeline before Scrum 3 so we can validate the round-trip on his copy of Finale 3D.
- Log all decisions and feedback in [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144).

---


## Risks to Watch

- **Cue-model vs Finale 3D field drift** - the cue model and the CSV columns can drift apart unless [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35) and the MIR payload schema ([FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80)) stay aligned.
- **Reconstructed catalogue pollution** - if [FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79) (approval workflow) slips, mis-labelled effect types will leak into the consumer-facing library.
- **Renderer / parity divergence** - if our `spec_json` doesn't visually match Finale 3D for the same product, Robert can't trust the in-app preview.
- **Integration tax** - four work streams converge on the same show editor; we need Harry's pipeline glue track to keep pace or the MVP demo won't run end-to-end.
- **Stakeholder availability** - no Sprint 3 meeting locked in yet; we'll lean on async WhatsApp + Notion until a slot is confirmed.

---


## Reflections

> Individual reflections will be filled in at the end of Sprint 3.

<details>
<summary>Harry's reflection</summary>

  *To be completed at sprint close.*

</details>


<details>
<summary>Harrison's reflection</summary>

  *To be completed at sprint close.*

</details>


<details>
<summary>Liam's reflection</summary>

  *To be completed at sprint close.*

</details>


<details>
<summary>Fang's reflection</summary>

  *To be completed at sprint close.*

</details>


---


## Meetings & Daily Overviews

[Stakeholder Meeting 7](https://www.notion.so/35dcd8a5bf0881e795ecf2d565f1e4ec)
[Day Overview (11/05)](https://www.notion.so/35dcd8a5bf0881bda229f857d1bf5e3e)
[Stakeholder Meeting 8](https://www.notion.so/35dcd8a5bf088161a3f8f1985e6c1e94)
[Day Overview (18/05)](https://www.notion.so/35dcd8a5bf08812e83cbe14ef44d2324)
[Stakeholder Meeting 9](https://www.notion.so/35dcd8a5bf0881e1a4cad03f83ada5ea)
[Day Overview (25/05)](https://www.notion.so/35dcd8a5bf0881ee8973cdce88128aaf)
