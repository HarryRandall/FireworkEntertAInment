---
notion-url: https://www.notion.so/Stakeholder-Meeting-1-325cd8a5bf0880639dbde55fec373283
title: Stakeholder Meeting 1
date: '2026-03-16 03:48:00.000'
from_notion: https://www.notion.so/Stakeholder-Meeting-1-325cd8a5bf0880639dbde55fec373283
author: From Notion
last_edited_time: '2026-03-16 04:12:00.000'
---
**Date:** 16 March 2026, 12:11 AM
**Duration:** 48 minutes 22 seconds
**Platform:** Microsoft Teams (recorded and transcribed)

**Attendees:** Robert Foti (Stakeholder), Solomon Inyang (Tutor), Harrison Black, Harry Randall, Liam Maloney, Chongyang Fang

---

## High-Level Summary

This was the first stakeholder meeting between the TechLauncher student team and Robert Foti, a fireworks manufacturer whose family company services major events including the Sydney New Year's Eve fireworks. The meeting focused on defining the scope of the project: building a web-based tool (working title "ShowCrafter") that allows everyday consumers to design pyro-musical shows – firework displays choreographed to music.

Robert walked through a requirements document he had prepared, covering inputs (firework videos, animations, product inventory, user-provided music, budget, and location details), outputs (a firework shopping list, a show simulation, and a script/file compatible with existing firing systems), and the core challenge of defining the "personality" of individual fireworks so they can be matched to the mood and emotion of music.

The team discussed the existing ecosystem of tools: Ignite (the electronic firing system hardware), Glow Fireworks (a platform for 3D simulations and show design), and Finale 3D (professional scripting software). The group agreed that the most practical path to a proof of concept would be to output a Finale 3D-compatible Excel file, since Robert already has his consumer firework database loaded in Finale 3D and the software can render a full simulation with music. Longer-term, the goal would be to integrate with or build on top of the Glow Fireworks platform.

Key decisions and takeaways included: the tool should be web-based (not a native app), accessible on mobile; the real client of the software is the retailer, with consumers as end users; consumer fireworks currently have no formal safety standards (unlike professional fireworks which follow Queensland/Australian standards); and Robert will provide 20–30 animation files and accompanying real firework videos to get the team started. Communication going forward will be via a WhatsApp group.

---

## Topics Discussed

### 1. Stakeholder Background

Robert introduced himself as a fireworks manufacturer based in Hong Kong with experience in UI design. His family's company handles the Sydney New Year's Eve fireworks. He has previously worked with a software engineer in Canberra to develop an online firework certification tool.

### 2. Project Scope and Vision

The goal is to develop a tool ("ShowCrafter") that designs pyro-musical shows for average consumers. The output should be usable by an existing electronic firing system (Ignite) and be simple enough for use in a retail setting. The tool needs to understand the "personality" of fireworks – their mood, emotion, colour, effect, and how they pair with music.

### 3. What Makes a Good Pyro-Musical Designer

Robert explained that designing a pyro-musical show requires an ear for music (understanding mood and emotion of a song), knowledge of firework characteristics (size, colour, effect, timing), understanding of which firework-music combinations work well, and technical/safety knowledge about what can be done in various locations.

### 4. Inputs and Outputs

**Back-end inputs:** firework videos, firework simulations/animations (from existing software), and a database of available inventory.
**Consumer inputs:** a song or soundtrack, a defined budget, location details (space available), and user experience level.
**Outputs:** a list of fireworks to purchase, a simulation of the show using existing animations, and a script/file (or direct interface) for the firing system.

### 5. Product Database and Inventory

Robert confirmed his company is a manufacturer with associated retailers (primarily in the US). The product database can be sourced from existing platforms. Robert offered to send YouTube links to his firework catalogue and provide animations for all products. The inventory would initially be a general list rather than real-time stock tracking.

### 6. Firework Personality – Subjectivity

Liam raised that defining the "personality" of a firework is subjective. Robert agreed and offered to document his own descriptions and send links to pyro-musical shows so the team can learn what combinations tend to work. He suggested watching existing shows is one of the best ways to understand firework-music pairing.

### 7. Safety and Technical Constraints

For professional fireworks in Australia, clear standards exist (e.g. the Queensland standard: 1 metre of safety distance per millimetre of calibre). However, for consumer fireworks, there are currently no formal safety rules or guidelines. Robert acknowledged this will need to be figured out – the team can propose a baseline and he can validate it.

### 8. How the App Should Work (User Flow)

Robert envisions the consumer walking into a retail store, opening the tool on their phone, selecting a song, inputting a budget and location details, and pressing a button to get suggestions. The tool should be simple and intuitive. The true client of the software is the retailer (who offers it as a service to drive sales), not the end consumer directly. Fireworks cannot be shipped, so the in-store experience is essential.

### 9. Technical Data for Fireworks

Harrison asked about data sheets for fireworks (size, colour, time from launch to burst, etc.). Robert explained that the existing firing system and animation software (Glow) take this data via Excel spreadsheets and videos. The Glow platform and Finale 3D already model these parameters.

### 10. Platform Decision – Web-Based Tool

Harrison suggested building a website with a mobile-friendly wrapper rather than a dedicated native app. Robert agreed – the term "app" was used loosely, and a web-based tool is preferred. This aligns with how Glow Fireworks already works (embedded in retailer websites).

