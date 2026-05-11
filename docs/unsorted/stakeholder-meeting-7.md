---
notion-url: https://www.notion.so/Stakeholder-Meeting-7-35dcd8a5bf0881e795ecf2d565f1e4ec
title: "Stakeholder Meeting 7"
from_notion: https://www.notion.so/Stakeholder-Meeting-7-35dcd8a5bf0881e795ecf2d565f1e4ec
author: From Notion
last_edited_time: '2026-05-11T03:38:00.000Z'
---
> **Date** · 11 May 2026 · **Channel** · WhatsApp (async)
  **Attendees** · Harry Randall, Robert Foti

  **Status** · Scheduled live meeting did not run - Robert was on a last-minute flight to China. We pushed the live session and ran a short async exchange instead.


---


## Overview

We had a stakeholder meeting booked for the start of Sprint 3, but Robert had to fly to China at short notice and messaged that he was on board the flight. Rather than reschedule the same week, we pushed the next live session to next week and agreed to keep working via email / WhatsApp in the meantime. Robert sent through one direct piece of feedback while waiting at the gate: he wants to make sure we're **not overcomplicating the Finale 3D export** - in his words, "you only need a few data points in an excel file to import a show so to me it should be the simplest part." Harry confirmed we already had a working export running against Robert's spreadsheet that morning and committed to sending an end-of-day update with a checklist Robert can sanity-check.


---


## Topics Discussed


### Rescheduling

- Robert was on a flight to China at the meeting slot; asked to reschedule.
- We agreed to push the live session out a week and keep channel open over email / WhatsApp for any blocking questions in the meantime.

### Finale 3D export scope

- Robert's main concern: he wants us to keep the Finale 3D export simple. From his perspective Finale 3D only needs a handful of data points in an Excel file to import a show, so the export should be the simplest part of the project rather than a heavy engineering track.
- Harry confirmed we already shipped a first cut of the export this morning ([FIR-82](https://linear.app/fireworkentertainment/issue/FIR-82)) on top of a template show, drawing from the catalogue spreadsheet Robert sent us. Robert acknowledged with a thumbs-up.

### Next steps from Harry

- Harry committed to sending Robert an end-of-day update with progress and a checklist so Robert can validate that the export covers what he expects.

---


## Stakeholder Feedback & Actions

| Feedback / decision | Our response | Linear / evidence |
| ---- | ---- | ---- |
| Keep the Finale 3D export simple - a few data points in an Excel file is enough; don't overcomplicate it. | Scoped the export work to the Sprint 2 / Meeting 6 CSV track; FIR-82 already landed today on top of the template show, drawing only from Robert's spreadsheet. We won't widen scope without checking back. | [FIR-82](https://linear.app/fireworkentertainment/issue/FIR-82/export-show-as-finale3d-compatible-csv), [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv) |
| Live meeting pushed because Robert was on a last-minute flight to China. | Reschedule to next week (target [Untitled](https://www.notion.so/35dcd8a5bf088161a3f8f1985e6c1e94), week of 18 May); keep email / WhatsApp open for blocking questions in the meantime. | [Sprint 3 - Show Generation, Export & Catalogue Governance](https://www.notion.so/356cd8a5bf088133a867dfe56851b2ab) |
| Harry to send EOD update + checklist so Robert can spot-check the export coverage. | Owner Harry; send via WhatsApp / email at end of 11 May. Include the FIR-82 output and a short checklist of what we mapped vs. what we left out. | Async follow-up |
> Cross-links live in the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144).

---


## Action Items

- **Harry**: Send Robert an EOD WhatsApp / email update on 11 May with Sprint 3 progress + a Finale 3D export checklist he can verify.
- **Team**: Confirm the rescheduled live meeting slot for the week of 18 May (will live on [Stakeholder Meeting 8](https://www.notion.so/35dcd8a5bf088161a3f8f1985e6c1e94)).
- **Liam / Harrison**: Keep catalogue parity + VDL parser work scoped so we don't accidentally widen the export beyond what Robert just signed off on ([FIR-84](https://linear.app/fireworkentertainment/issue/FIR-84), [FIR-91](https://linear.app/fireworkentertainment/issue/FIR-91), [FIR-92](https://linear.app/fireworkentertainment/issue/FIR-92)).

---


## WhatsApp Transcript


<details>
<summary>Show full WhatsApp exchange (11 May 2026)</summary>

  **Harry Randall · 11:14**
Hey Robert, this is Harry from ANU firework entertainment. Just checking if you were around for the meeting today / wanted to push it a little later? Cheers

  **Robert Foti · 11:14** (edited)
Faark. I have had to do a last minute trip to China and on board a flight.

  **Robert Foti · 11:15**
Can we reschedule for later today. So sorry

  **Harry Randall · 11:25**
Haha that's no worries!! We've actually got a fair bit of work to do and not much to discuss at this stage so perhaps we push it until next week and communicate via email / whatsapp for questions?

  **Robert Foti · 11:25**
No worries.

  **Robert Foti · 11:27**
Main question I have is what the work being done for finale 3D is. I want to make sure we're not overcomplicating things. You only need a few data points in an excel file to import a show so to me it should be the simplest part.

  **Harry Randall · 11:31**
Yep we got it exporting this morning to finale3D based on just a template show we created. It uses fireworks only from the spreadsheet you sent us

  **Robert Foti · 11:31**
👍

  **Harry Randall · 11:31**
Will send you an update closer to EOD with progress and hopefully a checklist so you can check it out.

  **Robert Foti · 11:32**
No worries.

</details>

