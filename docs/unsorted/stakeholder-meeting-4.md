---
notion-url: https://www.notion.so/Stakeholder-Meeting-4-34ccd8a5bf088143885cc94ca0c51bf3
title: "Stakeholder Meeting 4"
from_notion: https://www.notion.so/Stakeholder-Meeting-4-34ccd8a5bf088143885cc94ca0c51bf3
author: From Notion
last_edited_time: '2026-04-24T09:29:00.000Z'
---
> **Date** · 20 April 2026 · **Duration** · ~26 minutes (auto-transcribed)
  **Platform** · Microsoft Teams (recording title: TechLauncher-Fireworks-20260420)

  **Attendees** · Harrison Black, Chongyang Fang, Robert Foti

  **Absent / async** · Harry Randall (unwell), Liam Maloney (Sydney)


---


## Overview

Interim stakeholder sync at the start of Sprint 2 while part of the team was unavailable in person. Harrison and Fang represented the group. Robert checked whether the catalogue, videos, and Finale 3D-style prompts give the team enough to proceed, pushed hard on **realistic expectations for in-browser rendering**, and reaffirmed that **a clean Finale 3D import path (spreadsheet + script + music)** is the primary MVP bar. Animated web previews are a stretch goal compared with letting Finale 3D simulate.


---


## Topics Discussed


### Visualization approach

- Harrison explained the website still needs a way to preview fireworks, currently leaning toward a **custom particle / engine-backed approach** (e.g. Godot) versus **re-using supplier videos**.
- Robert cautioned that **accurate effect rendering from text descriptions is a multi-person, multi-year problem** for vendors like Glow and Finale; he recommended **re-using existing simulations/videos** where possible so the team does not ship something that looks “average” relative to industry tools.
- Alignment: **priority for this sprint remains MIR / analysis**, not a polished public renderer.

### MVP definition: Finale 3D as the simulator

- Robert’s “big step” milestone: generate a **Finale 3D–compatible workbook / script export** that imports cleanly, carries the show, and syncs with the music—then **use Finale 3D for visualization**.
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

- Fang summarized work on the **music analysis tool**: segmenting music, tempo/movement features, evaluating libraries that need tuning for commercial use.
- Noted **Harrison built the initial prototype** and Fang has been **optimizing / extending** it.

---


## Stakeholder Feedback & Actions