### 11. Existing Ecosystem and Key Tools

Robert shared three links with the team:

- **Ignite Firing Systems** – the hardware/firing system used to shoot shows

- **Glow Fireworks** – a platform for 3D product simulations, show design, and purchase planning (already embedded in retailer sites like Pyro City)

- **Finale 3D** – professional scripting software where Robert already has his consumer firework database loaded

### 12. Proof of Concept Approach

The group agreed the best path to a proof of concept is to output a Finale 3D-compatible file (Excel format). Finale 3D has extensive documentation, can import the firework database, and can render a full simulation with music and animation. This avoids needing to negotiate with Glow/Ignite in the short term. Harry noted that Finale 3D has a 14-day free trial.

### 13. AI and Automation

Robert's core idea is to use AI to "learn" the personality of fireworks so the tool can automatically match them to moments in a song. Harry asked whether users could also prompt the system conversationally (e.g. "I want a big finale"), and Robert confirmed yes – like talking to an expert pyrotechnician.

### 14. Integration vs. Standalone

Robert's preference is to integrate with the Glow ecosystem rather than compete with it. However, he is open to the team building their own simulation tool if it proves straightforward. The key requirement is that the output must be compatible with the Ignite firing system. Robert is meeting the owner/developer of Glow and Ignite at a conference in Indiana in the second week of April.

### 15. Next Steps and Resources

Robert will provide 20–30 animation files and accompanying real firework videos. The team will brainstorm specifications, develop a vision and roadmap, and report back next week. Robert shared a link to his consumer firework brand website. Communication will happen via a WhatsApp group.

---

## Action Items

- **Robert:** Provide 20–30 firework animation files and real firework videos to the team

- **Robert:** Document firework "personality" descriptions and share links to pyro-musical shows

- **Robert:** Check whether Finale 3D free trial allows database import

- **Robert:** Investigate temporary Finale 3D licence for the team

- **Team:** Explore the three shared links (Ignite, Glow Fireworks, Pyro City/3D Show Builder)

- **Team:** Research Finale 3D documentation and Excel file format requirements

- **Team:** Brainstorm specifications, vision, and roadmap for an initial prototype

- **Team:** Report back to Robert next week with a proposed direction

- **Team:** Create a WhatsApp group including Robert for ongoing communication

- **Team:** Propose a baseline for consumer firework safety distances for Robert to validate

---

## Full Transcript

**Harrison Black [0:03]**
Everything. So if we miss anything in like our meeting notes, it's a lot easier for us to go back and, you know, just make sure we don't miss anything.

**Robert Foti [0:08]**
OK. Can you see that it's recording? Can you see it's recording? Yep. Yep. All right. Um, yeah. So, uh, yeah. So that's where I do from it in terms of my my background knowledge. Um.

**Harrison Black [0:11]**
Yes, yes, it is good. No, thank you.

**Robert Foti [0:25]**
In computer science, I I I don't have any. I don't have any. I have. Well, I'll rephrase that I have worked with a software engineer actually who lives in Canberra where we developed a tool for doing firework certification. So that was like an online tool. So I I do have experience in developing user interface. I'm I'm quite good at that and I do a lot of design work also so. I do have that knowledge, but in terms of the technical knowledge, I generally, uh, don't like, I know what I don't know, which I guess is a useful thing. Um, all right. So do you want me to, should I just go through the document that I've done and. And yeah, and is this the scope of our discussion today is to sort of define the project? Is that sort of what we're?

**Harrison Black [1:31]**
Play song.

**Harry Randall [1:32]**
Lucer and they can talk to you about their requirements and stuff and what you're actually after.

**Robert Foti [1:37]**
Yeah. All right. So, yeah. Anyway, so I think this document hopefully kind of outlines the requirements and then I I figure we can go through this and then you can decide what's realistic and what's not realistic. So I I I don't have um. Predefined expectations. I I, you know, the one thing I do understand is not nothing's as simple as it seems. So I I I'm happy to be realistic with the project. So so just going through the document that I sent through. Introductions kind of what I what I was just saying before. The general project scope is to develop an app that designs power musical shows for the average consumer. That the that the script for the show can be used by an existing electronic firing system, and I'll talk about that soon. And that it can be easily used in a retail setting. Um. I put this part, the part 3, which is, you know, what makes a good designer of a pirate musical show. So this is just some points that I put down because essentially this is in my my belief and what what makes what what the software needs to be able to do. And for me, when you're doing a pure environment musical show, you do have to have an year for music. And understand the mood and emotion of a song. So, you know, when you're when you're watching Netflix and you've got the subtitles on it, it'll tell you, you know, somber music building to a crescendo or whatever, you know the so um. That's kind of what you're intuitively doing and understanding what the mood and emotion of a song is. And combining that with knowing what the fireworks are, you also have to have an eye and an ear for the mood and emotion of the fireworks, which. May sound a little bit weird, um, but that's that's essentially what makes a designer good is understanding what the firework does and understanding how a firework can combine with the mood of an emotion. Um. Of of music, you know, I mean, it's as simple as knowing, you know, you can't just have loud bangs in during a soft piece of music, but maybe there are some soft pieces that where it's appropriate because of the emotion that it's.

