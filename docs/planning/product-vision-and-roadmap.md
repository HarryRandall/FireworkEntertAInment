---
notion-url: https://www.notion.so/Product-Vision-Roadmap-325cd8a5bf0880f3b8ead17a7e10029d
title: Product Vision + Roadmap
date: '2026-03-16 02:24:00.000'
from_notion: https://www.notion.so/Product-Vision-Roadmap-325cd8a5bf0880f3b8ead17a7e10029d
author: From Notion
last_edited_time: '2026-03-30 05:10:00.000'
---
# Overview

## The Problem

## The Solution

1. **Choose a song** (or describe the show you want in plain language).

1. **Set your parameters** - budget, location, display duration, time of day, and any stylistic preferences ("big and patriotic", "romantic and slow-building", etc.).

1. **ShowCrafter generates a choreographed show plan**, selecting real products from the retailer's inventory, timed to the music's structure (drops, builds, crescendos, quiet sections).

1. **Review and refine** - users can adjust the plan with natural-language prompts ("make the finale bigger", "swap out the blue effects for gold").

1. **Get your outputs** - a shopping list of products to purchase, a PDF show guide with firing instructions, and (in later phases) an interactive simulation of the show.

## Target Users

## How It Works (Technical Summary)

- A **shopping list** of products used in the show, with quantities and estimated cost.

- A **show guide (PDF)** with timestamped firing instructions the user can follow along to.

- A **Finale 3D-compatible CSV file** that can be imported into Finale 3D for professional-grade simulation and, if needed, integration with electronic firing systems.

- (Future) An **in-browser simulation** showing a real-time 2D or 3D preview of the show synchronised to the music.

## User Accounts and Persistence

## Phased Roadmap

### Phase 1 - MVP

- Template catalogue database of fireworks with technical specifications (effect type, duration, colour, height, cost).

- Music analysis pipeline that timestamps a song's structure (energy, beats, sections).

- LLM choreography agent that takes user inputs, music analysis, and the product catalogue to generate a show plan.

- Export to **Finale 3D Generic CSV** format for simulation and validation.

- **PDF show guide** with a timestamped firing order and product list.

- Shopping list output linked to the retailer's catalogue.

- Basic web interface for inputting a song, setting preferences, and downloading outputs.

### Phase 2 - Embedded Simulation

- **2D or 3D fireworks simulator** embedded in the web app, synchronised to the music track.

- Real-time preview so users can see what their show will look like before purchasing.

- Iterative refinement loop: watch the simulation, tweak with natural-language prompts, regenerate, and preview again.

- Potential integration with mapping/terrain data (e.g. Google 3D Tiles) so users can preview shows against their actual location.

### Phase 3 - Platform and Scale

- **Multi-retailer support** - onboard additional retailers and their inventories, with location-based routing.

- **Firing system script generation** - direct export to electronic firing system formats, reducing the gap between plan and execution.

- **Show sharing and community** - users can share show plans, browse public choreographies, and remix others' designs.

- **Advanced personalisation** - support for multiple songs/medleys, custom show segments, audience-facing programmes.

- **Analytics for retailers and manufacturers** - data on which products are most frequently selected by the AI, demand patterns by region and season, and insights into consumer preferences.

## Technical Considerations

- **Frontend**: A responsive web application (desktop and mobile). Framework TBD - likely a modern JS framework (React/Next.js or similar).

- **Backend/Infrastructure**: Evaluating Firebase, Supabase, or a more traditional backend (e.g. Laravel). The choice depends on team familiarity, real-time requirements, and how tightly coupled the database and auth layers need to be.

- **Music Analysis**: Python-based pipeline using librosa for audio feature extraction. This may run server-side as a background job triggered on song upload.

- **LLM Integration**: API-based integration with a large language model for choreography generation. Prompt engineering and structured output formatting (to produce valid Finale 3D CSV and show plans) are critical to reliability.

- **Product Catalogue**: A structured database of fireworks products and their specifications, maintained per retailer. Needs to support search, filtering, and stock-level awareness.

## Competitive Landscape

- **Finale 3D** - industry-standard professional choreography and simulation software. Powerful but designed for trained pyrotechnicians, not consumers.

- **GLOW Fireworks / Pyro City / IGNITE** - retail fireworks brands with online stores, but no choreography or show-planning tools.

- **Hammer & Anvil** - fireworks retailer/brand with some digital presence, but no AI-driven planning.

## Key Stakeholder

