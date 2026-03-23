---
notion-url: https://www.notion.so/Stakeholder-Meeting-2-32ccd8a5bf08807a93d5c6ed3a582589
title: Stakeholder Meeting 2
date: '2026-03-23 01:15:00.000'
from_notion: https://www.notion.so/Stakeholder-Meeting-2-32ccd8a5bf08807a93d5c6ed3a582589
author: From Notion
last_edited_time: '2026-03-23 04:22:00.000'
---
**Date:** 23 March 2026
**Duration:** ~55 minutes
**Attendees:** Harry Randall, Liam Maloney, Harrison Black, Chongyang Fang, Robert Foti

---

### Overview

The team walked Robert through the current state of the ShowCrafter prototype, including a rough UI mockup covering the show editor, shopping list, show guide, and live preview. Robert gave feedback on direction, raised important technical and product considerations around consumer fireworks, and agreed on next deliverables for both sides.

---

### UI Mockup Walkthrough

Harry shared a link to the early-stage mockup, which Robert viewed via screen share. The mockup demonstrated the core user flow:

- **Login / show dashboard** – stored shows accessible on return visits

- **Show editor** – fireworks synced to music, with an LLM chat panel for natural-language tweaks

- **Shopping list** – generated based on retailer stock

- **Show guide** – instructional breakdown of what will happen

- **Live preview** – rough animated preview of the show

Robert was positive and noted the team had achieved a lot in a short timeframe.

---

### Finale 3D & CSV Export

The team is working on Finale 3D integration but hit a blocker: they couldn't get the CSV import working without a product database. Robert confirmed he had been using CSV imports over the weekend and agreed to:

- Export a working CSV from Finale 3D for the team to use

- Get his nephew in Sydney (their Finale expert) to export a usable product database

Robert clarified that Finale 3D should remain the **primary MVP output target** — it outputs a universal `.fire` file compatible with all firing systems, not just Ignite.

---

### Ignite Firing System Integration

Liam raised the question of direct Ignite integration. Key points:

- Ignite has its own designer platform with **import/share functionality**, so reverse-engineering the format may be feasible

- Robert is meeting with the Ignite team directly on **7–8 April** in the US and will explore integration opportunities

- The team agreed that seamless direct integration with a firing system is the **ultimate product goal**, with Finale 3D CSV export as the correct MVP stepping stone

- Robert noted that GLOW Fireworks already does this (design → export to Ignite via a 4-letter code in the mobile app), and ShowCrafter should aim to replicate and improve on that model

---

### Consumer vs. Professional Fireworks – Key Distinction

Robert raised an important product consideration: consumer fireworks behave very differently to professional ones.

- Professional fireworks receive precise timecode and have known pre-fire delays, enabling beat-accurate choreography

- Consumer fireworks have a **3–6 second ignition fuse by law**, making the same precision unachievable

- A single consumer firework may produce **15+ effects over 20 seconds** — a "mixed salad" rather than a single precise effect

- **Recommendation:** Rather than trying to match individual fireworks to individual beats, the team should profile fireworks by **mood/personality** and match them to broader song sections (e.g. energy maps, emotional arcs)

The team agreed this was the right approach. Liam confirmed the roadmap already includes two separate AI components: one for song analysis (MIR-style emotion/energy mapping) and one for show choreography drawing on the firework database.

---

### Firework Database & Prompt Design

Robert shared his fireworks database spreadsheet (the same file sent to the Ignite team), containing full descriptions of all his consumer fireworks.

Key decisions:

- The database should include **tags and categories** per firework (e.g. peony, palm, willow, cake, crackle, strobe) along with fuse timing and effect descriptions

- Robert offered to write **draft prompts** describing each firework type and where it might fit in a show — the team will incorporate these into the LLM prompt design

- Harry suggested adding **numeric rating scales** (e.g. size, colour intensity) to help the LLM reason about fireworks more precisely; Liam suggested adding mood/emotion fit scores per song type

