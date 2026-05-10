---
notion-url: https://www.notion.so/Day-Overview-21-04-34ccd8a5bf0881b395c3cd41a62841cf
title: Day Overview (21/04)
from_notion: https://www.notion.so/Day-Overview-21-04-34ccd8a5bf0881b395c3cd41a62841cf
author: From Notion
last_edited_time: '2026-05-04 05:33:00.000'
date: '2026-04-24 08:44:00.000'
---
---

## What We've Done

 | Theme | Deliverable | Owner | Linear | Evidence | 
 | ---- | ---- | ---- | ---- | ---- | 
 | Stakeholder | Interim Meeting 4 debrief with Robert — MVP scope (Finale 3D-first), renderer expectations, MIR priority, **4 May** follow-up | Harrison, Fang | — | [Stakeholder Meeting 4](https://www.notion.so/34ccd8a5bf088143885cc94ca0c51bf3) | 
 | Process / Notion | Reformatted the Sprint 2 page (sprint goal callout, deliverables table, scheduling note) and seeded this Day Overview page so async work had a home | Harry | — | ([Sprint 2 - Platform Skeleton, Database & MIR](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76]) | 
 | Process / Linear | Backfilled the Sprint 2 platform slice and seven supporting issues (skeleton review, Scrum 1 backfill, API surface, catalogue routes, auth, live-data wiring, docs) | Harry | [FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-52](https://linear.app/fireworkentertainment/issue/FIR-52/review-existing-nextjssupabase-platform-skeleton-for-sprint-2)–[FIR-58](https://linear.app/fireworkentertainment/issue/FIR-58/document-sprint-2-platform-setup-and-next-steps) | Linear backlog | 
 | Platform / design system | **ShowCrafter design system** — `SKILL.md` spec, Cursor rule, design-token aliases (Ember Gold, Sky Pulse, Night), Lucide icon set, foundation refactor | Harry | [FIR-60](https://linear.app/fireworkentertainment/issue/FIR-60/design-system-skill-pack), [FIR-63](https://linear.app/fireworkentertainment/issue/FIR-63/foundation-refactor-tokens-lucide-deps-drop-material-symbols) | [PR #80](https://github.com/HarryRandall/FireworkEntertAInment/pull/80), [PR #81](https://github.com/HarryRandall/FireworkEntertAInment/pull/81) | 
 | Platform / components | Shared UI / marketing / app component pack under `app/components/{ui,marketing,app}` (Button, Card, Hero, MarketingNavBar, AppShell, etc.) | Harry | [FIR-61](https://linear.app/fireworkentertainment/issue/FIR-61/ui-marketing-app-component-pack) | [PR #82](https://github.com/HarryRandall/FireworkEntertAInment/pull/82) | 
 | Platform / routes | `(marketing)`, `(app)`, `(dev)` route groups so chrome and access-control concerns stay isolated | Harry | [FIR-62](https://linear.app/fireworkentertainment/issue/FIR-62/route-groups-marketing-app-dev) | [PR #83](https://github.com/HarryRandall/FireworkEntertAInment/pull/83) | 
 | Platform / UI | Rebuilt `/` landing and a UI-only `/login` on the new component pack — the basic UI mockup direction we were aiming for this week | Harry | [FIR-64](https://linear.app/fireworkentertainment/issue/FIR-64/rebuild-landing-and-add-login-on-the-new-component-pack) | [PR #84](https://github.com/HarryRandall/FireworkEntertAInment/pull/84) | 
 | Platform / app pages | Authenticated app pages on the new shell — `/dashboard` bento grid, `/shows/new` form, `/shows/[id]` editor with timeline / shopping list / preview tabs | Harry | [FIR-65](https://linear.app/fireworkentertainment/issue/FIR-65/authenticated-app-pages-dashboard-new-show-show-editor-sub-routes) | [PR #85](https://github.com/HarryRandall/FireworkEntertAInment/pull/85) | 
 | Database | Supabase / database work from Sydney — documenting database helpers and catalogue integration patterns | Liam | [FIR-50](https://linear.app/fireworkentertainment/issue/FIR-50/catalogue-config-documentation), [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) | FIR-45 done
FIR-50 done but made redundant - will keep for optimisation stage later | 
 | MIR | Evolved `prototypes/audio-analyser` into a preprocessing module — `agent.md`  • `llm-harness.md`, expanded cue generation in `showcrafter.py`, `--personality` CLI, richer Markdown report + structured JSON for downstream validators | Fang | [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization) | Ongoing | 
 | Simulation | Godot visualiser spike — 2D particle system approximating two firework effect families; exploring VDL-driven authoring; needs alignment to Robert's Finale 3D format | Harrison | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) | Ongoing | 
 | Process | Recorded sprint progress + branch hygiene requests in Linear | Harry | [FIR-48](https://linear.app/fireworkentertainment/issue/FIR-48/could-you-please-help-me-delete-the-following-branches-they-are-no), [FIR-49](https://linear.app/fireworkentertainment/issue/FIR-49/can-you-open-the-failed-vercel-deployment-for-commit-438d9df-and-send) | FIR-48 done; FIR-49 tracks failed Vercel deploy investigation | 

---

## What We Plan to Do (before next week)

- **Harry**: Finish **auth + core API routes** enough for a thin demo; continue **Notion** hygiene; hook UI mock to live data where possible ([FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock)).

- **Liam**: Land **Supabase schema + import** updates for Robert’s latest catalogue; publish **helper/docs** for DB access; confirm **branch naming** vs. Issue & Merging Guide ([FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [FIR-25](https://linear.app/fireworkentertainment/issue/FIR-25/evaluate-database-options-for-backend-storage), [FIR-50](https://linear.app/fireworkentertainment/issue/FIR-50/catalogue-config-documentation)).

- **Fang**: Harden MIR **JSON/Markdown contracts**, wire selected libraries per spike outcomes, prep **demo audio** for Robert review ([FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis), [FIR-39](https://linear.app/fireworkentertainment/issue/FIR-39/enhance-audio-analysis-granularity-and-model-generalization)).

- **Harrison**: Decide **Godot vs web** presentation for prototype; start mapping **VDL / CSV fields** into sim parameters; time-permitting, stub **Finale export** experiments with Liam ([FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation), [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv)).

- **Team**: Confirm **4 May** stakeholder session details; **TBD** — [placeholder] final agenda & demo checklist once Harry/Liam back in sync.

---

## Reflections

### Harry

- What You’ve Done

	- Reformatted the Sprint 2 Notion page (sprint goal callout, deliverables table, scheduling note) and seeded this Day Overview so async progress had a home while Liam was in Sydney and I was unwell.

	- Backfilled Linear with the Sprint 2 platform slice ([FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock)) plus the supporting issues for skeleton review, Scrum 1 backfill, API surface, catalogue routes, auth, live-data wiring, and Sprint 2 docs ([FIR-52](https://linear.app/fireworkentertainment/issue/FIR-52/review-existing-nextjssupabase-platform-skeleton-for-sprint-2)–[FIR-58](https://linear.app/fireworkentertainment/issue/FIR-58/document-sprint-2-platform-setup-and-next-steps)).

	- Stood up the **ShowCrafter design system** end-to-end — `SKILL.md` spec, Cursor rule, design-token aliases on top of our Ember Gold + Sky Pulse palette, and a Lucide-based component pack so the rest of the platform work has a single source of truth ([FIR-60](https://linear.app/fireworkentertainment/issue/FIR-60/design-system-skill-pack), [FIR-61](https://linear.app/fireworkentertainment/issue/FIR-61/ui-marketing-app-component-pack), [FIR-63](https://linear.app/fireworkentertainment/issue/FIR-63/foundation-refactor-tokens-lucide-deps-drop-material-symbols)).

	- Reorganised the platform into `(marketing)`, `(app)`, `(dev)` route groups and ported every prototype HTML page onto the new components ([FIR-62](https://linear.app/fireworkentertainment/issue/FIR-62/route-groups-marketing-app-dev), [FIR-64](https://linear.app/fireworkentertainment/issue/FIR-64/rebuild-landing-and-add-login-on-the-new-component-pack)).

	- Built the authenticated app pages on the new shell — `/dashboard` bento grid, `/shows/new` form, `/shows/[id]` editor with timeline / shopping list / preview tabs ([FIR-65](https://linear.app/fireworkentertainment/issue/FIR-65/authenticated-app-pages-dashboard-new-show-show-editor-sub-routes)). This is the “basic UI mockup direction” that was the goal for week 1 — real auth and live data are queued for Scrum 2.

	- Kept the Notion → GitHub sync running through the week so the team had a current source of truth for sprint planning ([PR #97](https://github.com/HarryRandall/FireworkEntertAInment/pull/97)).

- Roadblocks

	- Monday stand-up didn’t happen - I was unwell and Liam was travelling in Sydney, so the week ran async around the Robert sync Harrison and Fang covered.

	- ANZAC Day / Easter break compressed the synchronous window with the team and with Robert; planning had to happen over WhatsApp and Notion rather than face to face.

	- The platform skeleton needed a bigger refactor than expected (route groups, design tokens, new component pack) before auth could land cleanly, so the auth slice slipped from Scrum 1 into Scrum 2.

- What You’re Gonna Do

	- Land the auth + protected-routes work and wire the UI to live Supabase data so the **4 May** stakeholder demo has a real end-to-end flow ([FIR-51](https://linear.app/fireworkentertainment/issue/FIR-51/feature-supabase-auth-catalogue-apis-and-sprint-2-ui-mock), [FIR-56](https://linear.app/fireworkentertainment/issue/FIR-56/implement-supabase-authentication-flow), [FIR-57](https://linear.app/fireworkentertainment/issue/FIR-57/connect-platform-ui-to-live-database-data)).

	- Polish the marketing landing on the new design system so the front door of the demo matches the rest of the product.

	- Capture this week’s output in a Scrum 2 Day Overview and keep the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144) current ahead of the **4 May** session.

### Liam

- What You’ve Done

	- Completed supabase config file in application.

	- Completed Supabase data access layer including generic functions and tools.

- Roadblocks

	- What You’re Gonna Do

	### Fang

- What You’ve Done

	
```markdown
    - Picked up audio-analyser as my Sprint 2 stream. Read the
      existing prototype, the `agent.md` maintenance guide, and the
      `llm-harness.md` design notes for what downstream choreography
      expects from the analyser.
    - Shipped initial pipeline expansion + docs (`edd4a0f`,
      +625 / -25 on `showcrafter.py`). Foundational work: cleaner
      structure, baseline analysis flow, scaffolding for the
      LLM-readiness work coming next.
```

- Roadblocks

	
```markdown
the foundational commit shipped without synchronous group review — flagging as a process note, not a blocker
```

- What You’re Gonna Do

	
```markdown
- Move into Phase A: lock the output contract before any
      robustness work starts. Add `SCHEMA_VERSION`, split outputs
      into the full analysis JSON + a token-efficient LLM payload
      per `llm-harness.md` §Token Strategy, and pre-compute the
      derived features the harness asks for (`finale_window`,
      `anchor_windows`, energy ranking, etc.).
- Document everything in `agent.md` / `README.md` alongside the
      code so the schema is discoverable.
```

### Harrison

- What You’ve Done

	- Began working on the Godot renderer.

	- Created a parser that can take a dummy firing script file and fire two different types of fireworks with two different colours in Godot.

- Roadblocks

	- More time than I thought is being eaten up by documentation still, finding a way to optimise this process might help a bit.

- What You’re Gonna Do

	- Extend the Godot system to fully understand Finale3D VDL

	- Implement all of Robert’s firework types in the 2D renderer.

	<br/>

