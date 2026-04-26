---
notion-url: https://www.notion.so/Stakeholder-Feedback-Log-345cd8a5bf0881579b96c2a37a854144
title: Stakeholder Feedback Log
from_notion: https://www.notion.so/Stakeholder-Feedback-Log-345cd8a5bf0881579b96c2a37a854144
author: From Notion
last_edited_time: '2026-04-17 11:32:00.000'
date: '2026-04-17 10:29:00.000'
---
[//]: # (table_of_contents is not supported)

---

## Sprint 1 Feedback Summary

### Meeting 1 · 16 March 2026

 | Feedback theme | What Robert said | Our response | Action / evidence | 
 | ---- | ---- | ---- | ---- | 
 | Target user | The real client is the retailer; consumers are end users. The tool must feel simple enough for in-store use on a phone. | Reframed the product vision around retailer-led distribution and drafted consumer-first personas. | [Product Vision + Roadmap](https://www.notion.so/325cd8a5bf0880f3b8ead17a7e10029d), [FIR-26 Personas](https://linear.app/fireworkentertainment/issue/FIR-26/create-personas-for-user-stories) | 
 | Platform | Prefer a web tool over a native app; mobile-friendly. | Locked in Next.js web platform with a mobile-first landing page. | [FIR-44](https://linear.app/fireworkentertainment/issue/FIR-44/initialise-nextjs-web-platform-with-vercel-deployment), [PR #36](https://github.com/HarryRandall/FireworkEntertAInment/pull/36) | 
 | Proof of concept path | Output a Finale 3D compatible file because Finale 3D already has Robert's consumer firework database and can simulate the show. | Adopted Finale 3D CSV as the MVP export target and began database work in Supabase. | [FIR-38](https://linear.app/fireworkentertainment/issue/FIR-38/upload-to-and-format-supabase), [PR #48](https://github.com/HarryRandall/FireworkEntertAInment/pull/48) | 
 | Firework personality | The tool has to describe the personality of fireworks (mood, emotion, colour, effect) and pair them with music. | Planned two AI stages: MIR for the song, curator for the firework catalogue. | [FIR-27 MIR Research](https://linear.app/fireworkentertainment/issue/FIR-27/mir-research), [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis) | 
 | Starter data | Robert to supply 20-30 firework animation files plus the matching real-firework videos. | Set up a Supabase-backed catalogue so the files drop straight in. | [FIR-38](https://linear.app/fireworkentertainment/issue/FIR-38/upload-to-and-format-supabase), [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) | 
 | Communication | WhatsApp group for quick questions between meetings. | Group created and used for out-of-hours clarifications. | WhatsApp group (off-platform) | 

### Meeting 2 · 23 March 2026

 | Feedback theme | What Robert said | Our response | Action / evidence | 
 | ---- | ---- | ---- | ---- | 
 | UI mockup | Positive on the editor, shopping list, show guide, and live preview flow. | Ported the mockup into a real Next.js landing page and kept the same flow as our north star. | [PR #29 Site mockup](https://github.com/HarryRandall/FireworkEntertAInment/pull/29), [PR #36 Next.js skeleton](https://github.com/HarryRandall/FireworkEntertAInment/pull/36) | 
 | Consumer vs professional fireworks | Consumer fireworks have a 3-6 second ignition fuse and produce many effects at once, so beat-level precision is unrealistic. Profile fireworks by mood and match to song sections instead. | Reshaped the curation approach around mood and song-section matching rather than beat-level firing. | [Product Vision + Roadmap](https://www.notion.so/325cd8a5bf0880f3b8ead17a7e10029d), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | 
 | MVP output format | Stick with Finale 3D CSV for MVP because the exported `.fire` file is universal across firing systems. | Froze scope: MVP exports Finale 3D CSV; direct Ignite integration is a Phase 3 goal. | [Firework Scripting/Simulation Research](https://www.notion.so/32ccd8a5bf0880bdb882c91be1b33dff), [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) | 
 | Database format | Tag fireworks by category (peony, palm, willow, cake, crackle, strobe), fuse timing, and effect. Add mood and emotion fit scores per song type. | Supabase schema drafted against these tags; new sample CSV from Robert imported and re-formatted. | [FIR-38](https://linear.app/fireworkentertainment/issue/FIR-38/upload-to-and-format-supabase), [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [PR #48](https://github.com/HarryRandall/FireworkEntertAInment/pull/48) | 
 | Retail stock integration | Full POS integration is out of scope for MVP. Retailers will provide a static product list; quantities come later. | Agreed, adjusted the roadmap accordingly. | [Product Vision + Roadmap, Phase 3](https://www.notion.so/325cd8a5bf0880f3b8ead17a7e10029d) | 
 | Differentiation | ShowCrafter should use Robert's fireworks assets and pyrotechnic expertise as training and prompt data. | Reserved the LLM system prompt as a core team asset and started collecting Robert's draft descriptions for each firework type. | Robert action (ongoing); captured in Sprint 2 planning | 
 | Robert's next-steps | Export a working Finale 3D CSV, supply the full consumer database, draft prompts per firework type, meet the Ignite team 7-8 April. | Tracked as stakeholder action items; team to ingest deliverables in Sprint 2. | See Meeting 2 action items table | 

### Meeting 3 · 30 March 2026

 | Feedback theme | What Robert said | Our response | Action / evidence | 
 | ---- | ---- | ---- | ---- | 
 | Sprint 1 sign-off | Happy with the Next.js + Supabase direction and the proposed Finale 3D CSV MVP path. | Locked Sprint 1 deliverables and started Sprint 2 planning. | [Sprint 1 page](https://www.notion.so/333cd8a5bf0880f59cc5dbbb1b0331ac) | 
 | Sample database | First Finale 3D CSV did not import cleanly; replacement file supplied. | Re-formatted and re-uploaded to Supabase. | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) | 
 | Scheduling | No meeting the week of 7 April (Easter / travel); aim for the week of 27-28 April. | Sprint 2 calendar set accordingly; WhatsApp used for async check-ins in between. | ([Firework EntertaINment](https://www.notion.so/325cd8a5bf088050b0e6cd10670fdfbb]) | 

---

## Tutor Feedback

 | Area | Feedback | Our response | 
 | ---- | ---- | ---- | 
 | Stakeholder engagement | Feedback was present but buried inside meeting minutes. | This Stakeholder Feedback Log created, plus a 'Stakeholder Feedback & Actions' section added to every meeting page. | 
 | Planning and organisation | Sprint goals were implicit rather than stated explicitly. | Every sprint page now starts with an explicit Sprint Goal callout tied to measurable deliverables. | 
 | Execution and quality | Strong progress; demo helped refine the MVP; repo is well-maintained. | Continuing the same cadence; Sprint 2 builds directly on the demo and catalogue. | 
 | Reflection and improvement | Good use of stakeholder feedback to refine MVP features. | Reflection now explicitly cross-links the stakeholder feedback items that drove each decision. | 