- Robert will use terminology consistent with the firework descriptions to ensure everything aligns

---

### Retail Stock Integration

Full live inventory integration (plugging into retailer POS systems) is likely too complex for the MVP. The agreed simpler approach:

- Retailers provide a **static product list** on the back end

- The software designs shows based on that list

- Quantities and live stock levels are a later enhancement

This is the model most retailers are already comfortable with.

---

### Competitive Differentiation

Robert asked what would make ShowCrafter unique given that competitors could replicate its features. Key differentiators identified:

- **First mover** advantage in the music-driven consumer fireworks design space

- Access to **Robert's fireworks assets, animations, and professional expertise** as training and prompt data

- A **highly tuned, domain-specific system prompt** encoding real fireworks expertise — show quality will depend heavily on how well this is crafted

- Robert's idea of building a tool that can **describe the emotional narrative of a firework** (analogous to how MIR tools describe music) was well received as a potential long-term differentiator

---

### Next Steps

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

### Scheduling

- No meeting the week of 7 April (Easter/Anzac break)

- Robert returns to Hong Kong on ~21 April

- Next meeting likely **week of 27–28 April** (noting ANZAC Day is 28 April and Labour Day falls nearby)

- Robert will confirm closer to the time based on his US time zone

- Team to contact Robert via WhatsApp for quick questions

---

---

## Full Transcript

**TechLauncher – Fireworks MeetingDate:** 23 March 2026, 12:00 AM
**Duration:** 55 minutes

---

**Harry Randall** *(0:03)*
Yeah. Do you wanna kick us off?

**Robert Foti** *(0:07)*
You guys tell me where you're at. Where do we go from here? Did you all see the simulation videos I sent?

**Harry Randall** *(0:20)*
Yep, I'll look at those.

**Robert Foti** *(0:22)*
So you get an idea of consumer fireworks. Where do we go from here?

**Harry Randall** *(0:34)*
Yeah. So we've done a couple of roadmap things, we've talked about the MVP, and we've actually done a little mockup of what we envision it's going to look like. I'll share that link and we can walk through it and get your feedback as we go along.

**Robert Foti** *(0:51)*
Sure.

**Robert Foti** *(1:01)*
Am I clicking on a link or...?

**Harry Randall** *(1:05)*
Yeah — do you know how to share your screen?

**Robert Foti** *(1:10)*
I'm sure I can work it out.

**Harry Randall** *(1:12)*
It should be the share button next to Leave. Yep — and now if you click on the link that we sent you.

**Robert Foti** *(1:22)*
OK.

**Harry Randall** *(1:28)*
This is a very rough mockup we did.

**Robert Foti** *(1:31)*
Where was that link? I saw it pop up and then it's gone.

**Harry Randall** *(1:34)*
Yeah, let me send another message. If you click Chat up in the top left of your screen.

**Robert Foti** *(1:57)*
Oh, OK — got it now. Sorry.

**Harry Randall** *(1:57)*
Yeah. So this is just the landing page — it's loading. Let's go, let it load.

**Robert Foti** *(2:31)*
Not sure if my internet's a bit slow on this end.

**Harry Randall** *(2:34)*
That's OK. If you go to Login?

**Robert Foti** *(2:41)*
Yep.

**Harry Randall** *(2:41)*
And then just click Sign In — there's no authentication. So the idea is you can design your shows and they'll be stored here so you can go back and look at them. If you click into one of the shows...

**Robert Foti** *(2:55)*
Yep.

**Harry Randall** *(3:00)*
It'll be like a breakdown — this is a kind of editor where we'll show you all the fireworks synced up to your music. There'll be a way you can talk to an LLM on the right, so you can say something like "at the end I want it to be more vibrant" or whatever. And then if you go to Shopping List — one of the tabs.

**Robert Foti** *(3:24)*
Yep.

**Harry Randall** *(3:27)*
It will show you everything you have to buy. And then if you go to Show Guide...

**Robert Foti** *(3:29)*
Mm-hmm.