| Feedback / decision | Our response | Linear / evidence |
| ---- | ---- | ---- |
| Treat **Finale 3D import + music** as the core MVP proof; web animation is secondary. | Keep Sprint 2 focus on MIR + data layer + platform skeleton; simulation spike stays exploratory. | [FIR-35](https://linear.app/fireworkentertainment/issue/FIR-35/implement-industry-and-generic-export-format-support-ignite-csv), [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) |
| Prefer re-using vendor simulations/video rather than rebuilding high-fidelity renders from prose. | Godot/particle prototype is for communication / risk reduction, not a Glow-quality renderer. | [FIR-28](https://linear.app/fireworkentertainment/issue/FIR-28/write-research-methods-for-firework-simulation) |
| Confirm data + VDL coverage is enough; offer more catalogue/video if needed. | Harrison to sync with Harry & Liam when back; continue using Finale 3D ground truth. | [FIR-45](https://linear.app/fireworkentertainment/issue/FIR-45/update-supabase-with-new-sample-database), [FIR-24](https://linear.app/fireworkentertainment/issue/FIR-24/spike-evaluate-and-select-core-mir-librariesapis) |
| Next meeting ~**4 May 2026** after ANZAC / travel disruption. | Update Sprint 2 calendar + WhatsApp thread; keep async updates open. | [Sprint 2 - Platform Skeleton, Database & MIR](https://www.notion.so/345cd8a5bf0881139db2e8370f553d76) |
> Cross-links live in the [Stakeholder Feedback Log](https://www.notion.so/345cd8a5bf0881579b96c2a37a854144).

---


## Action Items

- **Team (Harry / Liam / Harrison)**: Confirm the **next stakeholder session** (target **4 May 2026**) and circulate dial-in details.
- **Harrison / Fang**: Keep **MIR tool** on track; prepare a concise MIR output sample for Robert when Harry is back.
- **Harry / Liam**: Resume **platform + Supabase** work async; align on **branch strategy vs. Issue & Merging Guide** (one branch per Linear/GitHub issue).
- **Robert**: Continue supplying **VDL-aligned prompts**; flag if upgraded Finale 3D licensing can help the CSV round-trip spike later in Sprint 2.

---


## Full Transcript


<details>
<summary>Show full transcript</summary>

  *Source file: **`TechLauncher- Fireworks Meeting 200426.docx`** (Microsoft Teams auto-transcription, verbatim — backchannel fillers preserved from the source.)*

  **Robert Foti [0:03]**
Which will have.Ohh.The whole of my catalog in glow, but if you need more Fireworks catalog to...for it, let me know and I can work that out. Are you using the videos as well or just the written descriptions or both?

  **Harrison Black [0:22]**
And.I'm still slightly unsure at this point because my side of this project looks like it's more going to be doing the, well, it's going to be doing the visualization, which at this point we might use videos or we might build our own custom [renderer.It](http://renderer.it/)'s a little unsure. It also depends how we're going for time and like just how complex we think it's going to be. Right now, I think we're looking more towards just building our own like particle system for rendering, because that would just be more like it.

  **Robert Foti [1:03]**
What do you mean for creating the actual render?

  **Harrison Black [1:07]**
Yeah, so when, um...Like on the website that we're going to be hosting, you're going to be able to see like the visualization of like the Fireworks, right? Yeah, so for that, we're still debating whether or not we should be just rendering our own, just using like a particle system, or if we should just be like using videos and just like overlaying them, because the particle system would...

  **Robert Foti [1:16]**
Yeah.

  **Harrison Black [1:32]**
It might not look as accurate, but it might be able to like exist in like a 3D space better, basically.

  **Robert Foti [1:41]**
Can, can you so what the videos that I'm providing 'cause I...That's really hard to do. And I only say that because the guys at Glow or whatever, they, that's their full-time and finale, that's their full-time job. And it takes a long time and a lot of development to get to the, be able to make a render of the Fireworks.

  **Harrison Black [1:52]**
[Mm.Mm](http://mm.mm/).

  **Robert Foti [2:08]**
based on a description. It's not a simple process. I don't recommend trying to do that. I would recommend if there is a way to use the existing.

  **Harrison Black [2:10]**
[Mm.Yeah.Mm](http://mm.yeah.mm/).

  **Robert Foti [2:23]**
Um...Videos, the existing simulations for doing that. If that's there's a way to do that, I would recommend that, because you're gonna end up looking, like I said, these guys, that's what they do, and it's not simple. It's not like, yeah, so...

  **Harrison Black [2:36]**
The same [thing.And.No](http://thing.and.no/), of course.

  **Robert Foti [2:44]**
That's one thing I would.Yeah, consider, and...Yeah.

  **Harrison Black [2:55]**
Yeah, the only reason why we might have at least somewhat of a chance of it is because I'm pretty sure they'd be using their own like render pipelines, I'm assuming. Like, yeah.

  **Robert Foti [3:04]**
Yeah, they've developed their own language for it, correct?

  **Harrison Black [3:08]**
Yeah, no, because what we would be doing is we would be using an off-the-shelf, like, game engine, I think, Gido was the one that has its own like built-in like particle systems and whatnot. And we would just be using those to like create.

  **Robert Foti [3:17]**
Yes.But then, but how would it be able to, but how would it be able to?

  **Harrison Black [3:25]**
Same effects.And.

  **Robert Foti [3:29]**
create the angles, the colors, the effects, whatever, according to what the design is. Like, I guess what I'm saying is these guys, if it was easy to do, they'd be doing it because they're spending a lot of time and resources doing it. So I'm only saying because I don't want you to be spending time on something that'll look

  **Harrison Black [3:47]**
Mm.

  **Robert Foti [3:52]**
End up looking pretty average and not actually achieve what you're hoping that it will achieve.

  **Harrison Black [3:55]**
[Yes.No](http://yes.no/), of course. Yeah, it is something that we're just going to have to look at in the future. But for now, the main thing we're just trying to do is just get the music.

  **Robert Foti [4:00]**
What?

  **Harrison Black [4:11]**
Analysis done.

  **Robert Foti [4:13]**
Yeah, sure. Well, yeah, I mean, because I think in the end, I mean, the visualizations like the ultimate, yeah, that'd be great. But if the output can just be a finale 3D Excel file that you can import, I think that would be a huge step. And then let finale 3D do the

  **Harrison Black [4:21]**
[Hmm.Mm](http://hmm.mm/).

  **Robert Foti [4:34]**
Um...

  **Harrison Black [4:36]**
OK, let me just check.

  **Robert Foti [4:36]**
Do the visualization.

  **Harrison Black [4:39]**
Mm.

  **Robert Foti [4:39]**
My gut feeling tells me that in terms of what's a realistic...

  **Harrison Black [4:42]**
I see.

  **Robert Foti [4:46]**
And, and I could be wrong with this, so I'm happy to be be be wrong and for you to disagree, but I think the...

  **Harrison Black [4:49]**
Okay.I can check.

  **Robert Foti [4:55]**
If you can get to that point, that's a big, big step in itself. And then for it to be able to import that Excel file into Finale 3D, import your script into Finale 3D and have the music, that would be a huge achievement in itself. Having it animated, yeah, that's like a stretch goal.

  **Harrison Black [5:00]**
Mmh.Thank [you.App.Okay.My](http://you.app.okay.my/) phone.

  **Robert Foti [5:15]**
would be fantastic. I don't think it's achievable the way you go on about it.

  **Harrison Black [5:17]**
In.But.Yeah, no, fair enough.

  **Robert Foti [5:24]**
Um...But I stand to be corrected, but it's just, yeah, I mean, I had, it was just to let you know what I've been doing. I had a long discussion with the guy from Glow and also long discussion with the guy from the Ignite firing system.

  **Harrison Black [5:29]**
[Mhm.Play](http://mhm.play/) the song.Ready.

  **Robert Foti [5:46]**
[And.You](http://and.you/) know, they...

  **Harrison Black [5:50]**
So what I'll do is don't stand to.

  **Robert Foti [5:51]**
You know, they're not stupid guys. This is, you know, they're very experienced guys and they're...They're like, yeah, yeah, the AI is where it's going to be headed. We don't have the time to work on it now, but you know that, but it's not as simple. I mean, what they're saying, and I'm saying repeating this without actually knowing the background to it, is that for the learning to happen, you know, they say their description of was, you know, AI is learning because it's got millions of.

  **Harrison Black [6:06]**
App.

  **Robert Foti [6:22]**
pages of data that are scoured through on the internet or whatever.

  **Harrison Black [6:26]**
Mm.

  **Robert Foti [6:28]**
So, it's got access to metadata coming out and seas, whereas WhatsApp Fireworks data is very limited.

  **Harrison Black [6:30]**
[Yeah.Mm](http://yeah.mm/).

  **Robert Foti [6:37]**
So, anyway, so that's, yeah.

  **Harrison Black [6:43]**
No, there definitely will be some challenges when it comes to doing that, yeah.

  **Robert Foti [6:48]**
Anyway.

  **Harrison Black [6:50]**
The next set is raining.

  **Robert Foti [6:53]**
All right. Is there anything that you need for me or that will help with anything that you're doing at the moment?

  **Harrison Black [6:55]**
[No.Any.No](http://no.any.no/).Not that I can think of it at this point, no. I think right now...Yeah, we're just gonna...get through what we can. Again, it's a little annoying because a lot of the team isn't here today. There's something really nasty going around.That is also going with the Anzac Day holiday coming up, because that means it's not going to be able to come here on Monday.

  **Robert Foti [7:29]**
So will you guys be getting together next week?

  **Harrison Black [7:33]**
Maybe. We're definitely still going to be working on the project for sure. It just might be that we have to work on it throughout the week instead of like on the public holiday.

  **Robert Foti [7:45]**
Yep.

  **Harrison Black [7:45]**
Or at least if we are working on the public holiday, it can't be here in this [space.So](http://space.so/) yeah, but we will still be like working, the same amount of work would just be done. It just means that we're just not going to be able to collaborate together as easily, basically.

  **Robert Foti [8:00]**
OK, so just so I understand where you guys are at, clearer, so at the moment you're doing the music music analysis.

  **Harrison Black [8:03]**
Go [on.Mm](http://on.mm/).Yeah, yeah.

  **Robert Foti [8:16]**
And that's all pretty, there's a lot of established data about that already for getting Fireworks in the world. So the next step after that will be

  **Harrison Black [8:21]**
[Noble.Mm](http://noble.mm/).

  **Robert Foti [8:33]**
The Fireworks data.

  **Harrison Black [8:36]**
Um...Yeah, so from my understanding, and I could be slightly wrong, I think Harry knows a bit more about this than I do. Basically, the general idea is that instead of training our model from scratch, because that would require a lot of resources,Basically what we're going to be doing is we're going to be getting like a general like language model and we're going to be like...We're going to be feeding it data about the music and about like the Fireworks. And it's going to be making decisions on, you know, what exactly to do. And basically, we're just going to be doing a thing called prompt engineering on the, like an already established [LLM.Like](http://llm.like/) something like.What are we considering using?The LLM, I think it'd be something like, you know, we're going to be using GPT40 or, you know, Claude Sonnet 4.6 or something like that. Yeah, just when just separate the music into different parts and like we tagged them.

  **Robert Foti [9:41]**
Yeah.

  **Harrison Black [9:50]**
Hmm, we separate the music like from the uh, from start to middle, the end, to tap, to...Like, we separate them into different sections to, like, like this is happy in motion, that's that, that's exciting, something like that, and...Uhh...So basically, we, I think the general idea is we extract as much information about the music as possible. We give the AI a bunch of like time stamps and like in basis, as much information on the music as we can, and as much information on the Fireworks as we can. And this is going to be a lot of like iterative prompting until we can get it to a point whereIt'll be able to generate, you know, a fireworks show on a, you know, a certain budget, you know, a certain efficiency. Um, it probably won't.

  **Robert Foti [10:40]**
So is that similar to, so will that be based on like the, like I gave you those, I guess, prompts based on the finale 3D, the visual display language that they use? Is that, you're using that, excuse me, you're using that as a foundation for

  **Harrison Black [10:55]**
Mm.

  **Robert Foti [11:03]**
Saying this is what the Fireworks can do and trying to match that with the music. Is that the?

  **Harrison Black [11:09]**
Basically, yes. Depending on how that goes, if that performs well, we might just go with that. Otherwise, another thing I was thinking about, I have to talk about with the other guys, is to generate, is to basically make a program that...Make it basically a similar program, but do some like...What's the correct term? Basically, we make our own standalone program that looks at Fireworks and basically converts that display language into something more like understandable by the LLM by default that tries like better understand emotion.

  **Robert Foti [11:47]**
Yeah, I think I did. Yeah, so it's almost like you feed a video of a firework in and the AI will assign a motion or whatever to the...

  **Harrison Black [11:59]**
Yeah.

  **Robert Foti [12:00]**
the firework and the different stages of it. Is that what you mean?

  **Harrison Black [12:03]**
He [would.So](http://would.so/), if we, if like first system, basically what we would be doing is we would be giving it the display language and would be giving it information on, because the display language, from my understanding, it it gives like the whole description of the Fireworks and how it works. Basically, we just need to like prompt the AI and make sure that it [understands.how](http://understands.how/) to understand it basically and how to be able to like...You know, understand you know what type of firework it is from that, but we I suspect we're probably gonna need to write a program that's able to, yeah, basic like a standalone program that's better at extracting information like about the firework and like, you know, is better like categorizing things like emotion before we feed it like the AI.

  **Robert Foti [12:52]**
Yeah, but...Yeah, yeah.

  **Harrison Black [12:56]**
that's actually putting everything together.

  **Robert Foti [12:58]**
Yeah, I can. Yeah, I understand what you mean. Yes. Yeah, yeah. And I think that that sounds like the, like that's exciting to have that something that can basically define a firework.

  **Harrison Black [13:01]**
Mm.Yeah.

  **Robert Foti [13:12]**
And if it for one of a better way of just, yeah, I think I think I understand what you're saying, and that will be that sort of like...defines the parameters of a particular firework and then knowing the parameters of the music, you can then match and create the design.

  **Harrison Black [13:32]**
Yeah, a lot of it just depends on like when we test in the air how well it's able to just on its own be able to like sort of figure out the emotion of like a firework with like a bit of prompt engineering. But yeah, we'll have to see how that goes. That's probably going to be happening more in like sprint three, sprint four. That really isn't an out scope right now.

  **Robert Foti [13:43]**
Yep.

  **Harrison Black [13:51]**
Right now, we're mainly just focusing on, like, the music.

  **Robert Foti [13:51]**
OK.Yeah, okay, cool. Actually, just out of interest, I'm not sure if it's related to this, but I've got a friend of mine in Hong Kong who owns, him and his brother developed a product called Book Track.

  **Harrison Black [14:00]**
The.

  **Robert Foti [14:13]**
And Book Track puts soundtracks to...Books.

  **Harrison Black [14:19]**
Oh yeah.

  **Robert Foti [14:21]**
Basically, and I were talking about what he was doing. I said, well, that's kind of what we're doing with the Fireworks. Like, whereas it's maybe a bit easier because it's reading a book and then assigning the type of music to that. No, this is not AI, but this is all done pre-AI days, but.

  **Harrison Black [14:37]**
Okay.

  **Robert Foti [14:40]**
I think, but it's kind of a bit like that's what we're doing is...You're saying you're going to develop something that learns what the firework or defines what the firework or describes the firework in terms of a way in which it can be combined with music. That's the ultimate goal of it. Yeah.

  **Harrison Black [14:56]**
[Mm.Mm](http://mm.mm/).

  **Robert Foti [15:03]**
So, my only concern or...Um...queries, am I giving you enough data to be able to do that?

  **Harrison Black [15:15]**
Okay.Um...For now, I definitely think so.

  **Robert Foti [15:22]**
But do you need more videos, or...?

  **Harrison Black [15:24]**
I don't know if we'd need more videos. I think that's good. The only thing that I think that we would really need right at this moment is just Fireworks with their like display like description language. But like looking at Finale 3D, there's like a whole lot of Fireworks there that already have.They're like associated whatever and like if we need if we really need to know what they look like we can just simulate them in finale 3D.

  **Robert Foti [15:50]**
So, what about videos of pyro musical shows where...Show the [designed.to](http://designed.to/) music, so you're actually getting that built in, or at least getting a designer's ideas of what that means. Is that sort of data useful?

  **Harrison Black [16:00]**
No.I mean, it's never gonna hurt.I'm just trying to think.Yeah, no, having that data doesn't have, like at the very least, it gives us, the people programming it, more of an idea of like what exactly we should be going for. But I don't know how well we'd be able to tie that in with the AI specifically, [but.You](http://but.you/) know, as we develop it, and we like, you know, obviously, 'cause I even the development process is also like a part of the learning process, yeah, maybe we'd find that that in like that will be helpful, yeah.

  **Robert Foti [16:46]**
Yeah, sure.Okay, because I guess that's my only query at the moment is, is there enough data there for you?

  **Harrison Black [16:56]**
Yes.

  **Robert Foti [17:01]**
You know, I want to make sure you're not making the assumptions that, yeah, we've got everything we need when maybe you don't. You know, because at the moment all I've given you is the, I guess, prompts based on the different effects in Finale 3D.

  **Harrison Black [17:07]**
Yeah.Yeah.

  **Robert Foti [17:18]**
So.

  **Harrison Black [17:22]**
It shouldn't matter too much for this sprint either way. I think this is something that I'll talk to Harry and Liam about when they get the chance. But for now, at least I can't think of anything.

  **Robert Foti [17:28]**
Okay.Okay, all right, no worries. That's all. I just, yeah, like I said, want to make sure, at least on my part, I'm providing you with as many tools as possible. I mentioned in my email that Finale 3D, I don't even know if you're even using it or referencing it at the moment, but they upgraded the...

  **Harrison Black [17:37]**
Mhm.I saw that email, yeah.

  **Robert Foti [17:53]**
the system. In fact, when I spoke to him, he goes, oh, you should have talked to me. I would have given that to you for free. Because it is for university students. I went, no. But anyway, there is an upgraded version where you can import, export the Excel files and scripts and stuff.

  **Harrison Black [18:00]**
This is.Okay, that should probably make things a little easier when it comes to learning about that, yeah.

  **Robert Foti [18:19]**
But we're not there yet, but that's not where the focus is right now.

  **Harrison Black [18:22]**
No, that, that, no, that's more so gonna be on the sprint after this, and probably a sprint after that.

  **Robert Foti [18:28]**
Okay, all right. Then I need to look at the time frames as well. Again, just to, because when, when do we, when is this?project looking to when do the sprints end.

  **Harrison Black [18:42]**
Um, let me remember. So we have for this like university semester, I think we have two more sprints. Then we, including this one, then we go on like a month or two break. And then we have another three with a two week break in between the last two, I think.

  **Robert Foti [19:01]**
Alright, so I'm just opening up the...

  **Harrison Black [19:05]**
I found this on the web.

  **Robert Foti [19:11]**
Where are we?

  **Harrison Black [19:11]**
And.

  **Robert Foti [19:13]**
Sorry, just one second.

  **Harrison Black [19:15]**
No, good. Take your time.

  **Robert Foti [19:18]**
Alright, then May, July, or September, [yep.Cool](http://yep.cool/).Yeah, so the guy from the Ignite system is keen to see where we're at in September.

  **Harrison Black [19:26]**
But not.All right, well, by then, um, oh, my computer is frozen, right? Uh, oh.

  **Robert Foti [19:33]**
Might have something to show.

  **Harrison Black [19:39]**
Hello? Oh, sorry, my entire computer just freaked out. No, yeah, by September, we should have, definitely have something to share. I think we should be pretty much finished by then as well, actually. I forget if we actually, if we go into November, I'm pretty sure we do. Maybe.

  **Robert Foti [19:40]**
Yeah, I'm at.All right.There's a lot of.Sprint 3 ends at the end of October.According to what I'm, but...Yep.

  **Harrison Black [20:15]**
Our sprint's probably mostly just going to be like polishing and a little bit like debugging and whatnot, ideally.

  **Robert Foti [20:20]**
Okay, no worries.All right.

  **Harrison Black [20:26]**
Don't.

  **Robert Foti [20:27]**
Cool, alright. I think that's it. I don't want to waste any more of your time today.Yeah, sorry to hear that you're not that there's something going around, everyone's crook. I'll have to ask my daughter, my daughter's at ANU, so she'll be able to tell me what's going on.

  **Harrison Black [20:45]**
I think.

  **Robert Foti [20:47]**
She lives on one of the colleges, so...Alright.

  **Harrison Black [20:52]**
[Yeah.Cool](http://yeah.cool/).

  **Robert Foti [20:56]**
Cool. So if you need to, so what you're saying is next week we're not going to reschedule. So in all likelihood the next meeting will be the week after.

  **Harrison Black [21:03]**
Yeah.Ohh, the week off is also...Yes, the week after, yes.

  **Robert Foti [21:13]**
So, it'll be, we're talking the 4th of May.

  **Harrison Black [21:13]**
I'm pretty sure.4th of, yes, yes. We have 4th of May is going to be next time meeting probably.Because you can't meet any other day other than...

  **Robert Foti [21:30]**
Yeah, yeah, yeah, I can, I can probably meet, I can meet any day, I'm flexible.

  **Harrison Black [21:35]**
Well, I'll have to talk to Harry and Liam about it. I'll send them like a message or something. More than likely, we won't meet. If we have any questions, we have like your email and your WhatsApp, I think. Yeah, so.

  **Robert Foti [21:48]**
Yep, all right. Like I said, like I said, and don't take this thing the wrong way or whatever, but I just want to make sure that I'm giving you enough.

  **Harrison Black [21:58]**
Yeah.

  **Robert Foti [21:58]**
And also [that.Like](http://that.like/), there's people who do this, or not the AI stuff, but work in the simulation, like the Globe people, the Finale people, the Ignite people that do this for a living, and it's not a... and often people who are not in Fireworks think it's...

  **Harrison Black [22:13]**
Mm.

  **Robert Foti [22:19]**
think it's going to be easy, but like, you know, simulating A firework, like the like the glow people, I was shocked him to tell me he has three people that full-time just do that.

  **Harrison Black [22:22]**
[Mm.S.Mm](http://mm.s.mm/).

  **Robert Foti [22:35]**
to get the quality of the simulations that they have. So, yeah, it's like when you said, I will have something that will, you know, do a rough thing. I'm kind of like, I don't know that it's going to be able to be that simple. Because the other thing too is,I've given you written descriptions of Fireworks, but everyone writes their descriptions [differently.Like](http://differently.like/), there's no stock standard way that...

  **Harrison Black [23:02]**
Mm.

  **Robert Foti [23:08]**
It comes out, so anyway, well let's see how we go, alright?

  **Harrison Black [23:13]**
Yeah.Yeah, and I will have to see.

  **Robert Foti [23:17]**
Alright, cool. Alright.Yeah, that's it. We'll see you on the 7th.I guess the 7th.

  **Harrison Black [23:28]**
I...Both, I think.

  **Robert Foti [23:31]**
4th, sorry, yeah.

  **Harrison Black [23:33]**
Yeah, 4th of May.

  **Robert Foti [23:35]**
Alright, and Chongyang, how are you doing with it all?

  **Harrison Black [23:39]**
Yeah, I just trying to...develop our music analysis tool.

  **Robert Foti [23:49]**
Yeah.

  **Harrison Black [23:50]**
I'm trying to separate music into different sectors.Alright, the move, the rate rate of the music, the spade, uh...

  **Robert Foti [23:54]**
All right.

  **Harrison Black [24:02]**
I, I don't remember exactly how that I separate music into, but...

  **Robert Foti [24:06]**
But are there is there a software that already does that?

  **Harrison Black [24:12]**
Yeah, but I know it's possible for us to use it for commercial, yeah, free. There's a lot of different software libraries for this stuff, but they all vary in terms of like quality and whatnot, and also having a look, it looks like a lot of them need like...A lot of fine-tuning.

  **Robert Foti [24:35]**
Okay.

  **Harrison Black [24:37]**
But yes, so we're still working on that and getting that set up.

  **Robert Foti [24:39]**
That'll be cool. Okay, so you'll be creating your own tool for that.

  **Harrison Black [24:44]**
Yeah, virtually, yeah. It's based off, it's going to be based off someone else's software library, of course, but yeah, it'd be our own analysis tool.

  **Robert Foti [24:45]**
Yes.Yeah.Alright, cool.Very good.

  **Harrison Black [24:56]**
Harris has been build a foundation of the tool and he handed up to me and I optimized his program.

  **Robert Foti [25:07]**
Alright, very good.

  **Harrison Black [25:08]**
Mm.Well, thank you for meeting with us, Robert.

  **Robert Foti [25:13]**
No, no pleasure. Sorry, if I'm a bit dopey, it's a bit late here and I'm kind of still terribly jet-lagged even though I've been travelling for two weeks. So, yeah.

  **Harrison Black [25:18]**
No, that's fair enough.I can imagine.Yeah.

  **Robert Foti [25:27]**
And.

  **Harrison Black [25:27]**
Alright, cool. Yeah, we'll see you later, Robert.

  **Robert Foti [25:29]**
Talk soon, guys. Cheers, bye.

  **Harrison Black [25:32]**
Right.

</details>

