---
notion-url: https://www.notion.so/Day-Overview-11-05-35dcd8a5bf0881bda229f857d1bf5e3e
title: "Day Overview (11/05)"
from_notion: https://www.notion.so/Day-Overview-11-05-35dcd8a5bf0881bda229f857d1bf5e3e
author: From Notion
last_edited_time: '2026-05-11T03:08:00.000Z'
---
> **Scrum 1 (Sprint 3)** - 11 May 2026
  Sprint 3 kickoff. First scrum of the cycle. Team locked the **MVP-for-Robert** goal: song + constraints -> AI -> Finale 3D-importable CSV, with imported catalogue items rendered consistently in our preview. Work streams split across Fang (music pipeline), Liam (catalogue parity + export), Harrison (renderer + helping Liam), Harry (pipeline glue + process).


---


## What We've Done

| Theme | Deliverable | Owner | Linear | Evidence |
| ---- | ---- | ---- | ---- | ---- |
| Process / Notion | Sprint 3 page rewritten with MVP-for-Robert goal, sub-goals, owner-grouped deliverables table, and risks; seeded Scrum 1/2/3 Day Overview skeletons | Harry | [FIR-96](https://linear.app/fireworkentertainment/issue/FIR-96/sprint-3-process-notion-repo-docssprintssprint-3-skeletons) | [Sprint 3 - Show Generation, Export & Catalogue Governance](https://www.notion.so/356cd8a5bf088133a867dfe56851b2ab) |
| Process / Repo | Mirrored Sprint 3 + scrum skeletons into `docs/sprints/sprint-3/` | Harry | [FIR-96](https://linear.app/fireworkentertainment/issue/FIR-96/sprint-3-process-notion-repo-docssprintssprint-3-skeletons) | `docs/sprints/sprint-3/` |
| Export | Finale 3D-compatible CSV export landed for the basic show model | Harry | [FIR-82](https://linear.app/fireworkentertainment/issue/FIR-82/export-show-as-finale3d-compatible-csv) | FIR-82 marked done 11/05 |
| Database | Populated Supabase with the Hammer & Anvil xlsx catalogue | Harry | [FIR-67](https://linear.app/fireworkentertainment/issue/FIR-67/populate-supabase-with-hammer-and-anvil-xlsx) | FIR-67 marked done 11/05 |
| Catalogue parity | VDL parser into `spec_json.shots` started | Liam | [FIR-84](https://linear.app/fireworkentertainment/issue/FIR-84/parse-finale3d-vdl-strings-into-spec-json-shots-arrays) | In progress |
| Renderer | WebGL renderer build continued from Sprint 2 carry-over | Harrison | [FIR-74](https://linear.app/fireworkentertainment/issue/FIR-74/renderer-build-fireworks-renderer-using-javascript-webgl) | In progress |
| Music pipeline | Analyser tuning + payload schema work continuing from Sprint 2 | Fang | [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization), [FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80/lock-mir-to-choreography-payload-schema-v12) | Ongoing |

---


## What We Plan to Do (before next scrum, 18 May)

- **Fang**: Land the **in-app analyser runner endpoint** (song upload -> Python analyser -> persisted analysis row) and start the **timeline visualisation** of peaks / sections / energy in the show editor. Continue locking MIR payload v1.2 ([FIR-80](https://linear.app/fireworkentertainment/issue/FIR-80), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39)).
- **Liam**: Refine the **`fireworks`**** schema for imported Finale 3D catalogues**, push **VDL parser** ([FIR-84](https://linear.app/fireworkentertainment/issue/FIR-84)) toward a first end-to-end run, and start the **parity preview** between Finale 3D source metadata and our `spec_json`. Begin scoping the **approval workflow** ([FIR-79](https://linear.app/fireworkentertainment/issue/FIR-79)).
- **Harrison**: Keep the **WebGL renderer** ([FIR-74](https://linear.app/fireworkentertainment/issue/FIR-74)) on track and **pair with Liam** on the parity preview / catalogue rendering. Begin wiring the renderer to live show cues with audio sync.
- **Harry**: Stitch the **MVP loop** (song -> AI -> cues -> renderer -> CSV) on a happy-path demo route. Handle **cross-cutting glue fixes** as teammates' branches land. Keep this Day Overview and the Sprint 3 page current.
- **Team**: Confirm whether a mid-sprint stakeholder check-in with Robert is feasible in the week of 18 May; agree the demo song to use end-to-end.

---


## Reflections


### Harry


<details>
<summary>What You've Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You're Gonna Do</summary>

  *To be completed.*

</details>


### Liam


<details>
<summary>What You've Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You're Gonna Do</summary>

  *To be completed.*

</details>


### Fang


<details>
<summary>What You've Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You're Gonna Do</summary>

  *To be completed.*

</details>


### Harrison


<details>
<summary>What You've Done</summary>

  *To be completed.*

</details>


<details>
<summary>Roadblocks</summary>

  *To be completed.*

</details>


<details>
<summary>What You're Gonna Do</summary>

  *To be completed.*

</details>