**Harry Randall** *(3:36)*
This would be an instructional thing on what's going to happen, and then there'll be a preview. If you click Live Preview and then Autoplay, it'll just play like a fireworks preview.

**Robert Foti** *(3:56)*
OK, got it.

**Harry Randall** *(3:57)*
Yeah, this is a very rough mockup and—

**Robert Foti** *(3:59)*
You didn't get it all done in one week? What's wrong with you guys?

**Harry Randall** *(4:03)*
Yeah, exactly. But we've been looking at Finale 3D as well and how that will work. We're still looking at the file format and trying to import stuff, just so we can get a demo going.

**Robert Foti** *(4:16)*
Yep. Did you see that you can just import with the CSV file?

**Harry Randall** *(4:26)*
Yeah, we couldn't get that working for some reason. I don't know if you have a working CSV file you could send us so we could just plug and play?

**Robert Foti** *(4:37)*
Yeah, I'll send you one — I've literally been working on a show over the weekend and I imported a CSV file.

**Harry Randall** *(4:45)*
Do we need any of your firework assets if we do that?

**Robert Foti** *(4:52)*
Oh yeah, you'll need a database, I guess, wouldn't you?

**Harry Randall** *(4:57)*
Yeah, that's probably the problem we're running into.

**Robert Foti** *(5:02)*
Alright. So in Finale, you can access public databases, but I don't know whether you'd need a paid account for that.

**Harry Randall** *(5:34)*
I think we're on the paid account right now — we've got a 14-day trial, so we should be able to access that.

**Robert Foti** *(5:42)*
OK. I'm not the expert on Finale — my nephew in Sydney is the one who uses it. So what I'll do is I'll get him to export the database for the show we're working on. Because I was literally on the weekend importing CSV, combining shows that someone else had designed and putting them together — it's all pretty straightforward.

**Harry Randall** *(6:14)*
Yeah, and I think Liam had some—

**Robert Foti** *(6:14)*
The thing with this too is that professional fireworks are different to consumer fireworks in terms of what you can do. Professional fireworks are generally much more precision — single effect. So you can design easier because if you want a blue to go off at a specific moment, you can do that. Whereas with consumer fireworks you don't have that precision, and as you'll have noticed from those simulations I sent — consumer fireworks are a lot more of a mixed salad of effects rather than a single effect. So it's actually a lot more of a challenge. Going back to the mockup — is there music with this or no?

**Harry Randall** *(7:26)*
Not in this version, but we've been looking at that too. We're able to sync up the beats of a song, detect the chorus and stuff, and the LLM will incorporate all of that into one big show.

**Robert Foti** *(7:42)*
OK, so what's LLM? Do you have to explain that to me?

**Harry Randall** *(7:47)*
That's just an AI — it stands for Large Language Model, it's just a broader term for it.

**Robert Foti** *(7:51)*
Oh, OK. So I'll get the database for the consumer fireworks and try to do that straight after this meeting. How does this learn how to design a show? What's the process?

**Harry Randall** *(8:32)*
You mean how do we give it the music and how will it use that?

**Robert Foti** *(8:38)*
Well, you input the music, you have a list of fireworks, and it's going to choose the fireworks automatically and say "put this here, this here." Technically, how does it learn what fireworks go well with a piece of music?

**Harry Randall** *(8:54)*
The LLM is just trained on this kind of stuff. If you've played around with ChatGPT or similar — if you just describe in natural language what you want, you can get it to output a file format we can convert into something Finale will accept, and you can tweak it with natural language. It's hard to describe though.

**Robert Foti** *(9:27)*
I'm asking as someone who's ignorant of the technical side. In my mind I'm thinking — there's already plenty of models that will describe music in terms of emotion. And there are plenty of professionally designed firework shows in Finale on YouTube. Does that become the platform for teaching it what fireworks go well with what music?

