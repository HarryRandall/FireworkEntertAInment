<callout icon="/icons/calendar_gray.svg" color="gray_bg">
	**Date** · 20 April 2026 · **Duration** · ~26 minutes (auto-transcribed)
	**Platform** · Microsoft Teams (recording title: TechLauncher-Fireworks-20260420)
	**Attendees** · Harrison Black, Chongyang Fang, Robert Foti
	**Absent / async** · Harry Randall (unwell), Liam Maloney (Sydney)
</callout>
<table_of_contents/>
---
## Overview
Stakeholder check-in at the start of Sprint 2 while part of the team was unavailable in person. Harrison and Fang represented the group. Robert checked whether the catalogue, videos, and Finale 3D-style prompts give the team enough to proceed, pushed hard on **realistic expectations for in-browser rendering**, and reaffirmed that **a clean Finale 3D import path (spreadsheet + script + music)** is the primary MVP bar. Animated web previews are a stretch goal compared with letting Finale 3D simulate.
---
## Topics Discussed
### Visualization approach
- Harrison explained the website still needs a way to preview fireworks, currently leaning toward a **custom particle / engine-backed approach** (e.g. Godot) versus **re-using supplier videos**.
- Robert cautioned that **accurate effect rendering from text descriptions is a multi-person, multi-year problem** for vendors like Glow and Finale; he recommended **re-using existing simulations/videos** where possible so the team does not ship something that looks "average" relative to industry tools.
- Alignment: **priority for this sprint remains MIR / analysis**, not a polished public renderer.
### MVP definition: Finale 3D as the simulator
- Robert's "big step" milestone: generate a **Finale 3D–compatible workbook / script export** that imports cleanly, carries the show, and syncs with the music—then **use Finale 3D for visualization**.
- Fully bespoke web animation matching vendor quality was framed as **unlikely in scope**; Harrison agreed to keep investigating but not bet the sprint on it.
### AI / data realism
- Robert relayed conversations with **Glow** and **Ignite**: industry sees AI as inevitable but **training data for fireworks is tiny vs. general internet-scale ML**; progress will depend on structured prompts, catalogue metadata, and iteration—not naïve "train from scratch."
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
- Fang summarized work on the **music analysis tool**: segmenting music, tempo/movement features, evaluating libraries that need tuning for commercial use.
- Noted **Harrison built the initial prototype** and Fang has been **optimizing / extending** it.
---
## Stakeholder Feedback & Actions
<table fit-page-width="true" header-row="true">
<tr>
<td>Feedback / decision</td>
<td>Our response</td>
<td>Linear / evidence</td>
</tr>
<tr>
<td>Treat **Finale 3D import + music** as the core MVP proof; web animation is secondary.</td>
<td>Keep Sprint 2 focus on MIR + data layer + platform skeleton; simulation spike stays exploratory.</td>
<td>[FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv), [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation)</td>
</tr>
<tr>
<td>Prefer re-using vendor simulations/video rather than rebuilding high-fidelity renders from prose.</td>
<td>Godot/particle prototype is for communication / risk reduction, not a Glow-quality renderer.</td>
<td>[FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation)</td>
</tr>
<tr>
<td>Confirm data + VDL coverage is enough; offer more catalogue/video if needed.</td>
<td>Harrison to sync with Harry & Liam when back; continue using Finale 3D ground truth.</td>
<td>[FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis)</td>
</tr>
<tr>
<td>Next meeting ~**4 May 2026** after ANZAC / travel disruption.</td>
<td>Update Sprint 2 calendar + WhatsApp thread; keep async updates open.</td>
<td><mention-page url="https://www.notion.so/345cd8a5bf0881139db2e8370f553d76">Sprint 2 - Platform Skeleton, Database & MIR</mention-page></td>
</tr>
</table>
<callout icon="/icons/link_blue.svg" color="blue_bg">
	Cross-links live in the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144).
</callout>
---
## Action Items
- **Team (Harry / Liam / Harrison)**: Confirm the **next stakeholder session** (target **4 May 2026**) and circulate dial-in details.
- **Harrison / Fang**: Keep **MIR tool** on track; prepare a concise MIR output sample for Robert when Harry is back.
- **Harry / Liam**: Resume **platform + Supabase** work async; align on **branch strategy vs. Issue & Merging Guide** (one branch per Linear/GitHub issue).
- **Robert**: Continue supplying **VDL-aligned prompts**; flag if upgraded Finale 3D licensing can help the CSV round-trip spike later in Sprint 2.
---
## Full Transcript
**TechLauncher – Fireworks Meeting** · **Date:** 20 April 2026, 1:02 AM<br>**Duration:** 25m 36s
---

