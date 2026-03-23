---
notion-url: https://www.notion.so/Product-Vision-Roadmap-325cd8a5bf0880f3b8ead17a7e10029d
title: Product Vision + Roadmap
date: '2026-03-16 02:24:00.000'
from_notion: https://www.notion.so/Product-Vision-Roadmap-325cd8a5bf0880f3b8ead17a7e10029d
author: From Notion
last_edited_time: '2026-03-22 22:49:00.000'
---
<br/>

<br/>

# Overview

ShowCrafter is a web-based tool that lets everyday consumers design AI-choreographed pyromusical fireworks shows using products available at their local retail fireworks store. Users pick a song, set a budget, describe the vibe they want, and ShowCrafter handles the rest - analysing the music, selecting appropriate fireworks from the retailer's catalogue, and generating a fully choreographed show plan ready to execute.

The tool is provided to consumers by fireworks retailers, either in-store (as a sales and upselling tool) or online (as a self-service experience). ShowCrafter's client is the fireworks manufacturer and distributor; retailers are the channel; consumers are the end users.

## The Problem

Consumer fireworks shows today are almost entirely unplanned. A customer walks into a store, picks products off a shelf based on packaging and price, and sets them off in whatever order feels right. The result is usually underwhelming - poorly timed, repetitive, and disconnected from any music or narrative arc.

Professional pyromusical shows (like the Sydney NYE fireworks) are choreographed using specialised software such as Finale 3D, but this tooling is designed for trained pyrotechnicians, not consumers. There is no accessible way for a casual buyer to get a professionally structured show from the products they can actually purchase.

This gap hurts everyone involved. Consumers get a forgettable experience. Retailers miss upselling opportunities because customers have no reason to buy a wider variety of products. Manufacturers have no feedback loop connecting their product catalogue to consumer demand.

## The Solution

ShowCrafter bridges this gap by making AI-powered show choreography accessible to anyone. The core experience is simple:

1. **Choose a song** (or describe the show you want in plain language).

1. **Set your parameters** - budget, location, display duration, time of day, and any stylistic preferences ("big and patriotic", "romantic and slow-building", etc.).

1. **ShowCrafter generates a choreographed show plan**, selecting real products from the retailer's inventory, timed to the music's structure (drops, builds, crescendos, quiet sections).

1. **Review and refine** - users can adjust the plan with natural-language prompts ("make the finale bigger", "swap out the blue effects for gold").

1. **Get your outputs** - a shopping list of products to purchase, a PDF show guide with firing instructions, and (in later phases) an interactive simulation of the show.

Because the show is built around the retailer's actual stock, every generated plan doubles as a curated shopping list. This creates a natural upselling mechanism: the AI might recommend a product the customer would never have picked up on their own, but which makes the show dramatically better.

## Target Users

The primary end user is the **casual consumer** - someone buying fireworks for a backyard celebration, a birthday, a holiday like the 4th of July or New Year's Eve, or a small community event. They want something impressive but have no pyrotechnic expertise.

As the platform matures, it will also serve **semi-professional users** - people organising shows for weddings, sporting clubs, community festivals, or corporate events - who want a more polished result without hiring a full pyrotechnics crew.

## How It Works (Technical Summary)

ShowCrafter's pipeline has four key stages:

**1. Music Analysis**
When a user uploads or selects a song, the system analyses it using audio feature extraction (via librosa or equivalent). This produces a timestamped map of the track's structure - identifying beats, tempo changes, energy peaks, drops, builds, and quiet passages. Each section is classified so the choreography engine knows where to place emphasis.

**2. Choreography Generation**
An LLM-based agent takes the music analysis, the user's preferences (budget, style, duration, custom prompts), and the available product catalogue as inputs. It generates a choreographed sequence: which firework fires at which timestamp, from which position, creating what effect. The agent reasons about pacing, variety, colour palette, and budget allocation to produce a show that feels intentional and well-structured.

**3. Product Matching and Inventory Awareness**
The choreography is grounded in real products. ShowCrafter maintains a catalogue database of fireworks with their technical specifications (effect type, duration, colour, height, calibre, fuse timing, cost). Products are linked to specific retailers and their stock. When a user specifies their location, the system identifies nearby stores and builds the show around what is actually available to buy.

**4. Output and Export**
The system produces several outputs:

- A **shopping list** of products used in the show, with quantities and estimated cost.

- A **show guide (PDF)** with timestamped firing instructions the user can follow along to.