**Harry Randall** *(10:24)*
Yeah, pretty much. I haven't looked at the specific models yet, but you're exactly right. It will look at all the different music, all the different examples online of firework shows — OK, this worked well there, we'll do this.

**Robert Foti** *(10:41)*
So do you feed that data in directly, or does it automatically go online and hoover it up?

**Harry Randall** *(10:49)*
Well, over the past five years it's already been learning and training itself on that. So it's already got it in its brain, kind of — and from there we can just ask it questions on that information.

**Robert Foti** *(10:59)*
Yeah. OK. My only concern is there's plenty of assets available on professional shows, and a professional show is very precision stuff — 50 different firing locations, 5,000 different fireworks, 30-minute pyromusical. There's plenty of that. But in terms of getting it dumbed down for consumer fireworks — like you might have one firework that'll have 15 different effects in the space of 20 seconds. It doesn't necessarily lend itself to the precision design of professional shows.

**Liam Maloney** *(12:14)*
I had a question about consumer fireworks. You said in our last meeting that it would be good if the app could export a firing sequence script to Ignite on their phones. Is that usually reserved for professional fireworks, or would consumers be able to set that up with consumer fireworks as well?

**Robert Foti** *(12:44)*
So what happens now is — you saw the GLOW Fireworks website where the retailers have it on their website and people design a show. That literally exports directly into the Ignite firing system. And even without that, people can design a show in Ignite. There is a format for importing it, but I need to look into that more. Does that answer the question?

**Liam Maloney** *(13:34)*
Yeah, I was just wondering if there would be a disconnect between professional firing and consumer. But if Ignite can handle all that and we can import to Ignite, that should be fine.

**Robert Foti** *(13:46)*
Yeah, they have that function already because they're doing it with the GLOW platform. You go to the GLOW Fireworks platform, build your show, export it to Ignite — they give you a four-letter code, you input it in the mobile app, and it brings up your show in the Ignite system. So all of that's already integrated.

**Liam Maloney** *(14:33)*
I had one more clarifying question from our last meeting — did you want the database to be retailer-specific? So the consumer can go to a store, set their budget and song, and create a show — but did you also want retailers to be able to regularly update their current stock?

**Robert Foti** *(15:13)*
Yes. Because this is all done at a retail level. With retail fireworks, people on average spend 30 minutes a year on their fireworks purchases. There's a small percentage who plan it out as a hobby, but what this is trying to capture is the enthusiastic-but-unsure consumer. They go to buy their 4th of July fireworks literally on their mobile in-store, and the retail assistant can say "if you want to do it to music, just put in what song you want to use and it'll make a recommendation based on your budget and what we've got in stock." Ideally they can then see the show they're planning, or for the more enthusiastic ones, plan ahead and send their order to the store. Is the shopping list basically what's in stock, or is that what the software has chosen?

**Harry Randall** *(17:05)*
That's what the software has chosen, but it will be based on what they have in stock — so the list it picks from will be what they have in stock.

**Robert Foti** *(17:10)*
Yeah. Cool.

**Harry Randall** *(17:20)*
A couple of questions. As Liam was saying — the feature where you can export directly to Ignite — would you want us to implement that if we had time?

**Robert Foti** *(17:45)*
So — I'm not sure whether or not we'd need to integrate it directly. I need to check how the Ignite integration works, like whether you can import an Excel file or whatever. But why don't we do it like this — just focus on Finale 3D for the moment, because Finale 3D has the ability to export a `.fire` file, which is what we call the file that shoots a show for all firing systems, not just Ignite. So let's just focus on Finale 3D as the output, which is just that CSV file.

**Harry Randall** *(19:12)*
Yep — and just to confirm, Ignite is just like a little controller that tells which one to fire at which time?

**Robert Foti** *(19:21)*
So Ignite is an app you can download on your phone, and physically it's just a box — each module has 18 outputs that the electric igniters from the fireworks plug into. Have a look on the Ignite website and YouTube videos of people putting shows together — I think it's important for you guys to see what that setup looks like.

