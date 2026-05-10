---
notion-url: https://www.notion.so/Stakeholder-Meeting-6-356cd8a5bf0881138cf9f3099e1b619a
title: "Stakeholder Meeting 6"
from_notion: https://www.notion.so/Stakeholder-Meeting-6-356cd8a5bf0881138cf9f3099e1b619a
author: From Notion
last_edited_time: '2026-05-04T05:37:00.000Z'
---
> **Date** · 4 May 2026 · **Duration** · ~44 minutes (auto-transcribed)
  **Platform** · Microsoft Teams (recording: TechLauncher- Fireworks-20260504_090020)

  **Attendees** · Robert Foti (stakeholder), Harrison Black, Harry Randall, Liam Maloney, Chongyang Fang

  **Absent / async** · Fang briefly not on camera at the very start; meeting started anyway.


---


## Overview

Harry demoed the web platform: show list UI, improved in-browser firework rendering, and an admin-style catalogue flow. The main new work shown was **firework video reconstruction** from simulation clips Robert supplied—splitting video into frames, extracting colour/pixel features, and producing structured data intended to feed the AI curator. The team explained a strategy of modelling multi-shot items as compositions of single-effect units mapped separately, then composed in code.

Robert pressed for clarity on **cost–benefit of animation depth** versus the core deliverable he cares most about: **a designed show exported as a Finale 3D–compatible CSV** (spreadsheet script). Harry and Harrison defended richer per-firework data as improving AI accuracy and enabling faster iterative previews in-product versus round-tripping through Finale 3D for every tweak. Robert reiterated that industry simulation quality (Glow-level) is not the bar—the **output script for a firing system** is—and warned about mis-labelled effect types polluting training data. Harry outlined **stakeholder/admin review and approval** before catalogue items go live.

Chongyang Fang confirmed ongoing **music analysis** work; Harrison is on **Finale CSV export**; Liam on **database/catalogue ingestion** from Robert’s spreadsheets. The team believes an MVP “upload music + constraints → CSV importable to Finale” is **reachable within roughly the next sprint (~3 weeks)** though quality will improve with continued refinement. Robert showed (briefly) a **Finale 3D 3D venue / Sydney Harbour** style visualization example for reference.

They aligned on **firing positions** (e.g. concurrent shots / positions like Glow) as a product parameter, discussed a **Google Maps / address pinch** as a late stretch goal, and clarified that the heavy **video-to-simulation tooling is for admins/suppliers**, not end consumers. Schedule: three more weekly meetings (11th, 18th, 25th May), then semester break until ~**21 July** with a further ~9-week block. Robert may visit **Canberra early July** while students are on break—possible informal catch-up.


---


## Topics Discussed


### Platform demo and video reconstruction

- Harry walked through the current app shell, show listing, and progress on **3D-style firework rendering** and admin tables.
- **Video upload → reconstruction pipeline**: chunking, frame extraction, pixel/colour analysis, structured output wired for AI consumption; early but directionally representative.
- Dynamic preview of data (e.g. colour tweaks reflected live in reconstruction).

### Multi-shot modelling and accuracy

- Discussion of **multi-shot cakes** as sequences of tubes/effects; team strategy to map **constituent effects separately** then compose versus attempting one opaque multi-shot solve.
- Honest caveat: **multi-shot accuracy still being refined**; only **simulation videos** tested so far—**real-sky footage** expected to work but need clean backgrounds for best results.

### Animation effort versus MVP script output

- Robert’s “devil’s advocate”: **efficiency and time**—Finale/Glow already encode languages; concern about **rebuilding simulation** versus focusing on **show design + CSV**.
- Team response: **richer ground-truth data** for the curator; optional **in-browser iteration** for users; automation versus manual per-item description; still compatible with **Finale VDL/written catalogue** already provided.
- Shared framing: **simulation fidelity is not the end goal**—**correct, safe, musically sensible script output** is; preview is **communication and iteration**, not Glow-parity rendering.

### Data quality, taxonomy, and approvals

- Risk of **wrong effect labels** (e.g. chrysanthemum versus palm) affecting **musical pairing**; importance of industry naming (“silver palm”, etc.) in ICON catalogues.
- **Human-in-the-loop**: Robert/stakeholder **review and approve** reconstructed items before they propagate to consumer-facing libraries.

### Workstream check-in

- **Chongyang Fang**: music analysis tool.
- **Harrison Black**: Finale / CSV export path.
- **Liam Maloney**: databases, ingesting Excel files Robert sends.
- **Harry Randall**: front-end platform, reconstruction demo, AI integration direction.

### MVP timing and next sprint goal

- Team estimates they **could** produce a thin MVP flow immediately but prefer **~next sprint** for a more **polished** CSV-capable demo; **music integration** still landing.
- Robert offered to **refresh** catalogue data; team indicated **current sample set is enough** for now.

### Show parameters and stretch ideas

- **Multiple firing positions** and simultaneous shots (Glow-like) — planned.
- **Google Maps / address-based outdoor preview** — stretch if time permits.
- Robert demo reference: **Finale 3D with 3D venue geometry** (Sydney context).

### Roles, admin UI, and supplier workflows

- Clarified “backend” versus **admin/supplier tooling** for catalogue onboarding—not the consumer path.
- Discussion of **suppliers versus admins**, **roles** (admin versus supplier versus end user), and **catalogue approval** flows; Robert acknowledged similarity to **CRM/ERP** style account management he has seen elsewhere (including Glow’s direction).

### Project timeline and travel

- **Three** further weekly syncs in May, then **winter break**; **late July** (~21 July) resumes with **~9 weeks** to finish.
- Robert **Canberra visit early July**—may overlap break; students open to informal meet if useful.

### Methodology (Finale/Glow versus “reverse” pipeline)

- Robert noted **Glow/Finale** historically: **language → synthesized effect**; team’s approach: **effect video → summarized structured description** feeding the same downstream language. Harry: still mapping into a **defined internal schema** the model can write.

---


## Stakeholder Feedback & Actions