**Robert Foti** *(0:03)*<br>Which will have.Ohh.The whole of my catalog in glow, but if you need more Fireworks catalog to...for it, let me know and I can work that out. Are you using the videos as well or just the written descriptions or both?
**Harrison Black** *(0:22)*<br>And.I'm still slightly unsure at this point because my side of this project looks like it's more going to be doing the, well, it's going to be doing the visualization, which at this point we might use videos or we might build our own custom renderer.It's a little unsure. It also depends how we're going for time and like just how complex we think it's going to be. Right now, I think we're looking more towards just building our own like particle system for rendering, because that would just be more like it.
**Robert Foti** *(1:03)*<br>What do you mean for creating the actual render?
**Harrison Black** *(1:07)*<br>Yeah, so when, um...Like on the website that we're going to be hosting, you're going to be able to see like the visualization of like the Fireworks, right? Yeah, so for that, we're still debating whether or not we should be just rendering our own, just using like a particle system, or if we should just be like using videos and just like overlaying them, because the particle system would...
**Robert Foti** *(1:16)*<br>Yeah.
**Harrison Black** *(1:32)*<br>It might not look as accurate, but it might be able to like exist in like a 3D space better, basically.
**Robert Foti** *(1:41)*<br>Can, can you so what the videos that I'm providing 'cause I...That's really hard to do. And I only say that because the guys at Glow or whatever, they, that's their full-time and finale, that's their full-time job. And it takes a long time and a lot of development to get to the, be able to make a render of the Fireworks.
**Harrison Black** *(1:52)*<br>Mm.Mm.
**Robert Foti** *(2:08)*<br>based on a description. It's not a simple process. I don't recommend trying to do that. I would recommend if there is a way to use the existing.
**Harrison Black** *(2:10)*<br>Mm.Yeah.Mm.
**Robert Foti** *(2:23)*<br>Um...Videos, the existing simulations for doing that. If that's there's a way to do that, I would recommend that, because you're gonna end up looking, like I said, these guys, that's what they do, and it's not simple. It's not like, yeah, so...
**Harrison Black** *(2:36)*<br>The same thing.And.No, of course.
**Robert Foti** *(2:44)*<br>That's one thing I would.Yeah, consider, and...Yeah.
**Harrison Black** *(2:55)*<br>Yeah, the only reason why we might have at least somewhat of a chance of it is because I'm pretty sure they'd be using their own like render pipelines, I'm assuming. Like, yeah.
**Robert Foti** *(3:04)*<br>Yeah, they've developed their own language for it, correct?
**Harrison Black** *(3:08)*<br>Yeah, no, because what we would be doing is we would be using an off-the-shelf, like, game engine, I think, Gido was the one that has its own like built-in like particle systems and whatnot. And we would just be using those to like create.
**Robert Foti** *(3:17)*<br>Yes.But then, but how would it be able to, but how would it be able to?
**Harrison Black** *(3:25)*<br>Same effects.And.
**Robert Foti** *(3:29)*<br>create the angles, the colors, the effects, whatever, according to what the design is. Like, I guess what I'm saying is these guys, if it was easy to do, they'd be doing it because they're spending a lot of time and resources doing it. So I'm only saying because I don't want you to be spending time on something that'll look
**Harrison Black** *(3:47)*<br>Mm.
**Robert Foti** *(3:52)*<br>End up looking pretty average and not actually achieve what you're hoping that it will achieve.
**Harrison Black** *(3:55)*<br>Yes.No, of course. Yeah, it is something that we're just going to have to look at in the future. But for now, the main thing we're just trying to do is just get the music.
**Robert Foti** *(4:00)*<br>What?
**Harrison Black** *(4:11)*<br>Analysis done.
**Robert Foti** *(4:13)*<br>Yeah, sure. Well, yeah, I mean, because I think in the end, I mean, the visualizations like the ultimate, yeah, that'd be great. But if the output can just be a finale 3D Excel file that you can import, I think that would be a huge step. And then let finale 3D do the
**Harrison Black** *(4:21)*<br>Hmm.Mm.
**Robert Foti** *(4:34)*<br>Um...
**Harrison Black** *(4:36)*<br>OK, let me just check.
**Robert Foti** *(4:36)*<br>Do the visualization.
**Harrison Black** *(4:39)*<br>Mm.
**Robert Foti** *(4:39)*<br>My gut feeling tells me that in terms of what's a realistic...
**Harrison Black** *(4:42)*<br>I see.
**Robert Foti** *(4:46)*<br>And, and I could be wrong with this, so I'm happy to be be be wrong and for you to disagree, but I think the...
**Harrison Black** *(4:49)*<br>Okay.I can check.
**Robert Foti** *(4:55)*<br>If you can get to that point, that's a big, big step in itself. And then for it to be able to import that Excel file into Finale 3D, import your script into Finale 3D and have the music, that would be a huge achievement in itself. Having it animated, yeah, that's like a stretch goal.
**Harrison Black** *(5:00)*<br>Mmh.Thank you.App.Okay.My phone.
**Robert Foti** *(5:15)*<br>would be fantastic. I don't think it's achievable the way you go on about it.
**Harrison Black** *(5:17)*<br>In.But.Yeah, no, fair enough.
**Robert Foti** *(5:24)*<br>Um...But I stand to be corrected, but it's just, yeah, I mean, I had, it was just to let you know what I've been doing. I had a long discussion with the guy from Glow and also long discussion with the guy from the Ignite firing system.
**Harrison Black** *(5:29)*<br>Mhm.Play the song.Ready.
**Robert Foti** *(5:46)*<br>And.You know, they...
**Harrison Black** *(5:50)*<br>So what I'll do is don't stand to.
<!--M1-->