**Harry Randall** *(20:22)*
Yeah. And also on the retailer stuff — ideally we'd want to plug into their stock-taking systems and have a live feed of their stock, right? Is that the idea?

**Robert Foti** *(20:49)*
Yes, correct.

**Harry Randall** *(21:02)*
Do you know what kind of software they use for stock management?

**Robert Foti** *(21:07)*
No — everyone has different methods. And I don't want to go down the path of building an inventory management system for them. I think it's more that — ideally it feeds directly into their database, but in practice what most people are doing is going "in our store we have this list of products, let people design to that." They're not necessarily updating quantities. I think when we can just work it based on a list of products we input on the back end, and that's what they work with.

**Liam Maloney** *(22:29)*
That makes it a lot easier.

**Harry Randall** *(22:29)*
Yeah, exactly — if we're the only ones who control that and retailers don't have to set it up for every different store, it's a lot simpler. One source of truth.

**Robert Foti** *(22:32)*
Yep. So — today's the 23rd. On the 7th or 8th of April, I'm in the US and I'm meeting with the Ignite people directly. I'm just wondering — at what point do I talk to them and say "look, we're developing this thing that's going to have functionality you don't have — is there an opportunity to integrate into your software"? Are we at the point we can start having those conversations?

**Liam Maloney** *(23:26)*
I think it's still a bit too early in the development cycle. If they asked to see it, we can't really show them much functionality yet, unfortunately.

**Robert Foti** *(23:46)*
Yeah. I mean, my overall goal was more to produce a proof of concept rather than something we're monetising at the end of this. With this list of fireworks, you add whatever music, and it produces a show that looks good automatically — rather than something that's live on someone's website. Am I being too conservative with that, or is that realistic?

**Harry Randall** *(24:36)*
I think maybe a year ago that would have been a very realistic goal. But with the advent of AI and the speed at which we can ship things now, I think we could do a lot more. I mean, I say that and we haven't built it yet, but I think we could do quite a lot.

**Robert Foti** *(25:06)*
OK so the end result has to be able to integrate with the firing system. I need to talk to the firing system people so it becomes seamless. The ultimate goal is something that directly feeds into it — like GLOW Fireworks, but something that also incorporates music and generates shows automatically. The Plan B — which would be much simpler — is just outputting a Finale 3D file, but that's clunky and most consumers don't have access to Finale 3D. So I need to do my homework with Ignite on whether there's a way to directly import something.

**Liam Maloney** *(26:26)*
Just to interject — I'm on the Ignite designer website right now. It does have an import and share functionality, which means even without direct integration, we should be able to find a way to export a script like Finale 3D does.

**Robert Foti** *(26:56)*
Yep. And somewhere on the website it'll tell you the format.

**Liam Maloney** *(27:11)*
Yeah, we could maybe try to reverse-engineer what it looks like when we try to export a show.

**Robert Foti** *(27:19)*
Yeah. But the ultimate thing is — we're building this for the lowest common denominator, for people who just want to quickly have a show. So ultimately it's got to seamlessly and directly integrate with a firing system, because they're not going to manually import into it. It's just got to automatically do it — and for that we'd need the firing system's support, which I think they'd provide because it's in their interest. GLOW's animation software is better than anything else in this space, but maybe we're building something different.

**Harry Randall** *(28:23)*
What you were saying before is exactly what we're going to do. We're going to reach the MVP with Finale 3D — that's just the base, so we have something — and then we're going to try to build it so it integrates seamlessly with the firing system. Design the show, it goes straight to the firing system — that's all they have to do.

**Robert Foti** *(28:41)*
Yeah. My feeling is the output at the end is kind of the easy part — whether it's a Finale 3D CSV file or something that goes directly into Ignite, it's work involved but it's the easy part. The hard part is being able to get a great designed show using consumer fireworks.

**Harry Randall** *(29:22)*
One other thing — the key differentiator I see is that our product will be similar to GLOW but with music generation and a way to modify the show using natural language through AI. Those are the key things.