| Feedback / decision | Our response | Linear / evidence |
| ---- | ---- | ---- |
| Prioritize clarity on **MVP**: designed show → **Finale-importable CSV** over chasing Glow-grade visuals. | Reaffirmed CSV as proof point; animation/reconstruction framed as **data + iteration** for the curator, not a vendor render replacement. | Export track (e.g. [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv)). |
| Watch **time spent** on simulation versus core output; OK to lighten animation if it crowds CSV/show-generation work. | Team commits to keeping **CSV MVP** central; continued refinement with semester timeboxing (Mondays / limited hours). | Next milestone: MVP demo target **next ~3-week sprint**. |
| Guardrail: avoid **incorrect effect taxonomy** (wrong shell types) polluting user-facing data. | **Approval workflow** before catalogue promotion; stakeholder review of reconstructions; iterate on prompts/schema. | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database) and related catalogue work. |
| Robert may **update** product spreadsheet over time; team notes current dataset sufficient for now. | Continue ingesting Robert’s files via Liam’s pipeline; ping when refreshed CSV drops. | Data ingest tasks. |
| Use Robert’s **designer competition** doc as a **sanity-check** foundation for effect categories. | Already received; continue aligning prompt vocabulary with that baseline where helpful. | Robert-provided doc (referenced in call). |
> Cross-links live in the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144).

---


## Action Items

- **Team**: Target **polished MVP path** — upload music (+ constraints) → generate show → **Finale 3D–importable CSV** within the **next sprint cycle**; continue **music + CSV + reconstruction** integration under the hood.
- **Harrison**: Push **Finale/CSV export** testing and end-to-end flow.
- **Harry**: Keep improving **video reconstruction accuracy** (including multi-shot behaviour) and **admin approval UX** for catalogue items.
- **Chongyang**: Advance **MIR / music analysis** outputs for choreography hand-off.
- **Liam**: Continue **database + ingestion** from Robert’s spreadsheets; support catalogue approval data model.
- **Robert**: Optional **catalogue refresh** when ready; **review/approve** reconstructed fireworks as they enter the pipeline; share any **Finale 3D reference exports** that help validate CSV semantics; follow up on **July Canberra** plans if wanting an in-person touchpoint.
- **Cadence**: Next syncs **11, 18, 25 May**; team working **Mondays** primarily—expect incremental visible changes with deeper refactoring between demos.

---


## Full Transcript


