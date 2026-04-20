---
notion-url: https://www.notion.so/Stakeholder-Meeting-3-333cd8a5bf0880ef9d92c9f02f38ce87
title: Stakeholder Meeting 3
from_notion: https://www.notion.so/Stakeholder-Meeting-3-333cd8a5bf0880ef9d92c9f02f38ce87
author: From Notion
last_edited_time: '2026-04-17 11:32:00.000'
date: '2026-03-30 00:43:00.000'
---
[//]: # (table_of_contents is not supported)

---

## Overview

---

## Topics Discussed

### Sprint 1 Demo

- Harry walked through the deployed Next.js + Tailwind skeleton on Vercel.

- Liam showed the `/api/health/supabase` probe confirming the catalogue is reachable and the Supabase `fireworks` table populated from the new CSV.

- Fang demoed the MIR prototype generating beat, onset, and energy features on a sample song.

- Harrison walked through the Finale 3D simulation research and the Godot spike for an in-browser firework preview.

### Catalogue Handover

- Robert confirmed that the first CSV he sent was missing a few columns and that the replacement sent earlier in the week is the version to use going forward.

- Liam confirmed the new file had been imported and re-formatted in Supabase ([FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database)).

- Robert to continue drafting prompt-style descriptions per firework type during his US trip and send them back for Sprint 3.

### MVP Sign-Off

- Robert was happy with the direction: Next.js + Supabase platform, Finale 3D CSV as the MVP output, mood-based curation rather than beat-level firing.

- Agreed that direct Ignite integration stays as a Phase 3 goal pending Robert's 7-8 April meeting with the Ignite team.

### Scheduling

- No meeting the week of 7 April (Easter / Robert travelling).

- Next meeting targeted for the week of 27-28 April, after Robert returns to Hong Kong on 21 April. Exact day to be confirmed via WhatsApp.

- ANZAC Day (28 April) and Labour Day (5 May) noted as possible conflicts.

---

## Stakeholder Feedback & Actions

 | Feedback / decision | Our response | Linear / evidence | 
 | ---- | ---- | ---- | 
 | Happy with the Next.js + Supabase direction and the Finale 3D CSV MVP path. | Sprint 1 deliverables closed out; Sprint 2 planning locked to auth + MIR integration + simulation spike. | ([Sprint 1 - Foundations, Tooling & Product Vision](https://www.notion.so/333cd8a5bf0880f59cc5dbbb1b0331ac]), [Sprint 2 page](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76) | 
 | First Finale 3D CSV did not import cleanly; replacement file supplied. | Re-formatted and re-uploaded to Supabase `fireworks` table. | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [PR #48](https://github.com/HarryRandall/FireworkEntertAInment/pull/48) | 
 | Robert will draft firework-personality prompts while in the US and bring back notes from the Ignite meeting. | Sprint 3 backlog item reserved; prompts will seed the curator AI system prompt. | Sprint 3 backlog (to be created) | 
 | No meeting the week of 7 April; reconvene the week of 27-28 April. | Sprint 2 calendar set accordingly; async updates via WhatsApp. | [Sprint 2 page](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76) | 

---

## Action Items

- **Robert**: Draft firework-personality prompts during the US trip.

- **Robert**: Bring back notes from the 7-8 April Ignite meeting re. integration possibilities.

- **Team**: Kick off Sprint 2 on authentication ([FIR-22](https://linear.app/fireworkentertainment/issue/FIR-22/research-login-flow-and-user-persistence-for-the-website)), MIR integration ([FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization)) and the browser simulation spike ([FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation), [FIR-32](https://linear.app/fireworkentertainment/issue/FIR-32/build-a-script-to-generate-sample-finale-3d-csvs-from-our-database)).

- **Team**: Confirm date for Meeting 4 in the week of 27-28 April via WhatsApp closer to the time.