**Robert Foti** *(29:43)*
Yep. All right. So — and I apologise if I'm asking dumb questions — but the precision of a consumer firework versus a professional one is quite different. A consumer firework by law has an ignition fuse that lasts 3 to 6 seconds. You can't achieve the precision of a professional firework — a professional firework receives timecode and a cue, and the software knows the pre-fire time. That's where the precision comes from. With consumer fireworks you don't know what the precision will be. There are level of enthusiasts who will manipulate fireworks for precision, but the people we're targeting won't do that. So there's designing the ideal versus the reality. Especially with single fireworks — the software might say "this will be perfect for this beat," but with a consumer firework that rarely happens. Anyway — is there music with this version or not?

**Liam Maloney** *(32:18)*
So for our understanding — instead of trying to match up single-shot fireworks to beat timings, we should be profiling consumer fireworks by their mood or personality, and then matching larger sections of the song to specific fireworks that might have multiple shots?

**Robert Foti** *(32:52)*
Yeah. And one of the options is that people can choose whether they're doing a precision ignition or a general one. But I'm thinking about who the market for this quick-design tool is at the start — it's the general consumer. In saying all of that — and I'm jumping ahead — the platform you're building could be applicable to a professional show down the track with some tweaking, so. I think sticking with mood/personality and matching to song sections is the right direction.

**Robert Foti** *(33:58)*
So I've got a question: what is it, if anything, that we're doing that someone else can't do equally quickly? What will make what we're doing unique? You're using an AI that everyone has access to.

**Liam Maloney** *(34:38)*
The features we're incorporating literally anyone can do. The only difference is we're going to be the first to do it — but a company could easily copy us. We also have your resources as a fireworks manufacturer. You have all your animations and videos that we could use to instruct the model. You have your professional expertise to help us make these shows as well.

**Robert Foti** *(35:14)*
Is there something we can do that makes ShowCrafter better at knowing the personality of a firework and how it integrates with music — better than other tools?

**Harry Randall** *(35:48)*
That's actually a really good point, and something you'd be good at. What we'll have to do is design a prompt — the thing you ask the LLM. You give it all the inputs: the song, all the timestamps, their budget, the list of fireworks. And then you give it a prompt saying something like "hey, I'm a fireworks manager designing this show — here's what I need." We'll have to fine-tune that, but the quality of that prompt will be one of the key differentiators.

**Robert Foti** *(36:22)*
Tell me more about what you're suggesting with the prompt.

**Harry Randall** *(36:28)*
So when you're talking with an LLM, it's got a system prompt running in the background. We'll design our own, which will say things like "these fireworks are good to use at the beginning," "for this type of song you want bigger fireworks later on," that kind of thing.

**Robert Foti** *(36:59)*
So is it — what if you ran professionally designed shows through the model? And is it about trying to run the song through the model so it goes "here's the emotion of this song, and we notice that when this type of music is playing, this type of firework is firing"?

**Harry Randall** *(37:45)*
Yeah, that's exactly right.

**Robert Foti** *(37:55)*
Does all of that happen automatically, or do we need to tell it "this is a strobe, this is a peony, this is a crackle"?

**Harry Randall** *(38:07)*
It will already have that general knowledge, but if we want to make it better — that's where the prompt comes in. We can start running through our own examples and that will just make the show better over time. Customising that prompt will improve the whole output.

**Liam Maloney** *(38:33)*
Additionally, in our database we can set tags and categories for each firework. It won't just have an ID and a video — it can include fuse timings, category (peony, palm, willow, cake, crackle, strobe, etc.), all of that information. Which the AI can then feed off alongside the prompt.

**Robert Foti** *(38:54)*
Palms, willows, whatever — yeah.

**Liam Maloney** *(39:04)*
Which the AI can feed off — and all of that together will create a more specific AI product for what we're trying to build.

**Robert Foti** *(39:32)*
Yeah. It's almost like we're creating a tool within a tool — we're creating a tool that can describe the narrative of a firework. In the same way a song analysis tool describes the emotional arc of a song. Is that kind of what we're creating?

