---
notion-url: https://www.notion.so/Stakeholder-Meeting-2-32ccd8a5bf08807a93d5c6ed3a582589
title: Stakeholder Meeting 2
date: '2026-03-23 01:15:00.000'
from_notion: https://www.notion.so/Stakeholder-Meeting-2-32ccd8a5bf08807a93d5c6ed3a582589
author: From Notion
last_edited_time: '2026-04-17 11:32:00.000'
---
[//]: # (table_of_contents is not supported)

---

## Stakeholder Feedback & Actions

 | Feedback / decision | Our response | Linear / evidence | 
 | ---- | ---- | ---- | 
 | UI mockup walkthrough: positive on editor, shopping list, show guide and live preview flow. | Mockup ported into Next.js; same flow kept as our north-star navigation. | [PR #29](https://github.com/HarryRandall/FireworkEntertAInment/pull/29), [PR #36](https://github.com/HarryRandall/FireworkEntertAInment/pull/36) | 
 | Consumer fireworks have a 3-6 second ignition fuse and produce many effects at once, so beat-level precision is unrealistic. Profile fireworks by mood and match to song sections. | Curation redesigned around mood / song-section matching, not beat-level firing. | [Product Vision + Roadmap](https://www.notion.so/325cd8a5bf0880f3b8ead17a7e10029d), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | 
 | Stick with Finale 3D CSV for MVP; the exported `.fire` file is universal across firing systems. | MVP scope frozen to Finale 3D CSV; direct Ignite integration parked as a Phase 3 goal. | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation), [Firework Scripting/Simulation Research](https://www.notion.so/32ccd8a5bf0880bdb882c91be1b33dff) | 
 | Database should include tags and categories per firework (peony, palm, willow, cake, crackle, strobe), fuse timing and mood-fit scores. | Supabase schema drafted around these attributes; sample CSV ingested and re-formatted. | [FIR-38](https://linear.app/fireworkentertainment/issue/FIR-38/upload-to-and-format-supabase), [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [PR #48](https://github.com/HarryRandall/FireworkEntertAInment/pull/48) | 
 | Full retailer POS integration is out of scope for MVP. Use a static product list on the back end. | Roadmap updated; live stock integration deferred to Phase 3. | [Product Vision + Roadmap, Phase 3](https://www.notion.so/325cd8a5bf0880f3b8ead17a7e10029d) | 
 | Differentiation will come from Robert's assets, expertise, and a well-tuned LLM system prompt describing firework personality. | System-prompt design marked as a core Sprint 3 deliverable; Robert's draft prompts queued for ingestion. | Sprint 3 backlog (to be created) | 
 | Robert's actions: export working Finale 3D CSV, supply consumer database, draft prompts per firework type, meet Ignite team 7-8 April. | Tracked as stakeholder action items; delivered replacement CSV ingested after Meeting 3. | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) | 

---

## Meeting Notes

### Overview

---

### UI Mockup Walkthrough

- **Login / show dashboard** – stored shows accessible on return visits

- **Show editor** – fireworks synced to music, with an LLM chat panel for natural-language tweaks

- **Shopping list** – generated based on retailer stock

- **Show guide** – instructional breakdown of what will happen

- **Live preview** – rough animated preview of the show

---

### Finale 3D & CSV Export

- Export a working CSV from Finale 3D for the team to use

- Get his nephew in Sydney (their Finale expert) to export a usable product database

---

### Ignite Firing System Integration

- Ignite has its own designer platform with **import/share functionality**, so reverse-engineering the format may be feasible

- Robert is meeting with the Ignite team directly on **7–8 April** in the US and will explore integration opportunities

- The team agreed that seamless direct integration with a firing system is the **ultimate product goal**, with Finale 3D CSV export as the correct MVP stepping stone

- Robert noted that GLOW Fireworks already does this (design → export to Ignite via a 4-letter code in the mobile app), and ShowCrafter should aim to replicate and improve on that model

---

### Consumer vs. Professional Fireworks – Key Distinction

- Professional fireworks receive precise timecode and have known pre-fire delays, enabling beat-accurate choreography

- Consumer fireworks have a **3–6 second ignition fuse by law**, making the same precision unachievable

- A single consumer firework may produce **15+ effects over 20 seconds** — a "mixed salad" rather than a single precise effect

- **Recommendation:** Rather than trying to match individual fireworks to individual beats, the team should profile fireworks by **mood/personality** and match them to broader song sections (e.g. energy maps, emotional arcs)

---

### Firework Database & Prompt Design

- The database should include **tags and categories** per firework (e.g. peony, palm, willow, cake, crackle, strobe) along with fuse timing and effect descriptions

- Robert offered to write **draft prompts** describing each firework type and where it might fit in a show — the team will incorporate these into the LLM prompt design

- Harry suggested adding **numeric rating scales** (e.g. size, colour intensity) to help the LLM reason about fireworks more precisely; Liam suggested adding mood/emotion fit scores per song type

- Robert will use terminology consistent with the firework descriptions to ensure everything aligns

---

### Retail Stock Integration

- Retailers provide a **static product list** on the back end

- The software designs shows based on that list

- Quantities and live stock levels are a later enhancement

---

### Competitive Differentiation

- **First mover** advantage in the music-driven consumer fireworks design space

- Access to **Robert's fireworks assets, animations, and professional expertise** as training and prompt data

- A **highly tuned, domain-specific system prompt** encoding real fireworks expertise — show quality will depend heavily on how well this is crafted

- Robert's idea of building a tool that can **describe the emotional narrative of a firework** (analogous to how MIR tools describe music) was well received as a potential long-term differentiator

---

---

## Next Steps

 | Owner | Action | 
 | ---- | ---- | 
 | Robert | Export Finale 3D CSV file and send to team | 
 | Robert | Export consumer fireworks product database (two versions) and send | 
 | Robert | Draft prompts/descriptions for each firework type, noting where each fits in a show | 
 | Robert | Follow up with Ignite team on 7–8 April re. integration possibilities | 
 | Team | Flesh out the database schema | 
 | Team | Continue work on the song analysis AI pipeline | 
 | Team | Work towards a working Finale 3D CSV import demo | 

---

---

## Scheduling

- No meeting the week of 7 April (Easter/Anzac break)

- Robert returns to Hong Kong on ~21 April

- Next meeting likely **week of 27–28 April** (noting ANZAC Day is 28 April and Labour Day falls nearby)

- Robert will confirm closer to the time based on his US time zone

- Team to contact Robert via WhatsApp for quick questions

---

## Full Transcript

---

---