Trying to generate. So on top of that is knowing what colors and effect combinations can work well, how to combine those are different designs. And the final part is having, which is also one of the harder part is having the technical and safety knowledge about. Um, what can be done and where and how, you know. So I mean my my family, we do Sydney, New Years Eve fireworks, which is, you know, pretty well known, um, around the world. So we'll often have, you know, people go, oh, why don't you do this? And they come up with all these, you know, really fancy, great looking designs, which. Don't look great, but it's like, yeah, you can't do that there because of technical or safety reasons. Um.

In Section 4 of the document I sent, I don't know if this is the right terminology or language to use, so I hope you understand what I mean with it, but I was trying to put in terms of what are the inputs and outputs related to this so. Um, the what I call back end inputs. Um. You is firstly is firework videos. So I guess you know in order to know what a firework does need to have the visual visual to it. So I have an abundance of firework videos. Pirate musical displays and scripts and everything. I have the firework videos of mainly. I have the consumer fireworks, an abundance of them. I don't have so many displays or scripts for consumer firework pirate musicals because it's not. That common that they've done. And that's the thing I wanted to say is that people do shoot fireworks to music with consumer fireworks, but it tends to just be background music, so it's not really choreographed as such. Um. Other inputs are the firework simulations and animations and for there is an abundance of of that as well. Just some of that we need to work out how to access. But um, that stuff already exists. So there are already software, um design software that um uh is uh animation based or you know where you're getting doing a 3D model of what your firework displays and that's what professional people use. So that and but there's also I mentioned earlier a consumer company that has produced animations for consumer fireworks. So that's it. And then a database of inventory available. So if you're going to be designing a show, you've got to know what you've got available in order to to use that. The consumer inputs, you know, if someone's a user, they want to have a song or a soundtrack in mind.

And that can be songs they know. And I mean, I threw this in there. Or maybe AI can create a a song, you know, maybe someone wants to make a song about a particular person cause it's their birthday or whatever, and they'll use AI to do that. They're going to have a defined budget, so that's an important aspect of like a a parameter for the design location details. So what that means is, you know, are they doing this on a street or in their backyard and how much space do they have? Because that defines what you. Can do and also the level of knowledge. You've got some consumers who do it once a year and they don't have any knowledge. And then you've got other consumers who it's their hobby and they know they're like a next level up. Um, the outputs and as far as a working title, I'm calling this app or software, whatever you want to call it, showcrafter. Um, the output is simple. It's a list of fireworks, um, a simulation of the show using existing, uh uh, animation. So I'm not. Not suggesting creating animations as part of this project, like forget that and a script or file or direct interface with the firing system. So they're the in my mind the general outputs. But ultimately the I guess the goals of this um project I give for me in general are two-fold and you guys can have your inputs here is. We need to what doesn't exist now is. Software that defines a personality of a firework. And and then to be use this data to build a a pirate musical show with that so. Does does all is? Does that all make sense what I'm saying with that?

**Liam Maloney [9:37]**
Yeah, I think we can agree. This is a good, um, starting scope to work out on to start off with. Um, I'm. I have a few personal questions about some of the information.

**Robert Foti [10:04]**
Absolutely. Really.

**Liam Maloney [10:05]**
No worries. OK. So a lot of these questions are based around the database of available product. First of all, you said your company is a manufacturer, right? So do you have any associated retailers that?

**Robert Foti [10:14]**
Yep. Correct.

**Liam Maloney [10:24]**
Database will be inventoried based on.

**Robert Foti [10:30]**
Yeah, I can. Yes, I I can. Yes.

**Liam Maloney [10:34]**
OK. No worries. Um, did you want it to like, uh, be sort of regularly updated based on like what's in stock, what's out of stock or just kind of like the general inventory of the stores?

**Robert Foti [10:48]**
Uh, yeah. So what happens at the moment is, um, uh, the. Uh, so I'm I'm sort of looking at the moment of like piggybacking this off off existing um technology like an existing things. So there's a um and I'm just trying to find the domain. I should have prepared this uh.

**Liam Maloney [11:08]**
That's fine. Yeah, yeah.

**Robert Foti [11:16]**
For you. But yeah, anyway, there. So there's this service that the these people provide that. Has all that data there. So what happens is a firework company. I actually it's I'm gonna send you a link to a customer because this will be a much better way to do it than me trying to talk.

**Liam Maloney [11:40]**
Yeah, um, you can honestly probably. Uh, it's not.

**Robert Foti [11:45]**
Um, talk. Talk this. So one one second. I'm gonna get a link.

**Liam Maloney [11:55]**
Uh, die right now. It's just like, so by my understanding, it's more just like a generalized uh list, right? Of just fireworks that are generally used. Um.

**Robert Foti [12:00]**
OK. Yeah. So, So what I'll what I'll probably do is I I I can send you a YouTube link to my catalogue of fireworks and then you've got a range of fireworks. OK and and then in terms of animation, I can get animations to all of those as well as the actual video, so.

**Liam Maloney [12:07]**
By customers. Mhm. Cool. Great. That's all good.

**Robert Foti [12:26]**
Yes, so Yep.