*(Robert briefly goes muted)*

**Robert Foti** *(40:24)*
Sorry — am I back? Can you hear me?

**Liam Maloney** *(40:37)*
Yeah, you're back. So yeah — at the moment there are existing tools that will describe a song.

**Robert Foti** *(40:48)*
Yeah.

**Liam Maloney** *(40:48)*
They're called MIRs — Music Information Retrieval systems. I think our general idea is to use that as well. In our current roadmap we have two separate AIs: one for analysing the song and doing exactly what you're talking about — the emotions, an energy map with high and low points. And then once we have all that information, we use our database and examples and everything else we feed into the second AI to create the show, matching the fireworks up with the emotions in the song.

**Robert Foti** *(41:44)*
Yep.

**Liam Maloney** *(41:45)*
Does that sound like what you want?

**Robert Foti** *(41:48)*
Yeah, yeah. And then the same thing we're doing for the music — we're doing it for the fireworks as well, and then we're matching them up.

**Harry Randall** *(42:08)*
Yes — we'll run a prompt and store it in the database. For something like, say, a Red Willow — the LLM will look at the animation or whatever and go "OK, this is a big firework, it's a happy firework" — and store all of that. Then when it's doing the whole song, it'll look through and find the right firework for each section.

**Robert Foti** *(42:34)*
All right. So — I did this a few years ago for a customer and I can't find it, but I put together a list of all the different categories of fireworks and where you might use each in a show. If over the next week I tried to put that together again, would that be helpful for creating the prompts?

**Liam Maloney** *(43:08)*
I do think that would be helpful. Controlling the match-up of fireworks to song emotions is a nuanced thing, especially if it's just an AI finding the emotions on its own. I think we can work to ensure the emotions are captured to your standard — it'll just take some time and tweaking, but we can get it done.

**Robert Foti** *(43:46)*
Yep. I know on one level it's subjective, but I think I know enough about what people in general will respond to — so it's probably not too far off.

**Liam Maloney** *(44:20)*
I think you'll be quite impressed with how well AI can capture that sort of thing. Even I'm getting surprised by it.

**Robert Foti** *(44:28)*
Fair enough. All right — I'm going to open a file to share, we've got about 15 minutes. Can you see my screen? Yep. OK — this is the database I sent to the Ignite people for all of our fireworks. This is the accompanying thing to all those videos I sent you — descriptions of all the fireworks and everything. Is this useful information for you to have?

**Harrison Black** *(45:47)*
Definitely, yes — that would be incredibly useful information for us.

**Robert Foti** *(45:56)*
Yep. All right. I'm doing that for my range of fireworks. I should get one of my staff to finish it off — I've done this file for Ignite and I'm doing another similar one for the GLOW team. I should be able to send that to you in the next couple of days. I wanted to raise this because they have a database of all of this information for everyone's consumer fireworks that's involved in their program. On their back end they've got all of that. I don't know how accessible it is, but it's actually all on the Ignite app when you search for fireworks. Anyway — I'll just focus on our stuff first and we can go from there.

**Harry Randall** *(47:12)*
Well, I think that's probably it unless you guys have anything.

**Robert Foti** *(47:23)*
All right, so what are the next deliverables for the next week? For me: I need to get you those databases, and I will — not try, I will — in the next week create draft prompts for each different type of firework, noting where they fit in a show. And I'll try to use language that's consistent with the firework descriptions so it all matches up. The one thing about fireworks is that everyone uses different terms for the same effect — you might have one particular effect described 10 different ways.

**Harry Randall** *(48:13)*
It may be helpful to also have some numeric rating scales — like a rating from 1 to 10 for something like size of the explosion, amount of colour — that kind of thing, so it's easier for the LLM to reason about rather than relying purely on natural language.

**Robert Foti** *(48:26)*
What do you mean — a scale of what?