- A **Finale 3D-compatible CSV file** that can be imported into Finale 3D for professional-grade simulation and, if needed, integration with electronic firing systems.

- (Future) An **in-browser simulation** showing a real-time 2D or 3D preview of the show synchronised to the music.

## User Accounts and Persistence

Users can access ShowCrafter without creating an account — the tool should be immediately usable. Account creation (email or social login) unlocks the ability to save shows, revisit and refine previous choreographies, and share show plans. The friction-free entry point is important: a customer using a tablet in-store should be able to generate a show in minutes without signing up for anything.

## Phased Roadmap

### Phase 1 - MVP

The minimum viable product proves the core loop: song in, choreographed show out, grounded in real products.

- Template catalogue database of fireworks with technical specifications (effect type, duration, colour, height, cost).

- Music analysis pipeline that timestamps a song's structure (energy, beats, sections).

- LLM choreography agent that takes user inputs, music analysis, and the product catalogue to generate a show plan.

- Export to **Finale 3D Generic CSV** format for simulation and validation.

- **PDF show guide** with a timestamped firing order and product list.

- Shopping list output linked to the retailer's catalogue.

- Basic web interface for inputting a song, setting preferences, and downloading outputs.

At this stage, simulation is handled externally - the user (or retailer) imports the CSV into Finale 3D to preview the show. The focus is on validating that the AI produces choreography that is musically coherent, practically executable, and commercially useful.

### Phase 2 - Embedded Simulation

Once the MVP is validated with the client and real users, the next priority is removing the dependency on Finale 3D by building an in-browser simulator.

- **2D or 3D fireworks simulator** embedded in the web app, synchronised to the music track.

- Real-time preview so users can see what their show will look like before purchasing.

- Iterative refinement loop: watch the simulation, tweak with natural-language prompts, regenerate, and preview again.

- Potential integration with mapping/terrain data (e.g. Google 3D Tiles) so users can preview shows against their actual location.

This phase transforms ShowCrafter from a planning tool into an experience - users can "watch" their show before it happens, which dramatically increases confidence in purchasing.

### Phase 3 - Platform and Scale

With the core product proven, the platform expands in capability and reach.

- **Multi-retailer support** - onboard additional retailers and their inventories, with location-based routing.

- **Firing system script generation** - direct export to electronic firing system formats, reducing the gap between plan and execution.

- **Show sharing and community** - users can share show plans, browse public choreographies, and remix others' designs.

- **Advanced personalisation** - support for multiple songs/medleys, custom show segments, audience-facing programmes.

- **Analytics for retailers and manufacturers** - data on which products are most frequently selected by the AI, demand patterns by region and season, and insights into consumer preferences.

## Technical Considerations

The technology stack is not yet finalised, but the following decisions and trade-offs are under consideration:

- **Frontend**: A responsive web application (desktop and mobile). Framework TBD - likely a modern JS framework (React/Next.js or similar).

- **Backend/Infrastructure**: Evaluating Firebase, Supabase, or a more traditional backend (e.g. Laravel). The choice depends on team familiarity, real-time requirements, and how tightly coupled the database and auth layers need to be.

- **Music Analysis**: Python-based pipeline using librosa for audio feature extraction. This may run server-side as a background job triggered on song upload.

- **LLM Integration**: API-based integration with a large language model for choreography generation. Prompt engineering and structured output formatting (to produce valid Finale 3D CSV and show plans) are critical to reliability.

- **Product Catalogue**: A structured database of fireworks products and their specifications, maintained per retailer. Needs to support search, filtering, and stock-level awareness.

## Competitive Landscape

Several adjacent tools and companies exist, but none occupy ShowCrafter's specific niche:

- **Finale 3D** - industry-standard professional choreography and simulation software. Powerful but designed for trained pyrotechnicians, not consumers.

- **GLOW Fireworks / Pyro City / IGNITE** - retail fireworks brands with online stores, but no choreography or show-planning tools.

- **Hammer & Anvil** - fireworks retailer/brand with some digital presence, but no AI-driven planning.

ShowCrafter is not competing with Finale 3D - it uses Finale 3D as an export target in the MVP. The long-term vision is to offer a consumer-grade experience that complements (and eventually reduces dependency on) professional tools.

## Key Stakeholder

**Robert Foti** - fireworks manufacturer and distributor. Robert's family company services major events including the Sydney New Year's Eve fireworks. Robert is ShowCrafter's primary client and will handle retailer relationships and go-to-market. The product is being built to his specifications and validated against his industry expertise.