**Liam Maloney [12:27]**
Sweet. No worries. Um, do you have, um, a sort of personal way like 'cause it seems like, uh, when you wrote the personality of each firework available. I feel like we would have our own opinions on this, but like, you know, it's cause it's a pretty subjective subjective topic. If there's any like, I'm sure we will go through and find a list and try to make our general assumptions on the personality.

**Robert Foti [12:43]**
Mhm. Yeah.

**Liam Maloney [13:02]**
But I feel like it would be helpful for you, for us, for you to just kind of like describe someones that are like, I don't know, that feel certain ways to you, I guess.

**Robert Foti [13:10]**
Yep. Yeah, I, I, I, yeah, I, I I think I've actually had written that down once. I've got to dig that out. Um, I think one of the most useful ways to.

**Liam Maloney [13:21]**
Hmm.

**Robert Foti [13:28]**
Learn that is actually watching.

**Liam Maloney [13:31]**
The videos Hmm.

**Robert Foti [13:31]**
Pirate musical shows. Um, because then you're seeing and and it is and it's incredibly subjective, um, um, subjective thing. Um, where you can get 2 designers who've got the same fireworks and the same piece of music and. Will design something quite different, but by watching the shows you can learn. What tends to go with what? So I think I'll I'll I'll put something on paper or trying to get what I had already um written and I will um also send you some links to pirate musical shows that. Will um. Help you understand what all of that means as well.

**Liam Maloney [14:21]**
Thanks so much. Just one final one for me is regarding this like firework safety and like what was the term you used does like in terms of locations and context like technical and safety knowledge.

**Robert Foti [14:37]**
Yep.

**Liam Maloney [14:40]**
Do you know of any reading that we can do about that topic, just to familiarize ourselves with it?

**Robert Foti [14:44]**
Um. Well, uh. In fact, for consumer fireworks, there are no set rules or guidelines, which is a bit, which is funny. So professional fireworks, there are very there's a very established rules and regulations, so in Australia. Um, there's an Australian standard and there's a Queensland standard, and a lot of, you know, states follow the Queensland standard, Um, which is really about the safety distances that you can be from an audience. Um, whereas for the consumer fireworks. One uh. There is nothing. It's yeah, which is ironic, but there is nothing. So um, and applying the professional standards may not al always be appropriate to the Um. Consumer experience so. Yeah. So whatever. So we'd need to. So I need. So it's kind of something I need to, I'll need to figure out and just say, OK, what's reasonable? That's, yeah.

**Liam Maloney [15:49]**
Yeah, that's all right. We'll figure it out. Yeah, I'm sure we can set up, uh, find out like a baseline for us and then you can just tell if it tell if it's strict enough, not strict enough.

**Robert Foti [16:08]**
Yeah, I mean the, you know, it's like to give you an example of what it's like like in the in the like according to the QLD standard, the regulation is that for every millimetre of calibre. Is 1 metre of safety distance. You know, so if you've got 30 mill millimetre calibre, um, firework, then it's 60 metres. Um. So that sort of gives you, uh, a rough idea of what the kind of thing that I'm talking about. Um, and we can establish uh. Let's just say if that's the rule to start with, then, but that's sort of a. Fluid at the moment because consumer 5 weeks don't don't have that regulation as such.

**Liam Maloney [17:02]**
Right. That's all my questions. Thanks so much.

**Harry Randall [17:06]**
I'll, I'll hop in next. So I just want to start off with did you, did your company, your family's company, did you service the whole contract for the?

**Harrison Black [17:06]**
Hold up.

**Robert Foti [17:18]**
So you've gone on mute, Harry.

**Harry Randall [17:21]**
Sorry about that. Do you do you service the whole contract for the like the Sydney Fireworks show? Like did your company handle all of that?

**Robert Foti [17:23]**
Mm. Yes. Yes.

**Harry Randall [17:31]**
Wow. OK, OK. My next question is like, I just want to know how the application in your mind is gonna work. Like if you're the client and you're looking at it, how how do you see it working?

**Robert Foti [17:45]**
What what I imagine would be. Uh, a useful tool is that the average consumer goes into a store with their, um, mobile phones. They're on, so they're on the store, the app for that store and they say. Tiles. And then they press a button that gives suggestions. You know, maybe that people say, oh, I like this sort of firework or that sort of firework as well, but that's generally it's sort of in order, in order for it to be. Um, uh, adopted or used. It's gotta be simple and that's, you know, so.

**Harry Randall [18:53]**
Fly pressure. Yeah, no, I I get that. In terms of having it on a phone, I'm not 100% sure of the feasibility of that, especially if it's like just like, do you want to display the whole fireworks show on the phone? Like they'll be able to see a visualization of that.

**Robert Foti [19:10]**
No. Um.

**Harry Randall [19:13]**
Yes.

**Robert Foti [19:15]**
Oh, I mean, that's what happens now. Like it's uh uh. And when when you see the, um, the current apps or whatever that get used, you'll get the sort of sense of that. I mean, at the moment, um, the firework firing system that I'm. Looking to interface with is controlled by mobile phone as well. So yes, I. Yeah, I don't think it's not feasible, yeah.

**Harry Randall [19:46]**
OK, Yep. And do you want to, you don't want it like you don't want your own website where you have basically the whole thing. You have like the Fireworks, all those parameters and stuff, and then the client could potentially like buy it directly from you.