**Harry Randall** *(48:28)*
Like a 1-to-10 scale for size of explosion, amount of colour — stuff like that.

**Robert Foti** *(48:41)*
All right, let me do a first pass on the prompts and you guys can work out whether that's the right approach.

**Liam Maloney** *(48:47)*
Yeah, that's perfect. I like the idea of scales, but a lot of that information would already be implicit in the firework descriptions. What would actually be more valuable is a scale in terms of mood, emotion, or how well it fits to certain song types — but that would be something we'd need to tweak over time anyway.

**Robert Foti** *(49:30)*
Yeah, I'll just get as much data as possible. The thing that defines the size of a firework is the calibre — and Finale already handles that when you input the calibre, it determines the size. So I don't think that's the critical point. Anyway — so for me: two databases, the CSV format for Finale (which you may already have, but I need to get you a working one), and I'll try to export a database out of Finale for you to use.

**Harry Randall** *(50:57)*
Yeah, perfect. And we'll flesh out the database schema and work on the AI for the songs. Cool.

**Robert Foti** *(50:58)*
Yep. And I'll try to do a couple of databases — I won't have time to make a simulation, but if you've got the database in Finale you can render things yourselves if necessary.

**Harry Randall** *(51:29)*
Well, thank you Robert. Have a good day — or night.

**Liam Maloney** *(51:30)*
Thanks so much.

**Robert Foti** *(51:31)*
All right — housekeeping question. It's the 23rd today. When does daylight saving finish in Australia?

**Liam Maloney** *(51:59)*
4th of April.

**Chongyang Fang** *(52:05)*
The 5th of April.

**Harrison Black** *(52:05)*
Yeah, the 5th of April.

**Robert Foti** *(52:12)*
Is that Easter Sunday? And is Easter Monday a public holiday in Australia?

**Harrison Black** *(52:18)*
It could be — yes.

**Harry Randall** *(52:29)*
Yeah, if it's a Monday it is. And we're also on break, so I don't think we have a meeting that week, and maybe the week after.

**Liam Maloney** *(52:31)*
Correct — no meeting that week.

**Chongyang Fang** *(52:38)*
So we need to do the next meeting up to the 20th of April.

**Harrison Black** *(52:45)*
Yeah, the 20th of April would be our first meeting after daylight savings ends.

**Robert Foti** *(52:58)*
All right. I might need to make it the 21st or 22nd of April because I'm travelling in the US and I don't get back to Hong Kong until the 21st. During that week — say the 22nd, 23rd, 24th — you guys work out what's best and let's schedule that in.

**Harry Randall** *(53:29)*
We actually only work on Mondays, so we may have to push it to the next week. We'll send you an email or something.

**Robert Foti** *(53:34)*
Oh — hang on, I need to work out the time zone because 11 AM Monday might be Sunday evening where I am. Let me work it out closer to the time.

**Chongyang Fang** *(53:46)*
So the 28th — but the 27th is ANZAC Day, and the 4th is Labour Day.

**Robert Foti** *(54:03)*
It might actually work out — it'll just be Sunday wherever I am.

**Harry Randall** *(54:07)*
Yeah, we'll play it by ear and stay in contact.

**Robert Foti** *(54:11)*
All right — and I'll update the meeting time when daylight saving changes. And if you've got any questions, WhatsApp is probably the quickest way. I don't think I've got anyone's contact, so if someone wants to just send me a message to set up the group, that would be great.

**Harry Randall** *(54:38)*
Perfect. Take care Robert, thank you for your time.

**Robert Foti** *(54:40)*
Good one. And I'm sending you the transcript, right?

**Harry Randall** *(54:44)*
Yeah, that would be great.

**Chongyang Fang** *(54:45)*
Yes.

**Harry Randall** *(54:48)*
Cool. See ya — bye. Thank you, Robert.

**Chongyang Fang** *(54:49)*
Thank you very much.

**Harrison Black** *(54:53)*
Have a good one.

---

*Transcription ended.*

