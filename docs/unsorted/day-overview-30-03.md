---
notion-url: https://www.notion.so/Day-Overview-30-03-345cd8a5bf0881f296baeffedcf45130
title: "Day Overview (30/03)"
from_notion: https://www.notion.so/Day-Overview-30-03-345cd8a5bf0881f296baeffedcf45130
author: From Notion
last_edited_time: '2026-04-17T11:32:00.000Z'
---
> **Scrum 3** · 30 March 2026
  Sprint 1 wrap-up scrum, held alongside [Stakeholder Meeting 3](https://www.notion.so/333cd8a5bf0880ef9d92c9f02f38ce87). Platform skeleton, Supabase integration and Notion-to-GitHub sync landed; Sprint 2 planning locked in.


---


## What We've Done

- Shipped the Next.js 15 + Tailwind v4 platform skeleton and wired up Vercel deployment ([FIR-44](https://linear.app/fireworkentertainment/issue/FIR-44/initialise-nextjs-web-platform-with-vercel-deployment), [PR #36](https://github.com/HarryRandall/FireworkEntertAInment/pull/36)).
- Landed Supabase integration - clients, session middleware, env loader and `/api/health/supabase` probe ([FIR-38](https://linear.app/fireworkentertainment/issue/FIR-38/upload-to-and-format-supabase), [PR #48](https://github.com/HarryRandall/FireworkEntertAInment/pull/48)).
- Imported Robert's replacement Finale 3D CSV into the Supabase `fireworks` table after the Meeting 3 handover ([FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database)).
- Shipped the Notion-to-GitHub sync + page discovery workflow ([PRs #38, #39, #41, #44, #45, #47, #50, #52](https://github.com/HarryRandall/FireworkEntertAInment/pulls?q=is%3Apr%20notion)) and restructured the repo ([PR #30](https://github.com/HarryRandall/FireworkEntertAInment/pull/30)).
- Held [Stakeholder Meeting 3](https://www.notion.so/333cd8a5bf0880ef9d92c9f02f38ce87) with Robert; signed off Sprint 1 scope and the Finale 3D CSV MVP path.
- Closed the [Sprint Checklist](https://www.notion.so/325cd8a5bf08801eb32efb961637d294) walk-through against the rubric ([FIR-47](https://linear.app/fireworkentertainment/issue/FIR-47/complete-sprint-checklist-via-evaluating-which-items-have-been-done)) and authored the Sprint 1 Goal & Summary ([FIR-43](https://linear.app/fireworkentertainment/issue/FIR-43/sprint-1-goal-and-summary)).

---


## What We Plan to Do

- Kick off [Sprint 2](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76) on authentication + protected routes in Next.js ([FIR-22](https://linear.app/fireworkentertainment/issue/FIR-22/research-login-flow-and-user-persistence-for-the-website)).
- Start the browser-side firework simulation spike ([FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation)) and the Finale 3D CSV round-trip ([FIR-32](https://linear.app/fireworkentertainment/issue/FIR-32/build-a-script-to-generate-sample-finale-3d-csvs-from-our-database)).
- Push MIR accuracy and mood / emotion mapping across a wider genre set ([FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization)).
- Confirm Stakeholder Meeting 4 date via WhatsApp for the week of 27-28 April, after Robert returns to Hong Kong on 21 April.

---


## Reflections


### Harry


<details>
<summary>What You've Done</summary>

  - Led [Stakeholder Meeting 3](https://www.notion.so/333cd8a5bf0880ef9d92c9f02f38ce87) and demoed the deployed Next.js skeleton to Robert.
  - Shipped the Next.js 15 + Tailwind v4 platform skeleton on Vercel ([PR #36](https://github.com/HarryRandall/FireworkEntertAInment/pull/36) / [FIR-44](https://linear.app/fireworkentertainment/issue/FIR-44/initialise-nextjs-web-platform-with-vercel-deployment)).
  - Built out the Notion-to-GitHub sync pipeline end-to-end, including the page-discovery script that auto-creates stubs before sync ([PRs #44, #45, #47, #50, #52](https://github.com/HarryRandall/FireworkEntertAInment/pulls?q=is%3Apr%20notion)).
  - Reviewed and merged Liam's Supabase integration ([PR #48](https://github.com/HarryRandall/FireworkEntertAInment/pull/48)) so the catalogue is reachable from the deployed app.
  - Closed out the Sprint 1 backlog and cross-linked every deliverable back into the [Sprint 1 page](https://www.notion.so/333cd8a5bf0880f59cc5dbbb1b0331ac).
</details>


<details>
<summary>Roadblocks</summary>

  - Notion sync went through several iterations (stub discovery → content sync → fallback step) before it was reliable end-to-end.
  - First Finale 3D CSV from Robert didn't import cleanly; had to wait on the replacement file which ate into our demo buffer.
  - Two-week ANZAC Day / Easter gap is coming up, so synchronous time with Robert during Sprint 2 will be limited.
</details>


<details>
<summary>What You're Gonna Do</summary>

  - Lead the auth + protected-routes work on the Next.js platform in Sprint 2 ([FIR-22](https://linear.app/fireworkentertainment/issue/FIR-22/research-login-flow-and-user-persistence-for-the-website)).
  - Keep the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144) current and lock in the Meeting 4 date via WhatsApp.
  - Pair with Fang to wire the MIR prototype into the web platform so we can demo an end-to-end pipeline on a real song by the end of Sprint 2.
</details>


### Liam


<details>
<summary>What You've Done</summary>

</details>


<details>
<summary>Roadblocks</summary>

</details>


<details>
<summary>What You're Gonna Do</summary>

</details>


### Fang


<details>
<summary>What You've Done</summary>

</details>


<details>
<summary>Roadblocks</summary>

</details>


<details>
<summary>What You're Gonna Do</summary>

</details>


### Harrison


<details>
<summary>What You've Done</summary>

</details>


<details>
<summary>Roadblocks</summary>

</details>


<details>
<summary>What You're Gonna Do</summary>

</details>

