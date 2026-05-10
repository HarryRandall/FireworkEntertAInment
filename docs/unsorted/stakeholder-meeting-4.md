---
notion-url: https://www.notion.so/Stakeholder-Meeting-4-34ccd8a5bf088143885cc94ca0c51bf3
title: Stakeholder Meeting 4
from_notion: https://www.notion.so/Stakeholder-Meeting-4-34ccd8a5bf088143885cc94ca0c51bf3
author: From Notion
last_edited_time: '2026-05-04 05:49:00.000'
date: '2026-04-24 08:44:00.000'
---
[//]: # (table_of_contents is not supported)

---

## Overview

---

## Topics Discussed

### Visualisation approach

- Harrison explained the website still needs a way to preview fireworks, currently leaning towards a **custom particle / engine-backed approach** (e.g. Godot) versus **re-using supplier videos**.

- Robert cautioned that **accurate effect rendering from text descriptions is a multi-person, multi-year problem** for vendors like Glow and Finale; he recommended **re-using existing simulations/videos** where possible so the team does not ship something that looks “average” relative to industry tools.

- Alignment: **priority for this sprint remains MIR / analysis**, not a polished public renderer.

### MVP definition: Finale 3D as the simulator

- Robert’s “big step” milestone: generate a **Finale 3D–compatible workbook / script export** that imports cleanly, carries the show, and syncs with the music—then **use Finale 3D for visualisation**.

- Fully bespoke web animation matching vendor quality was framed as **unlikely in scope**; Harrison agreed to keep investigating but not bet the sprint on it.

### AI / data realism

- Robert relayed conversations with **Glow** and **Ignite**: industry sees AI as inevitable but **training data for fireworks is tiny vs. general internet-scale ML**; progress will depend on structured prompts, catalogue metadata, and iteration—not naïve “train from scratch.”

- Harrison outlined the planned **LLM + prompt-engineering** approach: rich MIR features (sections, mood/energy tags, timestamps) + structured firework metadata, iterated until budgets and safety constraints can be expressed.

### Visual Display Language (VDL) as the bridge

- Robert asked whether the team will anchor on the **Finale 3D visual display language** he supplied.

- Harrison confirmed **yes, as the first foundation**, with a possible later helper layer if the raw VDL is too opaque for models—**full automation of that translation is more of a Sprint 3/4 concern**; **current sprint focus stays on music analysis**.

### Data sufficiency & upgraded Finale 3D tooling

- Robert asked if he is providing **enough** catalogue / prompt / media coverage; Harrison said **sufficient for now**, with **VDL-linked effects in Finale 3D** as the immediate need (can simulate there for ground truth).

- Optional extras: **pyro-musical reference videos** are useful for human intuition; value to automated AI pipelines still TBD.

- Robert noted **Finale 3D upgraded import/export** for Excel + scripts; university licensing might have been available free—**not urgent for this sprint** but helpful once CSV round-tripping ramps up.

### Scheduling & team health

- Harrison flagged **illness + ANZAC Day** disrupting the usual Monday co-working plan; work continues **async** through the holiday week.

- They aligned that the **next live stakeholder session** would likely slip to **Monday 4 May 2026** (Robert flexible on alternate days if the team prefers).

### MIR status (Fang)

- Fang summarised work on the **music analysis tool**: segmenting music, tempo/movement features, evaluating libraries that need tuning for commercial use.

- Noted **Harrison built the initial prototype** and Fang has been **optimising / extending** it.

---

## Stakeholder Feedback & Actions

 | Feedback / decision | Our response | Linear / evidence | 
 | ---- | ---- | ---- | 
 | Treat **Finale 3D import + music** as the core MVP proof; web animation is secondary. | Keep Sprint 2 focus on MIR + data layer + platform skeleton; simulation spike stays exploratory. | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv), [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) | 
 | Prefer re-using vendor simulations/video rather than rebuilding high-fidelity renders from prose. | Godot/particle prototype is for communication / risk reduction, not a Glow-quality renderer. | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) | 
 | Confirm data + VDL coverage is enough; offer more catalogue/video if needed. | Harrison to sync with Harry & Liam when back; continue using Finale 3D ground truth. | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis) | 
 | Next meeting ~**4 May 2026** after ANZAC / travel disruption. | Update Sprint 2 calendar + WhatsApp thread; keep async updates open. | ([Sprint 2 - Platform Skeleton, Database & MIR](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76]) | 

---

## Action Items

- **Team (Harry / Liam / Harrison)**: Confirm the **next stakeholder session** (target **4 May 2026**) and circulate dial-in details.

- **Harrison / Fang**: Keep **MIR tool** on track; prepare a concise MIR output sample for Robert when Harry is back.

- **Harry / Liam**: Resume **platform + Supabase** work async; align on **branch strategy vs. Issue & Merging Guide** (one branch per Linear/GitHub issue).

- **Robert**: Continue supplying **VDL-aligned prompts**; flag if upgraded Finale 3D licensing can help the CSV round-trip spike later in Sprint 2.

---

## Full Transcript

- Show full transcript

																																																																																																																																																																											