**Robert Foti [20:03]**
No, I mean, I I think in order for this to be well, who who you, who you saying the client is?

**Harry Randall [20:08]**
So let's just say I want to buy a firework. So I go onto a website, I plan everything out, put my budget in the location, and then it gives me a list of all the fireworks I need to buy and I can just buy it directly from there.

**Robert Foti [20:16]**
Mm.

**Harry Randall [20:24]**
Instead of having to go into like a store and everything.

**Robert Foti [20:25]**
Um. OK, well, you have to go to a store anyway because you can't ship Fireworks on, um, like you you can't ship it with FedEx or whatever. Um. And yeah, it it basically is like that, but it's gonna going to be. I I see there's something that can only work if you if you're making it available to the the in actual fact that the client of the software is the retailer. And the retail and the consumers are actually using the, so you're helping the retailer drive their sales.

**Harry Randall [21:08]**
I know. What are you getting out of this then? If you're, I guess if you're the manufacturer, there are more sales and that's better for you. Is that the idea?

**Solomon Inyang [21:11]**
OK.

**Robert Foti [21:15]**
Well, put the man, put, put the me being a manufacturer, put that to the side. Um, because um, what I'm doing is setting up a product that helps retailers sell more fireworks. So that can, you know, so I have my distributors in the US and yeah, it'll help them. But in order for something like this to work, it's got to have scale and I can use my network as the the testing ground for it or whatever.

**Harry Randall [21:36]**
OK.

**Robert Foti [21:44]**
But for me, it's more of it's, you know, I'm not doing this as a I'm doing this to help people sell Fireworks as opposed to just purely to sell my fireworks. I'm sort of broadening the broadening the market, the market scope for it.

**Harry Randall [21:46]**
All of this really got it. And do you see it more as the retailers would be using the tool or more of the consumers as in when someone enters the store, will like the the retailer come and say like, hey, what do you want? We can do a little demo here.

**Robert Foti [22:20]**
Yeah, it it.

**Harry Randall [22:20]**
Is that what you're offering? You want a client to be able to do it more like on an app or something on their phone?

**Robert Foti [22:22]**
The consumer, yeah, the consumer, the so, so it's a service that the retailer is offering to their customers.

**Harry Randall [22:30]**
Yeah.

**Robert Foti [22:33]**
And their customers are the consumers and we're providing this platform to the retailers.

**Harry Randall [22:41]**
Sure. OK. Yeah, I think that's probably all from me for now. Yeah.

**Robert Foti [22:58]**
Any other questions or?

**[23:01]**
Uh.

**Harrison Black [23:01]**
Yeah, I I was just wondering, when it comes to the like data sheets on like these fireworks, I guess like how verbose are they? What do they look like?

**Robert Foti [23:03]**
No.

**Chongyang Fang [23:04]**
Which song?

**Robert Foti [23:16]**
What do you mean by data sheets?

**Harrison Black [23:18]**
Like, let's say like when we're like if we wanna program like the firework show. And we like want to have an animation for a firework. You need to know like when like you know something you need to know like the size of like how big it is, the color also like how long from launch until like it actually. Um.

**Robert Foti [23:44]**
Yeah. All the all the all the technical data for the for the item, yeah.

**Harrison Black [23:48]**
Yeah, all the technical data, yeah.

**Robert Foti [23:50]**
Um. So in so how how will you have that information or?

**Harrison Black [23:58]**
Well, I I am just wondering how we'd have that information. Is there like, is there like a data sheet for every type of firework that's like relatively standardized or is that something that would be a bit harder to like find I guess?

**Robert Foti [24:12]**
No the so the way the existing firing system and the animation software works is they have their data input is like. Uh. So the I I take it a step back. The the way that the there there's a software called the the showbuilder software that they have is something called Glow. Um. And uh, you know, the domain is glow fireworks. If you wanna search up glow Fireworks and I work with the guy with that and um, basically he, you know you you're sending in an Excel spreadsheet of what the firework does. And a video of it and he works out what it what it should do based on all the parameters. So I the the one thing about the so the one thing for the the for that is that they you know they will that's done knowing the. Aspects of, well, this size firework generally births this big, da, da, da. And you know, we've got a video, um, showing it. So yeah.

**Harrison Black [25:33]**
Yeah, cool. No, thank you. The other question I wanted to ask is you do want to have this as an app, right?

**Robert Foti [25:39]**
Yes.

**Harrison Black [25:42]**
I was wondering in terms like the technical aspects of that, what we this is just me spitballing. I don't actually we still have to obviously do a lot of research into like what exactly we're gonna do. One thing we could potentially do is to make it accessible both on desktop and. On mobile, mobile is basically what I'm thinking is maybe we could have something like we could host on a website and then we could make a dedicated app that's more so just like a wrapper for that website. So it connects to your website, your database, whether that's all managed on there.

**Robert Foti [26:02]**
Yep, Yep. Yes.

**Harrison Black [26:21]**
And the app basically just acts as like a a fancy wrapper. So with like a few maybe features to make it like integrate a bit nicer compared to like, you know, running it on your phone's like web browser or whatever. Would that be the sort of thing you're interested in?