<details>
<summary>Show full transcript</summary>

  **Harrison Black [0:03]**  Oh, thank you. How you been?

  **Robert Foti [0:06]**  Yeah, good, good, good, good. I think when I spoke to you last, I was in the US, right?

  **Harrison Black [0:12]**  I think, yes, I think it was, yeah.

  **Robert Foti [0:14]**  Yeah, so anyway, so been been been back a week or so now, so all good.

  **Harrison Black [0:20]**  That's always good to hear.Let me pull up your last email again.What?

  **Harry Randall [0:34]**  Ooh.Robert.

  **Harrison Black [0:36]**  You got.

  **Robert Foti [0:38]**  Morning.

  **Harry Randall [0:39]**  Alright.

  **Harrison Black [0:40]**  All right, I understand.

  **Liam Maloney [0:55]**  Blue.

  **Harrison Black [0:55]**  Mm.

  **Harry Randall [0:55]**  Mm.

  **Robert Foti [0:56]**  Morning.

  **Harrison Black [0:57]**  and.

  **Liam Maloney [0:59]**  Well, he's just off so much running.

  **Harry Randall [0:59]**  Ohh, just off, so we should probably kick off.

  **Harrison Black [0:59]**  No, I was just on search for me.

  **Robert Foti [1:08]**  All right, we all, we're all on or waiting for.

  **Harry Randall [1:12]**  I think he's not here.

  **Harrison Black [1:12]**  Thank you.

  **Robert Foti [1:13]**  Sure, alright, well, we'll get started anyway.

  **Harrison Black [1:17]**  Yeah.

  **Harry Randall [1:17]**  Yeah.

  **Robert Foti [1:18]**  All right.

  **Harrison Black [1:19]**  Hello.

  **Harry Randall [1:19]**  Good, good, Harrison.

  **Harrison Black [1:20]**  Okay, yeah.

  **Robert Foti [1:23]**  Yeah, good to go.

  **Harrison Black [1:25]**  Yeah.

  **Harry Randall [1:25]**  Yeah, true.

  **Robert Foti [1:28]**  Alright, um, so what's been...two or three weeks since we've last...I got a got together with Harrison last time, so yeah, but how's it going?

  **Harry Randall [1:43]**  Good, yeah, we've made some good progress, started integrating with the AI stuff.Yeah, we.Probably easy to show you, but yeah, we've made some some good progress.

  **Robert Foti [1:55]**  Uh, cool. Yeah, if, yeah, I think it, yeah, just, so what do you want to do? Just share a screen and run it through with me, will be the way to go.

  **Harry Randall [2:00]**  Ohh.Yeah, so much, friend.Mhm.Alright.See that?In fact.

  **Robert Foti [2:14]**  Yep.

  **Harry Randall [2:16]**  Cool.Black.Um, so...This is like the platform that we have now built, still like working on a little bit, but...Yeah, so like, this is where all the shows will be. This like whole UI and everything's going to go, but just like a good little demo place. We've been working on the actual, the render of the fireworks, which is getting better and more in line, like more effects and stuff. Like obviously that's going to be work, but...The sunny is like...or the 3D display.And then, and that, in terms of like, we've added these like tables and stuff, just for like admin management, like this will all get built on further, but that's just like a little side thing we're working on. Main thing is here, we've started on the the firework video [reconstruction.So](http://reconstruction.so/) you can upload a video. So I've just done it with...with the test ones that we have. I like that you sent through in your sheet. And yeah, it will basically create a 3D reconstruction straight from the video. So this is like the video that you sent through. And yeah, if we play [it.It](http://it.it/) will map it all and, you know, try out the colors and everything. It is like still like very early on, but it's a good little representation of where this is going to kind of go. And like this is all the data for it that is like, it basically like it takes a video, splits it up into chunks and then gets an image.

  **Robert Foti [3:56]**  Yep.

  **Harry Randall [4:05]**  from the image, it like analyzes all of the pixels and stuff, the colors. And yeah, basically we get this like output here, which is directly tied. That's how like the firework is mapped and created. And this information is like really good because we can feed this directly into the AI and it will like have like.

  **Robert Foti [4:05]**  Mhm.Yep.

  **Harry Randall [4:25]**  how big the firework is, the color, the length, all of that kind of stuff. And that will help us a lot. Like, this is like a very early, like this is just what it's saying the firework is about, but yeah, that will help with the actual creation and stuff.and then turning it into more of a...like a multi-shot thing.I think the best way to do it would just be like we create fireworks like this. So we're just going to create like a standalone firework, like one. And then if it's like a 20 shot, they're all comprised of like smaller fireworks, so we just like map them together. So we just like have 20 of these go off and yeah.

  **Robert Foti [5:09]**  So...

  **Harry Randall [5:10]**  That is.

  **Robert Foti [5:12]**  Okay, so if I'm understanding the, so you've got the video of the simulation, your, this is basically kind of copying the simulation and creating a, creating data about that firework, which is what all that, yeah, okay.

  **Harry Randall [5:17]**  Yeah.What is?Alright.Exactly.Yeah, if I change this to like, like this is like all dynamic and it's like straight from the AI. If I change this to this code, which is just white, you'll see the red score now. And if I change it again,

  **Robert Foti [5:43]**  Okay, [yeah.So](http://yeah.so/), so, yeah, got it, got it, got it. Alright, cool.

  **Harry Randall [5:48]**  Yeah.

  **Robert Foti [5:53]**  Alright, and if so, and what happens when it's a multi-shot firework?

  **Harry Randall [5:55]**  [Yeah.So](http://yeah.so/) it can do multi-shot. Like if you upload multi-shots, it will have like down here in the data, it's got shots. So like this is the first shot. If I copied this and like pasted it, it would have two shots. So it can handle multi-shot. But I think like in terms of like creating this and doing it, like I don't know how accurate it will be if it's like.many different shots. So my understanding is that like a multi-shot is comprised of like singular fireworks basically. Like if you turn a multi-shot into a...

  **Robert Foti [6:31]**  Yeah, it's a it's a it's a succession of tubes designed in a certain way. So you could have a 25 multi 25 shot multi shot which could have eight different effects in it.

  **Harry Randall [6:36]**  The.Yeah, so my idea is those eight effects we map separately, because it's easier for us just to map them one at a time. And then once we have like the those eight effects, we can like stick them all together and like recreate that simulation of the multi-shot. So it'll look the same, but it's like just like...On the code side, it's just eight different fireworks all glued together, if that makes sense.

  **Robert Foti [7:05]**  And that, and that would be manually OK.

  **Harry Randall [7:11]**  Well, like.

  **Robert Foti [7:12]**  You'd have to, it's a manual process.Sorry, I think you're frozen up for me. Hello?Beck.I've been muted.

  **Harry Randall [7:32]**  And.Hello?

  **Robert Foti [7:35]**  Ohh, now I can hear you.

  **Harry Randall [7:38]**  Yeah, no, it will all be all be automatic. It will like recognize, okay, this is a, I don't know the name of this firework, but it will like, okay, this is this firework, and then it'll be like, like the whole process will be automated. You just have to upload the video and it will map it automatically. And that will go to like the catalog page and then.From there, we can like build it into the actual show show stuff, but...

  **Robert Foti [8:03]**  Sorry, just sorry, I'm a bit unclear. So what happens if you put in a multi-shot firework now? What's the output if you do that?

  **Harry Randall [8:07]**  [Mhm.It](http://mhm.it/) will give you the demo of a multi-shot firework, but it may not be as accurate. Like, we're still working on like the accuracy of the model and stuff and like getting it to like demo correctly, but it will, if you put in a multi-shot, it will simulate the whole firework, the multi-shot.

  **Robert Foti [8:31]**  Oh, okay.

  **Harry Randall [8:33]**  Yeah, but that may just be a better way to do it, is all I'm saying. And we may look at that approach.

  **Robert Foti [8:39]**  All right.

  **Harry Randall [8:40]**  Yeah.Oh, sorry.

  **Robert Foti [8:43]**  Cool, and have you tried it with a real firework video rather than simulation or?

  **Harry Randall [8:48]**  Just simulation for now, but we will get on to real firework. Like, it's gonna have to be, like, it's gonna have to like black sky, it can't be like many other things going on. Like, I'm sure it'll work, it just won't be as accurate, you know, as like these like demos that we're using.

  **Robert Foti [8:50]**  Yep.Sure, okay, no worries.

  **Harry Randall [9:07]**  Yeah.Um.But yeah, that's kind of where we're at right now.

  **Robert Foti [9:16]**  Alright, so...My question with all of all of this is, so you saw my email the other day and my sort of questions about where we're at is...

  **Harry Randall [9:29]**  Yeah.

  **Robert Foti [9:31]**  At the moment, my immediate question is, what is the cost benefit for the project of focusing on the animation part?Um, when, like, the part that I'm interested in is...

  **Harry Randall [9:43]**  Call.

  **Robert Foti [9:47]**  The.being able to for it to design a show and like I think like my original scope, I don't care if that's just an Excel spreadsheet of a script. Where are we at with that? Because I'm that's the part that I'm not.Sure, where we're at with.

  **Harry Randall [10:09]**  I think Harrison is working on finale, but like, in terms of, like, the reason we're doing the simulation is because the closer we're able to like replicate an actual firework, the richer that data is going to be. So if we get like a one-to-one replication and we give all of that data to the AI, it's going to have like...a lot more like data points to access and it will like know like exactly what the firework is doing. If you just upload like a video like you did to Grok, like it will kind of know, it can take a guess, but if you give like every single point, it will have like a very detailed, like.Thought process on like, what's going on?

  **Robert Foti [10:45]**  Yay.Okay, so you so you're working at it from the assumption that you need to simulate the firework yourself first.

  **Harry Randall [10:49]**  Sure.

  **Robert Foti [10:58]**  For it to know all the data points of a particular firework before it can integrate that into a show.

  **Harry Randall [11:07]**  More or less, it's just going to help us. Like we could do it without doing this. It just wouldn't be as accurate and like we have the time for it, so we may as well. Yeah, once we've got that down pat, then all we have to do is like fit it into the AI and say like, oh, here are the constraints and everything.

  **Robert Foti [11:09]**  Yeah.

  **Harry Randall [11:26]**  Here's your list of fireworks. And it would have already like given it like the mood and everything, all those themes, and it would be like a little easier for it to pick.exactly what to do.

  **Robert Foti [11:36]**  Alright.

  **Harrison Black [11:38]**  The other thing when it comes to that too actually is that when you are like designing the show and you know, you're like talking with the AI about it, you're probably going to want to make like a lot of like small iterative changes and being able to, if we know how to simulate it, it'd be fairly easy to actually just show the whole fireworks show to the user.

  **Harry Randall [11:38]**  From the other side.

  **Robert Foti [11:59]**  Yeah.

  **Harrison Black [11:59]**  So they can, you just get immediate feedback and they can immediately see their changes without needing to like download the CSV and import it into Finale 3D, which is like a fairly like CPU intensive, whatever.

  **Robert Foti [12:08]**  Yeah, yeah.Oh, yeah, like the goal is that, absolutely. It's, yeah, I mean, a user's not going to be using Finale 3D. Finale 3D is just for our own internal process, just while we're kind of learning all of this and whatever.I'm just, uh...And please don't take my questions as being negative or whatever. I'm just trying to process this in my own mind, because on one level, I don't want to be reinventing the wheel when between Finale or Glow or, you know, the simulation and that data is already [there.So](http://there.so/) my original thinking was of why I was including Finale was, you know, can we use, Finale already exists, they already have a language for their firework, can we use that without having to reinvent the wheel?But what you're saying is that the most efficient way for you to get the data is to...To map each firework effectively.

  **Harry Randall [13:20]**  Yeah, pretty much. And that's all going to be automated. So once we have, like, once we train the AI or teach it to accurately represent, like, outline what the firework is, all of the different things, all the different colors and everything, I can do that for every firework. Then we have, it would be so much easier for us. Like right now, if we wanted to do it,

  **Robert Foti [13:36]**  Yep.

  **Harry Randall [13:40]**  It would be a lot of manual work we'd have to go through and like talk about each firework and write each one down. It's going to save us so much time in the long run, it would be so much more accurate as well.

  **Robert Foti [13:49]**  [Yeah.So](http://yeah.so/) between having the simulation and the written description of the firework, does that not help with doing that or...Have I given, have I given you a written catalog of fireworks?

  **Harry Randall [14:01]**  Um...Yes, you have. Yeah, yeah. So yeah, that will help as well. Like the more data, like with the AI, the more data you give it, the better. Like if you just give it a couple of things, you won't really know what to do, but if you give it all this data, like the description, like you said, all of the data points from the actual like demo that we're doing, will I be able to get like a really good like idea of what each firework is?

  **Robert Foti [14:06]**  Yeah, OK.Yeah, yeah.

  **Harry Randall [14:27]**  I'll be able to map to the like the clients or the user's request though.

  **Robert Foti [14:32]**  OK, alright. I mean, I'm keen to see.I have to go by what you guys are suggesting with it. Like I said, I'm just more about in terms of the efficiency and like for your time and where we're going to end up. And my only, I guess, question to you or challenge to you is, do you think you're going to be able toIn terms of the animation or the simulation, do you think you're going to be able to develop something that will be, I'm not going to say better or even exactly comparable, but at least be able to give you the, achieve the goal that you're trying to with this? That's my...My question?

  **Harry Randall [15:20]**  The idea is basically for this aspect of it to get like very similar to what Glue 3D has done. Like we want our demo to be like very similar to the kind of UI.And then once we have that, like, that is like a nice to have, like, we probably won't get there because it looks quite complicated, but we've got a good start on it.

  **Robert Foti [15:43]**  Yeah, okay. I mean, that's my only thing is...

  **Harry Randall [15:45]**  Yeah.Thanks.

  **Robert Foti [15:49]**  If we.

  **Harry Randall [15:53]**  Like, we're not reinventing the wheel, we just need a, like, we need to be there to actually feed this data in, so we have to kind of, yeah.

  **Robert Foti [15:56]**  What?Okay, yeah. I mean, you're reinventing the wheels, not what I mean. I mean, it's kind of like you're trying to achieve a Ferrari, but you don't want to just end up with a wheelbarrow and that's as far as you can get because it is complicated and there's a lot of technical aspects to it, which are not so simple. However, if that's where you, I mean, it's only one aspect of what you're doing, but if you feel that it'sGoing to give you the data to.

  **Harry Randall [16:28]**  Second one.

  **Robert Foti [16:28]**  that will provide the output, which is a design. In actual fact, the quality of the simulation isn't the goal. The goal is a designed show. The simulation is meant just as a visual representation of what your show might kind of look like. The output is the script.

  **Harry Randall [16:32]**  And.

  **Robert Foti [16:50]**  that will be used by a firing system. So yeah, so yeah, in my mind, I've got to not get hung up on glow is like the standard for the best level of animation. And we're not going to be able to achieve that. Or if we are, that'll be.unbelievable, but we're not going to achieve that level of accuracy. I mean, I had a big long discussion with the guy who's the glow developer. He has three full-time people just making simulations.That, like, that, that's all that their their goal is to simulate every consumer firework.

  **Harry Randall [17:26]**  Yeah.

  **Robert Foti [17:31]**  In the USA.

  **Harry Randall [17:32]**  Well, that's the thing, if we're able to do it from a video, and then we can just like...Like all of that work is just like you will not have to do any manual work for it and like the goal like...

  **Robert Foti [17:40]**  Oh, it'd be awesome if you could do if you could do it from a video and it'd be exact and it'd be describing that, that would be good. My question will be though, how accurately do we have enough information found baseline information now that

  **Harry Randall [17:44]**  Yeah, yeah.

  **Robert Foti [17:57]**  It will be able to describe it in a language that matches the language that users use or manufacturers use. That's a question.

  **Harry Randall [18:07]**  Can you explain what you mean by that?

  **Robert Foti [18:09]**  Well, okay, go back. If you go look at that example you gave me of that one shell and the...

  **Harry Randall [18:17]**  Let me show my screen.Um, how are we here? You mean?

  **Robert Foti [18:25]**  Yeah, so if you go down, like, like I look at that firework and I look at a, you go up to it again, it is a...I can't remember what it was. Was it a chrysanthem or... Yeah.

  **Harry Randall [18:36]**  Scott.Some of it is so required.

  **Robert Foti [18:39]**  So, like, let's say this is a palm or a crosset or a, you know, whatever technical term for the thing. How does, how does it know what to describe what as?

  **Harry Randall [18:44]**  [Mhm.Yeah.So](http://mhm.yeah.so/) like with the actual prompt when it's deciding, like when it's extracting the information and everything, it has a set list of what it could possibly be. So there are like 10 or 12 different firework types, like you were saying.

  **Robert Foti [19:05]**  And.And where, and where, where did you get that information from from the VDL?

  **Harry Randall [19:11]**  Um...From the video and also just from the web, just from doing research.

  **Robert Foti [19:16]**  Okay.

  **Harry Randall [19:17]**  So we got like as many as we could. But yeah, that's how it will, it's able to take its best guess at that. But you know, if it's wrong and you're like, oh no, that's completely different wrong, you can just come here and be like, oh, that's the wrong type. I want it to be this. That's the idea and you can just refine it and refine it and like, and then you get like a one-to-one copy.And once it's a one-to-one copy, you don't have to do anything else with it. So you just save it to like the catalog page, and then that firework is there and we have it imported. And.

  **Robert Foti [19:45]**  I mean, that, and that's where the consumer, like, you've got access to the icon catalog.Or no.

  **Harry Randall [19:54]**  What does that say?

  **Robert Foti [19:55]**  Sorry, you've got access to the icon finale catalog.

  **Harry Randall [20:00]**  Uh, Harrison would know.

  **Harrison Black [20:03]**  Yes, we do.

  **Harry Randall [20:03]**  Yeah, yeah.

  **Robert Foti [20:03]**  Yeah, all right, because with with the professional display fireworks, you know, there are mostly, there are multi-shots of course, but single shells are the best way to maybe get that data for learning, because there'll be a shell called a silver palm, yeah, and you know exactly what.Silver palm or silver palm with tail, like the name is generally the description or that's the way that I've built the icon catalog. So.Just consider, I'm just trying to think about, if you think that doing it the way you're doing it's going to get that accurate data, that's fine. I just don't want to be...Sullying up with inaccurate data, if that makes sense, but anyway, whatever.

  **Harry Randall [20:51]**  As in we show a firework and it looks different to how it actually would in real [life.So](http://life.so/), you mean by inaccurate?

  **Robert Foti [20:59]**  Yeah, or it describes something, but it's, you know, it describes A chrysanthemum, but actually it's a ********* palm, like, or, you know, it's a...

  **Harry Randall [21:07]**  Okay, yeah, yeah, that's a good point, yeah, yeah, yeah.

  **Robert Foti [21:09]**  Yeah, because, like, like we in the emotion of...The motion of the firework, that thing that I did, you know, crackle has a different impact to a...Gold willow, or go, you know, there's all of that, so there's parameters within the...

  **Harry Randall [21:20]**  Right.

  **Robert Foti [21:26]**  Um, firework that will...

  **Harry Randall [21:29]**  You.

  **Robert Foti [21:29]**  influence how it gets used in a design.

  **Harry Randall [21:32]**  That's actually another feature we've added. So like, we wouldn't be the one approving this. So we would just like be doing the demo and everything and you would be like importing the files. You would come down here, double check, okay, yeah, it's a Chris Anthem. And then you come back and you'd review it and then you'd approve it. And once you've like said, yeah, this is perfect, this is.exactly what it's meant to be, it will go to this Talun page, and from there, then it will be like propagated into like these libraries and stuff where the users can like, will be available to them, if that makes sense.

  **Robert Foti [22:02]**  Okay, so what you're actually creating at the moment is a tool. This, what we have just shown me is the tool for animating a firework.

  **Harry Randall [22:08]**  Yes, sir.More or less, yes, yeah, that's right.

  **Robert Foti [22:15]**  Yep.Okay.

  **Harry Randall [22:19]**  But that we need that to to design or like we don't it makes it a lot easier to actually do the.The...Generating the show based on prompts.

  **Robert Foti [22:33]**  Okay, alright.

  **Harry Randall [22:35]**  Yeah.

  **Robert Foti [22:36]**  So just like I said, I'm just trying to get an understanding of the strategy you're going with it so that that just helps me ask questions or whatever. So like I said, please don't take my questions as being doubting or

  **Harry Randall [22:41]**  What?Inyang.Which?Yeah, not at all.

  **Robert Foti [22:55]**  or cynical or whatever, it's, you know, I spend a lot of my time asking devil's advocate questions of people, so...

  **Harry Randall [23:01]**  Yeah, yeah, that's all good. It's better we're on the same page and we build something that you're happy with.

  **Robert Foti [23:05]**  Yeah, alright. So, at the moment, the general...Elements of what we're what you're building is one is the is an animation.Tool, for want of a better word.

  **Harry Randall [23:20]**  Mhm.

  **Robert Foti [23:21]**  Um...Was I correct that Chongyang you were working on the music or someone who was working on the music?

  **Harry Randall [23:30]**  I think it's okay too.

  **Robert Foti [23:31]**  Music analysis tool.

  **Chongyang Fang [23:31]**  Yeah, I'm working on the music.

  **Robert Foti [23:34]**  Yeah, so, so that would be a music analysis.

  **Harry Randall [23:34]**  You.

  **Chongyang Fang [23:34]**  Yeah, I'm working.

  **Robert Foti [23:39]**  Cool. What other elements of it are neat? What are the pieces of the jigsaw puzzle that will bring all this together apart from those two things?

  **Harry Randall [23:49]**  Uh, Harrison is working on the finale integration at the moment, just so we can give you that like MVP demo.

  **Robert Foti [23:56]**  So the finale integration will be a Excel file.

  **Harry Randall [23:57]**  Vince.This.

  **Harrison Black [24:02]**  Ahh.

  **Harry Randall [24:03]**  Whatever it takes as an input, if that's excellent, it could be CSV or something, yeah.

  **Robert Foti [24:07]**  Or C or CSV or whatever CSV.

  **Harrison Black [24:08]**  Yeah, it's just a CSV, I think.

  **Harry Randall [24:12]**  Yeah.

  **Robert Foti [24:14]**  All right, which?

  **Harry Randall [24:16]**  Yeah, very awesome.

  **Robert Foti [24:16]**  Should be a pretty simple, that's the simplest part actually, right?

  **Harrison Black [24:21]**  No, that'll be, that's a fairly like, um, simple part of it, yes. Yeah.

  **Harry Randall [24:21]**  The.Simple thought, yes, yeah.

  **Robert Foti [24:24]**  Yeah, okay. So then you got the... What other parts?

  **Harry Randall [24:28]**  Enders.Well, like importing into finale 3D isn't the hard part. It's more generating the show based on the requirements. Yeah, yeah. So like...

  **Robert Foti [24:35]**  Yeah, so, yeah, yeah. So, so the generating the show part, like, like have you guys all broken this project up into each of you are responsible for a different area or is that how it works?

  **Harry Randall [24:48]**  Yeah, pretty much. Yeah, we're working on different things.

  **Robert Foti [24:50]**  All [right.So](http://right.so/) then, Liam, what are you, what's your part of the project?

  **Harry Randall [24:54]**  [Stop.Is](http://stop.is/).

  **Robert Foti [24:59]**  I think you are on mute.

  **Liam Maloney [25:03]**  Sorry about that. I'm just working on general backend stuff, things to do with all the different databases and populating them with the like Excel files you have sent us.

  **Robert Foti [25:11]**  Yep.Yeah.

  **Liam Maloney [25:19]**  But it's not exactly a feature like in terms of the whole process line of stream of the prompt to show just like.

  **Robert Foti [25:30]**  More of an infrastructure.

  **Liam Maloney [25:32]**  Yeah.

  **Robert Foti [25:34]**  Yep. All right. Cool. So then the, with all of those elements being built, what you're saying is you're going to build all of these and thenThat's when you, the AI aspect of designing a show will come into it, after all of those things are locked in. Is that how...

  **Harry Randall [25:52]**  I.Not really, like, we're probably at this stage now, if we wanted to, like, design the MVP, we could do it with everything that we have right now. We could have it to, it won't be very accurate right now, but we could have it so we have some firework examples, we give a prompt, we give our budget.and it will be able to spit out a show which we can import into Finale 3D. We're probably at that stage now. It won't be very good. That's why it's better. I think it's better if we work on it a bit and improve that aspect of it. We're almost there, to be honest.

  **Robert Foti [26:31]**  Okay, so when you say almost, what does that mean in terms of timeframe?

  **Harry Randall [26:37]**  Well, it depends how good you want it to be for the MVP. Probably, what week are we in? Week 9.We should be.Six.

  **Robert Foti [26:50]**  I.

  **Harry Randall [26:52]**  Probably.Three weeks. We could do it like today if you wanted to and like it would be fine. But if you wanted like a nice polished kind of MVP version, well, we've broken it down into sprints. So every three weeks is like a new kind of target. And this is our last day, I think, of the sprint.

  **Robert Foti [27:09]**  Yeah.Yeah.

  **Harry Randall [27:14]**  So I'll say, so yeah, we set the goal for our next print goal to finish and send you the MVP. That'll probably work. Because yeah, we still have to do like the music stuff and like integrate that.

  **Robert Foti [27:24]**  OK, so.Yeah, so, so, so that'll be, you'll be able to upload, upload a piece of music, say design the show, and it'll put in those hammer and anvil cakes from that database that I sent you in in that, and I I need to.Probably update, update that more, actually.

  **Harry Randall [27:48]**  [The.It](http://the.it/)'s fine to know. I wouldn't worry. We have enough to go off right now.

  **Robert Foti [27:54]**  Okay.And it'll be able to spit out the CSV file.

  **Harry Randall [28:02]**  Okay.

  **Robert Foti [28:02]**  Some sort of animation, but a CSV file, so I could put that.

  **Harry Randall [28:06]**  I.

  **Robert Foti [28:12]**  Finale 3, and it'll show the show.Sorry, you all froze there for a second.

  **Harry Randall [28:16]**  Yeah, I know.Yeah, that's right. That's probably what we would, that's clear the goal, yes. Yeah.

  **Robert Foti [28:25]**  Okay. And all right, cool. The alien, this is just a little thing. On the show, in terms of show parameters, I don't think, I don't know, sure if you noticed in Glow that you can choose like one, two or three positions.I don't know if...

  **Harry Randall [28:44]**  Oh, like where the thing is shooting from in the... Yeah, yeah, we...

  **Robert Foti [28:47]**  Yeah, you can, like, you can shoot 3 fireworks at the same time or one.

  **Harry Randall [28:51]**  Yeah, we're going to have that as well. That will be, you can choose like the position. And one of like the stretch goals we kind of want to add, like if we have time down at the very end is integrating like Google Maps. So you could like put your address in and then like outside of your house, you can like see, you can like say like, I want to see what it looks like outside of my house.And that should be able to work and be still like a 3D display, but yeah, we'll have different, what's it called where they shoot out of on the ground?The the.

  **Robert Foti [29:19]**  What do you mean, what's a code?

  **Harry Randall [29:20]**  Like the box, there's like a name for...

  **Robert Foti [29:23]**  The cake.

  **Harry Randall [29:25]**  No.

  **Robert Foti [29:25]**  The multi-shot.

  **Harry Randall [29:27]**  No.

  **Robert Foti [29:28]**  Yeah.

  **Harry Randall [29:30]**  I figured, anyway, like a cake, yeah, where the cake sits.

  **Robert Foti [29:34]**  It's just a position. That's just its position. It's just its position. Yeah, yeah. Because you probably saw Finale does the Google Map thing as well. So

  **Harry Randall [29:36]**  Yeah, I guess, yeah, yeah.Oh no, I don't know they did that.

  **Robert Foti [29:46]**  Yeah, you can import a 3D model.

  **Harry Randall [29:49]**  Is finale only? I thought finale was 2D only.

  **Robert Foti [29:49]**  Um...

  **Harry Randall [29:54]**  Is that correct?

  **Robert Foti [29:55]**  Yeah, but you can input a 3D model. Oh, no, it's 3D, yeah.

  **Harry Randall [30:00]**  You can like move around while the fireworks. Okay, okay. Yeah.

  **Robert Foti [30:01]**  Oh yeah, [absolutely.So](http://absolutely.so/) like when we do Sydney New Year's Eve, we literally have a 3D model of Sydney.Sydney Harbour Bridge and buildings and whatever. And then when we do our simulation, it'll zoom around.

  **Harry Randall [30:20]**  That's cool.

  **Robert Foti [30:21]**  Yeah.

  **Harry Randall [30:22]**  Like different points in Sydney where you can watch it from.

  **Robert Foti [30:24]**  Well yeah, just do you want to show you an example of it or?

  **Harry Randall [30:28]**  Yeah, obviously, yeah, definitely.

  **Robert Foti [30:30]**  One second, I'm not, let me see if I can find...

  **Harry Randall [30:35]**  How many years have you been doing the show now?

  **Robert Foti [30:37]**  Sydney since 1997.

  **Harry Randall [30:38]**  Like, yeah.Yeah, that's crazy because I was like, I've watched it many times. Like I grew up watching the show. It's very beautiful.

  **Robert Foti [30:48]**  Thank you.

  **Harry Randall [30:48]**  I remember when you first did like the bridge thing as well, it was very, very cool.

  **Robert Foti [30:52]**  So we started doing the bridge in, so previously there was two companies involved and we were the sole contractors from 2000 onwards, 2000, 2001. So one second.

  **Harry Randall [31:06]**  [In.Yeah.Do](http://in.yeah.do/) you go every year and you watch it?

  **Robert Foti [31:13]**  Who made?

  **Harry Randall [31:14]**  Yeah, yeah.

  **Robert Foti [31:15]**  I go and work. I was hoping this year to, I was hoping this year to watch it, but I was actually shooting a rooftop in Circular Quay.

  **Harry Randall [31:17]**  Oh, yeah, that makes [sense.Do](http://sense.do/) you get like a good view of it all then?

  **Robert Foti [31:31]**  Oh, well, I did this year because I was literally on the best position.

  **Harry Randall [31:38]**  Mm.

  **Robert Foti [31:40]**  For the last few years, I've been in the control room, which isn't a bad view.But previous to that, you're firing the show and you don't see anything.

  **Harry Randall [31:47]**  Because.Yeah, I just remember you have to wake up at like 8 A.m. to go find a park to sit on and just reserve your spot together. Yeah.

  **Robert Foti [31:57]**  Yeah. Yeah, because when you're shooting the show, you're inside a shipping container. So let me, give me a second, because I want to find this.

  **Harry Randall [32:02]**  And.

  **Robert Foti [32:07]**  Find this ******* video, sorry. I think I've deleted them all.Not important, but just to show you the kind of output that...

  **Harry Randall [32:17]**  K.

  **Robert Foti [32:22]**  One minute.This isn't a great video. This was, let me, okay, one second.I'm gonna share. I will share my screen.

  **Harry Randall [32:50]**  Next to the leave call, the share button.Top right.

  **Robert Foti [32:58]**  Yeah.Alright, can you see anything?

  **Harry Randall [33:01]**  Yeah, we can see it.

  **Robert Foti [33:03]**  This is actually part of a tender pitch we did. This isn't a good...Actually, this isn't good at showing the...3D aspect of it. Let me.Hold on. Oh yeah, here we go.This is just to show you the three, how what it looks like.

  **Harry Randall [33:34]**  Yeah.Yeah.I.

  **Robert Foti [33:41]**  So, hey, it's pretty good, actually.

  **Harry Randall [33:45]**  That's insanely good.The.Are they the only spots that the... I thought there were more locations that did the fireworks.

  **Robert Foti [33:59]**  Sorry?

  **Harry Randall [34:00]**  Do they do it anywhere else in Sydney? Like, is this like just for the fireworks, like, um...

  **Robert Foti [34:03]**  Do what anywhere else?

  **Harry Randall [34:08]**  Is it just like this is like the main spot?

  **Robert Foti [34:11]**  What do you mean?

  **Harry Randall [34:12]**  Like, uh...

  **Robert Foti [34:14]**  How many other, how many other fireworks shows do they do?

  **Harry Randall [34:17]**  Yeah, yeah.

  **Robert Foti [34:18]**  Oh, well, they just did, they just did 35 nights on Sydney Harbour for Phantom of the Opera, like they...

  **Harry Randall [34:19]**  Now, what?

  **Robert Foti [34:27]**  They're doing, they do hundreds of shows a year through the year.

  **Harry Randall [34:30]**  Yeah, yeah.Cool, OK.

  **Robert Foti [34:35]**  Anyway, sorry, I just wanted to show you the how the finale 3, what it what it does, just for your reference. All right, so, so what's the next by next week? What's the aim to where to be at?

  **Harry Randall [34:39]**  Did you?Yeah, yeah, it's good to see you.Um, I think Harrison will probably work on like getting the input working, uh, just testing.And then yeah, we're just still like refining the data, trying to get the video.Import just getting that whole flow better.

  **Robert Foti [35:10]**  Yeah.

  **Harry Randall [35:12]**  Yeah, nothing huge. Like we've got a lot of the fundamentals down just now, improving it, refactoring it, like I think.

  **Robert Foti [35:19]**  Okay, cool. So, in so in terms of like a website or whatever.Like I said, for me, the website's not really the important part at the moment, other than the tool, the show part, but it sounds like what you're, part of what Liam is building is that back end part, which is for managing it [all.Is](http://all.is/) that is that my understanding correct, like that? So, that'll be a part that, as a...

  **Harry Randall [35:47]**  Not on.

  **Robert Foti [35:53]**  Not as a end user, but as a... I would be managing.

  **Liam Maloney [35:58]**  Well, back, that's not quite what backend is. Backend's just like, you know, more system sort of stuff. What Harrison's been working towards building in that video, or not Harrison, Harry.

  **Harry Randall [35:59]**  Okay.

  **Robert Foti [35:59]**  Wonderful.

  **Harry Randall [36:00]**  Bye.All the stuff.

  **Liam Maloney [36:14]**  to that video to simulation thing, that's for the admins and for the managers to use.

  **Robert Foti [36:23]**  Yeah, I'd say, yeah, backend's not the right word, but the...

  **Liam Maloney [36:24]**  That's not what the consumer, consumer is not going to have to do that. That's what if you want to use the application, you as a supplier or a manufacturer will provide and do that.

  **Robert Foti [36:35]**  So, but in that part, like that, I guess it was more of a user interface for a manager, that is that effectively going, that catalog will be something that I would be able to go in and manage and put a price in or quantities or whatever.

  **Liam Maloney [36:43]**  The.

  **Harry Randall [36:43]**  Yeah.Exactly, yeah. So we're gonna have like...

  **Liam Maloney [36:53]**  Yeah, yeah, we're gonna have things.

  **Robert Foti [36:55]**  Kind of a...

  **Harry Randall [36:57]**  The suppliers page will be like all the suppliers that we have and they'd like go in and import all of the catalog everything. This is more just for like admins like you and like your team or whatever to approve fireworks and they get added like our collection like this is what we have available for like demo and stuff and then they can say like oh this is actually what we have in stock.

  **Liam Maloney [36:57]**  This supplied, very old supplies.But, when they kind of load everything, this is more displayed and view, and like 15 or whatever fireworks, and they get out of my collection, this is what we have available, demo, and they can see that all this actually being installed, and then we have different goals, I, I, I...

  **Robert Foti [37:09]**  Yep.

  **Harry Randall [37:17]**  And yeah, we have different roles. I added you as an admin, but we have like a supplier in this user. A user would just be able to see these pages. They wouldn't be able to go to the admin page. So yeah, and then I know you mentioned you didn't really like this page. The reason we have this is like we have like our own rubric.

  **Liam Maloney [37:21]**  And it was like the suppliers, but usually we just never see these things, they wouldn't get any.

  **Robert Foti [37:21]**  Yeah.Yep.

  **Liam Maloney [37:29]**  Yeah, I know, I know you mentioned he doesn't really like the reason we have this is, like, we have like our...

  **Harry Randall [37:37]**  We have to like pick stuff off, kind of, yeah, so it's just like, yeah, um, yeah.

  **Liam Maloney [37:37]**  Like, fix them all, and yeah, so it's just...

  **Robert Foti [37:37]**  No, no, no problem, that's fine.Yep. And don't worry about my colour scheme. The blue's nicer. But yeah, no, I understand that there's, yeah, and I understand the whole sort of back-end database, well, not back-end, but the database stuff, because I've worked on a few projects of developing database since then.

  **Liam Maloney [37:42]**  Have been.Yeah.Okay.

  **Harry Randall [37:48]**  Okay.

  **Liam Maloney [37:51]**  Yeah.Yeah.

  **Robert Foti [38:01]**  like a kind of a CRM or an ERP system. So, and that's one of the things that glow is actually going to be.Building is an account management element to it, so I can go in and add products or manage what people see, so yeah.All right.

  **Harry Randall [38:28]**  Yeah, we'll have similar features to that, but yeah.

  **Robert Foti [38:30]**  All right, cool. Do you have any questions for me or?

  **Harry Randall [38:32]**  [Boom.No](http://boom.no/), it's just, yeah, we only work on this like on Mondays, so like from now we only have 5 hours to work on it. So we'll do as much as we can in the time that we have. Yeah, like sometimes the progress is slow.

  **Robert Foti [38:44]**  Yeah.Sure.I mean, and that's why I keep asking about time, you know, good use of time and and whatever, and just, like I said, if the animation thing is taking an inordinate amount of...Resource time resources for you, then it's OK if, if...Yeah, the output is the CSV file, but you guys seem to have a direction with it, and it's also a fun part of it too, I guess, so yeah.

  **Harry Randall [39:18]**  Yeah.Yeah, exactly. But yeah, like in terms of like next week, like it may look pretty similar to this, but there are just like changes under the hood that we've made that make it better and easier for us. So yeah, just good to keep in mind.

  **Robert Foti [39:30]**  Shop.Okay, can you guys remind me of what our schedule looks like for the next, like, how long the project goes for?

  **Harry Randall [39:42]**  Yes.

  **Harrison Black [39:42]**  Yeah, so we have another, so after today we have another three meetings. So if I just pull up my calendar real quick, actually, hold on. So we have another three weeks. So I'll, so we'd meet again on the 11th, 18th and 25th.

  **Robert Foti [40:01]**  Yep, got it.

  **Harrison Black [40:01]**  As long as you're available, then we have our, we have like a break between semesters, so we're actually off for quite a bit. Let me just see. Yeah, something like that, and then, yes, that would mark about that, and then...

  **Harry Randall [40:14]**  It's like 21 July, we come back. Yeah.Dial Bob.

  **Harrison Black [40:20]**  we would have another basically 9 weeks starting the 21st July or whatever that is sometime late July in order to like get this out.

  **Robert Foti [40:31]**  Okay, cool. And when do you, because I'm actually coming to Canberra, but that's not going to be until early July. You're on holidays at that time, right?

  **Harry Randall [40:40]**  Still made up, I'll be in camera if you wanted to, more than happy to.

  **Harrison Black [40:41]**  Yeah.I should be in camera.

  **Robert Foti [40:46]**  Alright, well, I'll let you know if...

  **Harry Randall [40:46]**  Nope.The talking points.

  **Robert Foti [40:49]**  Yeah, I'll let you know. Could that be good to meet up in person? Alright, no cool. Alright, well I'll let you guys get to it.

  **Harry Randall [40:51]**  Yeah.Yeah, feel free to send them, like, the email, yeah.

  **Robert Foti [41:00]**  Thank you. It's all looking good. Looks really good.

  **Harry Randall [41:05]**  The emails that you send are quite helpful, like it, like if we're ever like, you know, pulling a stray on something or like you've got a good idea, like the devil's advocate stuff is quite helpful because it like gets us into a different thought of mind, so definitely keep sending those emails.

  **Robert Foti [41:20]**  Yep, all right. Yeah, because the thing that you're doing something, in terms of what you're doing with the animation, you're doing it in the reverse way of what Finale and Glow have done it.Finale and Glow of each created a language; they define the description of it, and then create the effect. What you're doing is taking the effect.First, and then define defining what that is, so it's a different, it's a different.

  **Harry Randall [41:56]**  I think it's pretty similar. We have the language like them. We have a language, but we're just getting the AI to summarize the firework and write it into that language that it can read.

  **Robert Foti [42:05]**  Okay, so in terms of when you say you have that language, do you have a list of...The.

  **Harry Randall [42:13]**  Yeah, like remember, I think I should do before work, like change one of the things and it changed the color. That's pretty much the language or the structure that it would use.

  **Robert Foti [42:19]**  Yeah, but do you have a database of that language? Like, do you have a table that's that has all of that? Is it as simple as that?

  **Harry Randall [42:27]**  Yeah, I'll show you [quickly.So](http://quickly.so/) this is our database and like these are some of the effects that we have as like a description of the effect and then got some like fields about it and then this is where actually all of the main data is. So it's got like colors and stuff and how long the life will be, the effect, that kind of stuff and like that's all defined [here.So](http://here.so/) it basically just like writes this.

  **Robert Foti [42:57]**  Yeah, because the only thing that I want to be able to, or where my input would be is to make sure that you're not missing.A type.Like, you know.

  **Harry Randall [43:10]**  Gotcha, yeah, yeah, yeah, I know what you mean, yeah, yeah.

  **Robert Foti [43:12]**  Sorry, all right, because you know, so you've got, you know, because you've got the different types to start with. Actually, I think, did I send you that, Ashley, that was probably a good start. Did I send you that designer firework competition document that I made for kids?

  **Harry Randall [43:21]**  Mmh.Yeah, you did. It showed like five or six different types of like natural fireworks and yeah.

  **Robert Foti [43:35]**  Yeah, okay. So I mean, to be honest, if you just follow that as a very basic, if that's being used as a basic

  **Harry Randall [43:42]**  Done.

  **Robert Foti [43:49]**  foundation for it, that's not bad either. But anyway, alright, I'll let you guys get to your work on if you haven't, unless you've got many more questions.

  **Harry Randall [43:57]**  So good for now. Thank you, Robert.

  **Robert Foti [44:00]**  Have a good day. Cheers.

  **Harry Randall [44:01]**  You too. Take care. Bye bye.

  **Harrison Black [44:02]**  Have a good one, Robert.

  **Robert Foti [44:03]**  Thank you.

</details>



