---
notion-url: https://www.notion.so/High-Level-Summary-325cd8a5bf0880738e5cc19c96418cfc
title: High Level Summary
date: '2026-03-16 01:56:00.000'
from_notion: https://www.notion.so/High-Level-Summary-325cd8a5bf0880738e5cc19c96418cfc
author: From Notion
last_edited_time: '2026-03-16 04:47:00.000'
---
<br/>

## What is the product

A tool, provided by retailers for consumers, that allows consumers to create and personalise their own AI-generated pyromusical using products sold at the store.

## How will it work

- A website the user can access (either on desktop or mobile).

- They can set custom input fields.

	- Overall budget

	- Location (maybe integrate 3d tiles for real viewing).

	- Time of fireworks display (feature, light vs dark)

	- Types of fireworks (prompt to llm (api), i.e., very big, or pretty, etc).

	- Duration of fireworks

	- Song(s) they want to choreograph with the fireworks

		- We will need to timestamp the songs and classify different sections of the songs for the llm to interpret and choreograph accordingly

	- A custom prompt to alter the new (or existing) choreography.

		- “Make the end of the show really big and powerful”

		- “I want a slower build at the beginning”

		- “I want it red and blue for 4th of july and very american”

<br/>

## MVP steps

- Template catalog database of fireworks and their technical specifications.

- LLM that analyses inputted song, timestamping ‘highs’ and ‘lows’

- AI agent that based on user data, LLM output and firework catalog generates a Finale3D script.

- View the simulation (manually) in Finale3D, which can then output a ‘firing system script’ for the user.

	- Final Product hopefully uses GlowFireworks / bespoke simulator and automatically creates firing system script

- List the product used in the show, for the consumer to purchase at the retailer.

- 