**Robert Foti [26:27]**
Yep. OK, so all right, so I I've just sent you 3 links. Have you have you all got that? All right, so the three links are uh the which I think understanding this will answer the question you've just asked. So um, the simple one without going in detail with it, if you the one that says ignite firing systems. Um, that's, uh, the firing system. That's what people are using to shoot the firework show. OK, um, and. That's the hardware, basically. And um, there's also a software for shooting the fire, but effectively you're buying hardware. Then if you go to Glow Fireworks. This is. Well, you can see from their their homepage what it says it's allows people to view 3D products, simulations, design shows and plan purchases. All right. So I know you guys can play with this later if you like, but that that's, you know, they're the ones that actually develop all the. The simulations. Now I wanna show your website if you go to Pyro City, um, that this is a customer of mine and they're one of the biggest, uh, you know, companies in the US. And if you look on their website, um, you can see that there's something that's, uh, that's called Uh, 3D3D Showbuild. Can you say that? All right, so when you click on the 3D show builder, what that is, that's, uh, embedded in their website is the glow. Software or whatever and this is just all just all on the website and. Side and. This is where the database of products lives. So it sort of has all the products in there and you can you guys go and play with it and but you'll work it out. Um. And So what we're trying to do is really there's two parts to it and is either we're creating a new tool that that, um, designs the shows or. We're creating and this would depend on whether the the Globe people are interested in it or we're creati creating a um, I don't know if it's the right term, but a plug in to their software so that allows people to design their own. Show or it's a side-by-side, um, uh, software. Um. So yeah, so that's what I'm uh.

**Harry Randall [29:26]**
Stop.

**Robert Foti [29:32]**
I I think if you study those three things, that gives you an idea of. What the? What the market kind of looks like and what we're hoping the final. So the what we're doing that doesn't exist now is creating the automatically creating the Pyro musical and and um, you know, I I could do. Um. You know, go through every firework and define, you know, and and also the thing you'll learn with, um, consumer fireworks is it's, uh, like with professional fireworks, you have like one type of firework and you're, um, using that um. As like as your palette and then creating something with a consumer firework, it's often a mix of different fireworks. Like you you have one ignition and then it might be 30 shots and they could be different. Um, so it could be a bit of a mixed salad or it could be designed. So that makes it more challenging. For designing into a show. Um, but yeah, what doesn't exist is the ability to make a pirate musical show automatically. So how that happens, I mean at the moment I know that people are using like their. Playing with the existing AI tools to do that. What I think is an opportunity is is to develop a tool that defines the personality of fireworks of a fireworks so it knows. Firstly, to define the personality and secondly, so then it knows where it can fit into a song.

**Harry Randall [31:18]**
I'm just taking a look at it. The the Glow Fireworks is actually just like a a website, like a platform both on the phone and like laptop. And I think that'd be much easier than having a dedicated mobile app, not to mention like all the fees and stuff.

**Robert Foti [31:33]**
Yeah, yeah, actually I use the term app and I use the term app, but yeah, it can be absolutely, um, just a mobile, uh, like a website.

**Harry Randall [31:39]**
He's gonna be working a lot. As long as you can access it on your phone. Yeah, yeah, cool.

**Robert Foti [31:46]**
That's all, yeah.

**Harry Randall [31:55]**
Another question. So you want to you want to basically integrate AI to design the show, so to speak, based on music. But you also want the ability for the the end user to be like, hey, at the end I want like a very big finale and they can like prompt that into the the fireworks show. Like they they can kind of design it with just like talking to like a chat and design it like that.

**Robert Foti [32:21]**
Yeah, I mean, in the end, um, yes. So it's all about the user experience, but it's also about driving sales. So anything that, uh, you know, you, you know, do you wanna, you know, do you wanna supersize your fries kind of thing. So yes.

**Robert Foti [32:39]**
Yeah, absolutely. And being. So is the question more, do you want to be able to talk to the the the tool? Yes.

**Harry Randall [32:46]**
Yeah, yeah, like you're talking to an expert Pyro. Yeah, cool. And where? Where will we find all of these, like, firework files? Like for the actual display animations?

**Robert Foti [32:53]**
Yes. All right, so. That's a good question. So for my for my business, I have all the simulations. Um, I have all the simulations so I can. I just actually got to output them as a um as a file that I can send to you.

**Harry Randall [33:25]**
What is it stored in at the moment? What file format is it at the moment?

**Robert Foti [33:26]**
And then you'll have it as a file, however. Um. Uh, it's an MP4, I think. Or it can be how I however I want to output it using. Yeah, it's just a video, yes, but um, so the.

**Harry Randall [33:34]**
Be prepared. OK, so it's like a video kind of thing. OK, OK.

**Robert Foti [33:48]**
The person who the globe. Um. The glow and if we're uh looking at integrating it with glow and and the ignite firing system, I'm actually meeting with them in uh uh the second week of April. They actually have a have a convention that they have um. And I'm presenting at it. So I'm sort of like at the moment wondering, do do I talk to them about it now or wait until we've got something that's more established? I guess my question is, what do you need in order to get started on this? To be able to to be to create proof of concept.

**Harry Randall [34:30]**
Um. Yeah, to get like to an MVP, we definitely need the files. I don't know if we necessarily need a database of what's available. We could like integrate that later, but we definitely need a list of like and also all of the animations for the fireworks and then we could kind of build. I like a basic MVP of the product and from there like integrate more features.

**Robert Foti [34:58]**
Yeah. So a as a as a realistic starting point, if I was to get you say 20 or 30, um. Animation files and their accompanying videos. Um.

**Harry Randall [35:13]**
What do you mean by accompanying videos? You mean like an actual example of them?

**Robert Foti [35:16]**
And use that. Oh well, the actual, the real, the real firework.

**Harry Randall [35:19]**
Right, OK.

**Robert Foti [35:20]**
So sorry, so the real firework video and the and the animation of it.

**Harry Randall [35:25]**
What would be the benefit of having the real firework video?

**Robert Foti [35:31]**
Actually, probably more than you can see what it actually really looks like, but it's real. I don't know. I don't know if it's something that is useful for you in in building this or not. Yeah, but um.

**Harry Randall [35:34]**
You can access to. Oh, yeah. That's not to have, yeah.

**Liam Maloney [35:44]**
It's useful for us to find out the personality of the firework.

**Robert Foti [35:48]**
Yeah, yeah, I think so, because you're getting a real, real sense of it. Um, but I mean, but that cost me nothing to do because I've already got all those videos anyway. So um, it's more the only thing I've got to do is spend a bit of time generating the uh. Um, uh, the video files from the the animation software. But that's fine, I can. I can get that get that happening.

**Harry Randall [36:15]**
Yeah, another question I have, I mean, if we're literally going to be like stitching videos together, what if they want to have like 2 fireworks going up at once that like may overlap or something or like things like that?

**Liam Maloney [36:16]**
Yeah, 100%.

**Robert Foti [36:28]**
Well, yeah, well, that's a yeah, well, that's The thing is that, um, that's where the the glow software allows you to do all of that. Um. And I mean. What what I think the the. I I don't think it's um spending the time and energy working on something that already exists to me isn't the priority in so far as um if we if we as a starting point can pro. We can develop a tool that can output a script. Even if it's just a Excel file script and as I say this, maybe this is a better way of of doing it is. Next, I'm going to send you another link, which is. In terms of doing a proof of concept, this is actually a better way to do it. Where's chats?

**Liam Maloney [37:37]**
I feel like if we can interact like judging by what you I I feel like what you want. I feel like if we could integrate with Glow Fireworks and use our product to create a script to create a demo with. Like Glow Fireworks, I feel like that would be best for the consumers.

**Robert Foti [38:02]**
That I think that's the ultimate goal, but actually in terms of getting proof of concept happening, I've just sent you the another link to a professional scripting software. And this is Finale 3D. So this is where I've got all my animations for the consumer Fireworks already in. So there's so the database is already in there so so and I can import an Excel file into that and it'll. Do the show as it's been designed. So I actually think in terms of proof of concept, without having to talk to the globe people and say, oh, can we, you know, integrate or whatever, I think it's. Proof of concept. If we can output a Finale 3D file and Finale 3D is like the standard and the most commonly used scripting software, that would be the easiest and simplest way to. Um. Uh, be able to see what we're we're doing, see to actually see the show that is being designed because that integrates the music, the animation, everything. So that's sort of what I think.

**Liam Maloney [39:26]**
OK. I feel like that's a good starting point, yeah.

**Robert Foti [39:28]**
And from there. Yeah, because then, um. And then from there, uh. We can um. And I'm thinking that maybe what I need to try and do is get a. Temporary license or whatever for the software for Finale 3D. Um, but there is Finale 3D is a great starting point because there is so much documentation and information about. All of it that you'll know exactly what you need in order to generate an Excel file that can be imported in and be the script for the show. So um, I think that might be the best in terms of getting to a proof of concept stage, that would be the best.

**Harry Randall [40:26]**
I've just had a look at another 14 day free trial, so between us it should be enough to get us like started with that.

**Robert Foti [40:34]**
Yeah.

**Harry Randall [40:35]**
Yeah.

**Robert Foti [40:35]**
Um, I just don't know whether with a free trial whether you can import. A database or not? I need to check that and if that and if you can import a database and it's perfect because I can just give you the database for the consumer fireworks and um, you can, yeah, and I can sort of give you the basic training on how to import, how to do it and then you'll then you'll. Or become firework design, firework show design experts.

**Harry Randall [41:09]**
How good? OK. Does anyone else have questions?

OK. Yeah.

**Liam Maloney [41:20]**
I feel like that's probably most of what we need from you for now. I feel like we can come together as a group between us, figure out some more of the specifications and maybe. Get back to you next week with what we've got in terms of our vision and our road map on like more of an immediate prototype so that you can get the proof concept out.

**Robert Foti [41:39]**
Yep. Yeah. All right. Cool. Yeah. That's I'd be, yeah, I'm, I'm, I'm really keen to hear. Like I said, I don't know. I don't understand the technical aspects of it. So, you know, when I when I first was thinking about this project, I was just thinking about it in terms of AI. Um, because of that's what everyone talks about and people have been playing with whatever. To be honest, I don't even quite understand what that really means other than, um, I thought in my mind to to learn the personality of the firework is something that can be trained. And that's where, um, why I thought of it. So I'll I'll be keen to hear like after we speak next on whatever, what the sort of what direction you think you'll you you plan to go with it, but um. Yeah, so. Has has the information I've given you given you enough info, given you enough information to move forward with? With this.

**Harry Randall [42:56]**
OK.

**Liam Maloney [42:56]**
Yeah, I I believe it has. We can start brainstorming and getting together a sort of direction. The one thing I think we'll need to discuss and then get back to you on is. More of some technical limitations. Obviously, if what we're designing isn't, it turns out to be an app. Mobile phones don't have a lot of resources to them, so even for like. The final 3D, say for example you wanted that on your phone. That wouldn't probably be feasible because a 3D modeling tool like that uses a lot of resources, whereas Glow Fireworks since it kind of.

**Robert Foti [43:35]**
Yeah.

**Liam Maloney [43:41]**
Externally does the creation. That would be more like realistic.

**Robert Foti [43:47]**
Yeah, I I I I agree 100%. The um, you know, and I may maybe me using the word app is the incorrect, uh term. It's just more of a tool and it's a web-based tool and my and my whole idea.

**Liam Maloney [43:59]**
Yeah, we we can figure out the best way to do it.

**Robert Foti [44:03]**
Yeah. And my whole idea was to be to offer something that I can integrate with Glo. There's no point trying to develop something that competes with it or whatever, because, um, there's an ecosystem there. There's apart from the fireworks themselves and the retailers, there's the firing system. And this glow platform. So if I can feed into that, why I suggest about working with Finale 3D as a is I think that's the most accessible way to prove the concept. Um, as a starting point. Um and uh, then from there and like, I mean, I don't know how fast we can work on it or what's realistic, but like I said, I'm I'm meeting the Uh owner and developer of Glow and Ignite firing systems. In the second week in going to a conference in Indiana, and I know him, I know him very well, so I'll be able to. Uh, be able to discuss it with him if we've got something to discuss. And the final link I've just sent you is, um, my website to my consumer firework brand. So um. Yeah.

**Harry Randall [45:30]**
Just for the you saying you wanna integrate with Glow Fireworks, do you mean like you wanna like partner with them and we build like software on top of the tool like?

**Robert Foti [45:40]**
Well, that that's what I well, that's what I would think would be a a practical way to do it because um.

**Harry Randall [45:43]**
OK, good. Good. Good. Thank you. It's OK.

**Robert Foti [45:48]**
Yeah, like I said, otherwise. If we're pro doing something that's OK, see in the end we need to be able to create something that can be U that can uh be the output can be used by the ignite firing system. So the reason I say glow is because it's already there and it can produce a simulation.

**Harry Randall [45:59]**
OK. Mhm. Yeah.

**Robert Foti [46:13]**
I mean, we can produce a tool that doesn't produce a simulation, but I think part of the experience is the simulation is important.

**Harry Randall [46:18]**
If it turns out to be quite easy to make a tool like glue, like they can just recreate it ourselves in a day, would you be against us doing that?

**Robert Foti [46:32]**
No, no, no, not at all. As long as it as long as it can the output can be something that can integrate with the firing system. Um, yeah, all right. I I've got to actually go in a minute, but uh, is there any other pressing questions or whatever?

**Harry Randall [46:33]**
OK. Yeah, cool. Yep. If we have any questions for you, like questions that come up during the day or things we think of, what's the best way to contact you and you find the message outside of these meetings?

**Robert Foti [47:03]**
Yeah, I'm happy to receive WhatsApp. Um, does everyone use WhatsApp? So I'm happy for you to create a WhatsApp group and include me and communicate like that.

**Harry Randall [47:16]**
Perfect. That sounds good.

**Liam Maloney [47:18]**
Is that your WhatsApp number in the chat?

**Robert Foti [47:18]**
Um. And yeah, that's my that's my Hong Kong mobile number, which was for WhatsApp. Yep. And my final question before I go is how what happened? How do I export this recorded transcript?

**Harrison Black [47:38]**
I'm pretty sure if you just press more and then stop recording it should stop and then in a while and I'm hoping that we're gonna be sent the transcription and everything.

**Robert Foti [47:48]**
Oh, it'll shut. Yeah, it'll just. Oh, OK. It'll do it. Yep.

**Harry Randall [47:53]**
Um, I'm.

**Harrison Black [47:53]**
Um, I'm not too familiar with teams either, so.

**Robert Foti [47:59]**
Well, let's see. Let's see what happens. So I'll I'll stop.

**Liam Maloney [48:00]**
I've I've also been writing most of the things down just in bed and paper, so should be fine.

**Harrison Black [48:01]**
I. Mm.

**Robert Foti [48:06]**
All right, good. I've got to go, guys. But um, thank you. Um. And yeah. And if there's, uh, like I said, any questions, anytime, no worries. All right.

**Harry Randall [48:08]**
All right. All right. Thanks so much for your time.

**Liam Maloney [48:08]**
All right. See you later.

**Harrison Black [48:09]**
Yeah, right. Pleasure meeting you, man.

**Liam Maloney [48:12]**
Yeah.

**Liam Maloney [48:15]**
All right. Bye-bye.

**Solomon Inyang [48:15]**
Thanks, Robert.

**Harry Randall [48:16]**
Thanks a lot.

**Robert Foti [48:17]**
Cheers. Thanks. Bye.

