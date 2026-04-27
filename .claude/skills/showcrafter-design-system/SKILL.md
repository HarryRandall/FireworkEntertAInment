---
name: showcrafter-design-system
description: REQUIRED for any UI work in the ShowCrafter Next.js app. Use when editing app/**, creating pages, components, or styling. Triggers: design, palette, hero, button, card, navbar, page, redesign, theme, tokens, Tailwind, ShowCrafter brand, fireworks UI, dark theme.
---

# ShowCrafter Design System

A field guide for everyone building the ShowCrafter web platform — the AI fireworks
choreography tool. Read this before touching any UI in `app/**`. The matching token
values live in [app/globals.css](../../../app/globals.css) and are exposed to Tailwind
v4 via `@theme`.

## 1. Visual Theme & Atmosphere

ShowCrafter feels like the night sky over a pyromusical show — quiet, dark, vast,
then suddenly punctuated by a warm gold ignition. The product is dark-first by design:
audiences plan fireworks at night, the live preview *is* a night sky, and a calm
near-black canvas (`#131313`) gives every spark of colour a reason to exist. The
interface alternates between deep "Night" (`#131313`) and a stepped surface ladder
(`#0e0e0e` → `#353534`) the way a long-exposure photograph alternates between
silhouette and burst.

Ember Gold (`#ffc174`) is the only brand accent. It marks every primary action,
every key heading word, every "this is the thing you should look at" surface. Where
gold says "act", Sky Pulse (`#8fd5ff`) says "this is live" — it appears exclusively on
playhead bars, live-preview progress, and "now playing" indicators. Everything else
is grey, near-black, or off-white. The result reads as confident, music-aware
fintech-for-fireworks: data-dense in places, cinematic in others, never
gimmicky.

**Key characteristics:**

- Dark-only UI — no light-mode variant. Surfaces step through a 6-tier ladder, never
  literal white.
- Ember Gold (`#ffc174`) as the singular brand accent driving CTAs, key headlines, and
  brand marks.
- Sky Pulse (`#8fd5ff`) reserved for live/playing state — never decorative.
- Inter at weight 500–800 across the interface; tabular numerals for show timings.
- Pill CTA buttons (`9999px` radius) stand out against the surface ladder; data and
  card surfaces stay at `12–16px` radius.
- Whisper-light shadows (≤10% opacity) — trust comes from clarity, not depth.
- Cinematic hero imagery (long-exposure fireworks against the night sky) and
  data-driven decoration (waveforms, timeline markers, playheads) — never
  illustrative cartoons.

## 2. Color Palette & Roles

All hex values match `app/globals.css`. Token names map 1:1 to Tailwind v4 classes
(e.g. `bg-primary`, `text-on-surface-variant`, `border-outline-variant`).

### Primary — Ember Gold

The brand. The fire.

| Token (Tailwind) | Hex | Use |
|---|---|---|
| `primary` | `#ffc174` | Brand accent text, key headline word, ghost button text, link colour |
| `primary-container` | `#f59e0b` | Solid CTA fills (the "Get Started" / "Generate" button background) |
| `primary-fixed` | `#ffddb8` | Lightest gold — caption emphasis on dark surfaces |
| `primary-fixed-dim` | `#ffb95f` | Slightly dimmer gold for hover-adjacent / sub-accent text |
| `on-primary` | `#472a00` | Text on `bg-primary` |
| `on-primary-container` | `#613b00` | Text on `bg-primary-container` (the dark cocoa on the gold pill) |

### Secondary — Soft Gold

Used sparingly. Mostly tag chips, secondary stats, and section eyebrows when Ember
Gold would be too loud.

| Token | Hex | Use |
|---|---|---|
| `secondary` | `#f0bd82` | Soft gold accent text |
| `secondary-container` | `#62400f` | Dark cocoa surface for secondary tags |
| `on-secondary-container` | `#ddac72` | Text on `bg-secondary-container` |

### Tertiary — Sky Pulse (live/accent only)

Reserved exclusively for "now playing", playheads, live-preview progress, and the
Sky Pulse beacon on the timeline. **Do not use Sky Pulse as a generic accent.** If
you reach for blue, it's almost certainly the wrong choice.

| Token | Hex | Use |
|---|---|---|
| `tertiary` | `#8fd5ff` | Playhead, "live" pulse, audio-progress fill |
| `tertiary-container` | `#1abdff` | High-energy live state (rare) |
| `tertiary-fixed` | `#c5e7ff` | Caption on top of `bg-tertiary-container` |
| `on-tertiary` | `#00344a` | Text on `bg-tertiary` |

### Surface Ladder

The product's "lighting" — every elevation step is a slightly brighter near-black.
Use the ladder, never custom mid-greys.

| Token | Hex | Tier | Use |
|---|---|---|---|
| `background` / `surface` / `surface-dim` | `#131313` | Night | Page canvas, hero, default app shell |
| `surface-container-lowest` | `#0e0e0e` | -1 | Footer, deepest sunken surface |
| `surface-container-low` | `#1c1b1b` | 1 | Section bands ("How It Works"), card surfaces on the canvas |
| `surface-container` | `#201f1f` | 2 | Mid-elevation cards, inputs container |
| `surface-container-high` | `#2a2a2a` | 3 | Elevated cards, modal surfaces, refinement panels |
| `surface-container-highest` / `surface-variant` | `#353534` | 4 | Input fills, top-of-stack chips |
| `surface-bright` | `#3a3939` | 5 | Highest available bright surface (rare) |

### Text & Outline

| Token | Hex | Use |
|---|---|---|
| `on-surface` / `on-background` | `#e5e2e1` | Primary body and heading text |
| `on-surface-variant` | `#d8c3ad` | Secondary text, descriptions, metadata |
| `outline` | `#a08e7a` | Standard borders, dividers |
| `outline-variant` | `#534434` | Subtle borders, hairline rules (most common) |

### Semantic

| Token | Hex | Use |
|---|---|---|
| `error` | `#ffb4ab` | Error text, form validation |
| `error-container` | `#93000a` | Error surface backgrounds |
| Success Green | `#0ECB81` | Status only — "complete" badges, positive deltas (**not** brand) |
| Danger Red | `#F6465D` | Status only — "failed" badges, destructive actions (**not** brand) |

### Gradient System

- **Hero Glow:** radial gradient — Ember Gold at 20% opacity, blurred 120px, behind
  hero headlines. Implementation: `bg-primary/20 rounded-full blur-[120px]`.
- **Surface Fade:** `bg-gradient-to-t from-surface to-transparent` — used over hero
  imagery to ground the artwork in the canvas.
- **Live-Preview Sky:** sky-to-night vertical gradient on canvas backdrops in the
  fireworks renderer (see [prototypes/site-mockup/show-results.html](../../../prototypes/site-mockup/show-results.html)).

## 3. Typography Rules

### Font Family

**Primary:** Inter (loaded via `next/font/google` in [app/layout.tsx](../../../app/layout.tsx))
exposed as both `--font-headline` and `--font-body`. Use the same family for headlines
and body — weight is what separates them.

- Fallbacks: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- Available weights: 400, 500, 600, 700, 800
- Tabular numerals via `font-feature-settings: "tnum"` for any timing or price column

### Hierarchy

| Role | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| Display | 60px / 72px | 800 | 1.05 | -0.02em | Hero headline (mobile drops to 48px) |
| Hero | 48px | 700 | 1.10 | -0.01em | Section banners on dark sections |
| H1 | 32px | 700 | 1.15 | -0.01em | Page titles ("Your Shows", "Craft Your Spectacle") |
| H2 | 24px | 600 | 1.20 | 0 | Card titles, subsection headings |
| H3 | 20px | 600 | 1.25 | 0 | Smaller card titles |
| Body Large | 18px | 500 | 1.50 | 0 | Hero subtitles, lead paragraphs |
| Body | 16px | 500 | 1.50 | 0 | Standard body text |
| Body Bold | 16px | 600 | 1.50 | 0 | Strong emphasis, nav links |
| Button | 14px | 700 | 1.25 | 0 | Pill CTA labels |
| Caption | 14px | 500 | 1.43 | 0 | Metadata, table labels |
| Caption SemiBold | 14px | 600 | 1.50 | 0.02em | Stat labels, "Total Estimated Cost" |
| Eyebrow | 12px | 700 | 1.00 | 0.20em | UPPERCASE tracked labels ("STEP 01 / 03", "LIVE PREVIEW") |
| Tiny | 10px | 700 | 1.00 | 0.15em | Stat unit labels, micro chips |

### Principles

Inter at weight 500+ across the board — anything lighter undermines the authority
this product needs (a fireworks designer is buying real explosives based on what we
show them). Headlines compress hard (1.05–1.20 line height) for that stacked,
cinematic feel; body text breathes at 1.50 for comfortable scanning of show guides
and shopping lists. Eyebrows always uppercase, always heavily tracked. Numbers (cost,
duration, BPM, stat tiles) **must** use tabular numerals — vertical alignment is a
trust signal in a financial / planning context.

## 4. Component Stylings

### Buttons

**Primary (Solid Pill, the brand action)**

Used for the single most important action on a page — "Generate My Show", "Sign In",
"Create a Show".

- Background: `primary-container` (`#f59e0b`)
- Text: `on-primary-container` (`#613b00`), 14–16px, weight 700
- Border: none
- Radius: `9999px` (pill)
- Padding: `10px 32px` (sm), `12px 40px` (md), `16px 48px` (lg)
- Shadow: `0 8px 24px -8px rgba(245, 158, 11, 0.4)`
- Hover: `brightness(1.10)`
- Active: `scale(0.98)`
- Transition: `all 200ms ease`

**Secondary (Ghost Pill)**

For "See how it works", "Refine", "Continue as Guest".

- Background: transparent
- Text: `primary` (`#ffc174`), 14–16px, weight 600
- Border: `1px solid var(--color-outline)/20`
- Radius: `9999px`
- Hover: `bg-surface-container-highest/50`
- Transition: `all 200ms ease`

**Tertiary (Plain Link)**

- Text: `on-surface-variant`, hover `primary`, weight 500
- No background, no border

**Disabled**

- Background: `surface-container-high`
- Text: `on-surface-variant/40`
- `cursor-not-allowed`, no hover

### Cards

- Background: `surface-container-low` (resting) or `surface-container-high` (elevated)
- Border: `1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent)`
- Radius: `12px` (data card), `16px` (content card), `24px` (hero / video container)
- Padding: 24px (sm), 32px (md), 48px (lg)
- Shadow: `0 3px 5px rgba(0, 0, 0, 0.05)` (resting), `0 8px 20px rgba(0, 0, 0, 0.10)`
  (hovered)
- Hover: outline shifts to `outline-variant/20` and shadow lifts; **no Y-translate**

### Inputs

- Background: `surface-container-highest` (`#353534`)
- Text: `on-surface`, placeholder `on-surface-variant`
- Border: none — focus state uses a `ring-2 ring-primary/20` instead
- Radius: `8px` (compact), `12px` (text area)
- Padding: `0 16px`, height `44px` (meets WCAG AAA touch target)
- Focus: `ring-2 ring-primary/20` (no border colour change)
- Transition: `all 200ms ease`

### Navigation

- Background: `surface` (`#131313`), sticky `top-0`, `z-50`
- Height: 64px
- Left: ShowCrafter wordmark in `text-primary`, weight 600, tracking-tighter
- Centre: nav links — `on-surface-variant`, weight 500, hover `primary`. Active link
  has a 2px `border-primary-container` underline with `pb-1`.
- Right: Pill CTA + secondary text link
- Mobile: hamburger menu (Lucide `Menu` icon) below 768px

### App Shell (authenticated pages)

- Top bar (64px) — same nav pattern, with Dashboard / New Show / Logout instead of
  marketing links
- Content max-width: `1200px` (1400px for the show editor where a wider canvas helps)
- Top padding: `pt-24` to clear the sticky nav plus eyebrow space
- Bottom padding: `pb-20` (or `pb-32` when the persistent audio player is rendered)

### Footer

- Background: `surface-container-lowest` (`#0e0e0e`)
- Top border: `1px solid outline-variant/15`
- Padding: `py-8 px-6`
- Copy: 12px uppercase tracked, `on-surface-variant/60`

### Data Tables (shopping list, db-test)

- Container: `surface-container-low/30` with `1px outline-variant/15` border, `12px`
  radius
- Header row: `surface-container/40`, `on-surface-variant`, 14px/500
- Body rows: `border-b outline-variant/10`, hover `surface-container-high/20`
- Cell padding: `px-3 py-2`, `align-top`
- Numeric columns right-aligned with tabular numerals

### Image Treatment

- Hero / live-preview imagery: rounded `xl` (12px) inside a `surface-container-low`
  frame with `1px outline-variant/15`
- Long-exposure firework photography is the preferred hero motif (gold/sky/red
  bursts against night sky)
- **No** decorative illustrations, no cartoon fireworks, no stock business
  photography

### Icons

- **Lucide** (`lucide-react`) at 16/20/24px, `strokeWidth=1.75`
- Material Symbols are **deprecated** — remove the `<link>` and rewrite any
  `<span class="material-symbols-outlined">…</span>` to `<Lucide.Icon … />`
- Common Lucide swaps:

  | Material Symbol | Lucide |
  |---|---|
  | `music_note` | `Music` |
  | `tune` | `SlidersHorizontal` |
  | `auto_awesome` | `Sparkles` |
  | `cloud_upload` | `UploadCloud` |
  | `play_arrow` | `Play` |
  | `pause` | `Pause` |
  | `add_circle` | `PlusCircle` |
  | `inventory_2` | `Package` |
  | `location_on` | `MapPin` |
  | `payments` | `Wallet` |
  | `timer` | `Timer` |
  | `expand_more` | `ChevronDown` |
  | `auto_fix_high` | `Wand2` |
  | `refresh` | `RefreshCw` |

### Trust Indicators

- **Stat tiles** (Total Effects, Sync Precision, Safety Clearance) — the ShowCrafter
  equivalent of a price ticker. Compact `surface-container-highest` cards with a
  10px eyebrow and a 20px tabular number.
- **Version history** rows in the refine panel — small text + "Just now"
  metadata.
- **Estimated compute time** ("ESTIMATED COMPUTE TIME: 45 SECONDS") under the
  generate button — 12px eyebrow tracking that reassures the user the AI is doing
  real work.

## 5. Layout Principles

### Spacing System

Base unit: 4px (Tailwind default; spacing scale is `gap-1` = 4px, `gap-2` = 8px, …).

| Token | px | Use |
|---|---|---|
| `space-1` | 4 | Icon / label inline gap |
| `space-2` | 8 | Tight margin, button icon gap |
| `space-3` | 12 | Card internal padding (compact) |
| `space-4` | 16 | Standard padding, card gap |
| `space-6` | 24 | Card gutter, section internal padding |
| `space-8` | 32 | Section break |
| `space-12` | 48 | Major section padding |
| `space-16` | 64 | Hero padding |
| `space-24` | 96 | Hero `py` and large feature break |
| `space-32` | 128 | Marketing-section vertical breath |

### Grid & Container

- Max content width: `1200px` (`max-w-[1200px] mx-auto`)
- Show editor max width: `1400px` (more pixels for the timeline canvas)
- Horizontal padding: `px-6` mobile, `px-12` desktop
- Marketing feature grid: 1-col mobile, 2-col tablet (`md:grid-cols-2`), 3-col
  desktop (`lg:grid-cols-3`), gap-6
- Dashboard bento grid: same 1 / 2 / 3 cadence
- Show editor: 12-col grid, content lives in `lg:col-span-8`, refine panel in
  `lg:col-span-4`

### Whitespace Philosophy

ShowCrafter pages alternate between *spacious* (marketing sections, hero) and
*dense* (timeline editor, shopping list, show guide). Spacious sections use
`py-24`+ vertical padding, dense sections drop to `py-8` and let cards do the
breathing. The contrast itself communicates that the product can do both — invite
you in (landing) and put you in command (editor).

### Border Radius Scale

| px | Tailwind | Use |
|---|---|---|
| 4 | `rounded` | Hairline UI elements (rare) |
| 8 | `rounded-md` | Inputs, data cards, image containers |
| 12 | `rounded-xl` | Content cards, feature tiles |
| 16 | `rounded-2xl` | Marketing feature cards, modal surfaces |
| 24 | `rounded-3xl` | Hero CTA bands, video containers |
| 9999 | `rounded-full` | Pill CTAs, chip tags, avatar/icon wells |

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, surface-ladder difference only | Default for inline elements |
| Subtle | `0 3px 5px rgba(0,0,0,0.05)` | Resting cards |
| Medium | `0 8px 20px rgba(0,0,0,0.10)` | Hovered cards, elevated containers |
| CTA Glow | `0 8px 24px -8px rgba(245,158,11,0.40)` | Primary pill buttons |
| Hero Glow | `radial-gradient` Ember Gold @ 20%, `blur-[120px]` | Behind hero headlines |
| Heavy | `0 32px 60px rgba(0,0,0,0.40)` | Modal overlays, dropdown menus |

ShowCrafter shadows are whisper-light because the surface ladder already gives us
elevation for free — `surface-container-low` next to `surface-container-high`
already reads as "this card is raised" without needing a heavy shadow on top. The
exception is the primary pill CTA, which keeps a slightly visible warm glow because
ignition needs to feel like ignition.

## 7. Do's and Don'ts

### Do

- Use Ember Gold (`#ffc174`) **only** for primary CTAs, the brand wordmark, key
  highlighted words, and active-state borders. One accent.
- Use Sky Pulse (`#8fd5ff`) **only** for "live/playing" state — playheads, audio
  progress, the live-preview beacon.
- Step through the surface ladder for elevation rather than guessing greys.
- Apply `9999px` radius to all primary CTAs — pills are the signature shape.
- Keep content cards at `12–16px` radius.
- Use Inter at 500+ for everything; bump to 700–800 for headlines.
- Show real numbers prominently — total cost, duration, sync precision, BPM.
- Use Lucide icons, `strokeWidth=1.75`, sized in the 16/20/24 grid.
- Keep shadows ≤10% opacity except the primary CTA glow.
- Use tabular numerals for any timing, price, or count.

### Don't

- Don't introduce new brand colours. We have Ember Gold, Soft Gold, and Sky Pulse —
  that's it.
- Don't use Sky Pulse as a generic accent or hover state. If it's not "live", it's
  not Sky Pulse.
- Don't use literal `#FFFFFF`. Even our brightest text is `#e5e2e1`.
- Don't use Material Symbols. Lucide only.
- Don't add cartoon illustrations or stock photography. Imagery is product
  screenshots, long-exposure fireworks, or data viz.
- Don't add motion beyond `200ms ease` transitions, `active:scale-[0.98]` press
  feedback, and `hover:brightness-110`. We are not a marketing site for a wellness
  app.
- Don't hover-translate cards (no `-translate-y-1`). It feels frivolous next to the
  product's stillness.
- Don't put gold text on gold backgrounds. Always pair `primary-container`
  background with `on-primary-container` text.
- Don't mix pill (`9999px`) and square (`8px`) buttons in the same row.
- Don't use mid-grey hex codes that aren't on the surface ladder.

## 8. Responsive Behaviour

### Breakpoints (Tailwind v4 defaults)

| Name | Width | Key changes |
|---|---|---|
| Mobile | `<640px` | Single column, hamburger nav, `px-6`, hero text drops to 40–48px |
| `sm` | ≥640px | Hero side-by-side begins, 2-col feature grid |
| `md` | ≥768px | Full nav links, dashboard 2-col bento |
| `lg` | ≥1024px | 3-col feature grid, show editor 12-col split, `px-12` |
| `xl` | ≥1280px | Max-width container kicks in |
| `2xl` | ≥1536px | Increased side margins, container stays at 1200/1400 |

### Touch Targets

- Minimum: 44×44px (WCAG AAA).
- Pill CTAs: 48px height minimum.
- Nav links: 44px touch area.
- Mood-tag chips and timeline markers: 36px minimum.
- Tab bar buttons: 44px tall, `pb-4` underline state.

### Collapsing Strategy

- **Nav:** full links → hamburger below `md`. Logo + primary CTA always visible.
- **Hero:** side-by-side text + image → stacked at `md`. Hero glow scales with
  viewport.
- **Marketing feature grid:** 3 → 2 → 1 columns.
- **Dashboard bento:** 3 → 2 → 1 columns.
- **Show editor:** 12-col split → stacked (timeline above refine panel) below `lg`.
- **Audio player bar:** stays fixed at the bottom on `lg+`; collapses into a
  compact "Now playing" pill on mobile.

## 9. Agent Prompt Guide

### Quick Color Reference (Tailwind classes, copy-pasteable)

| Need | Class |
|---|---|
| Primary CTA bg | `bg-primary-container text-on-primary-container` |
| Primary CTA hover | `hover:brightness-110 active:scale-[0.98]` |
| Brand text accent | `text-primary` |
| Background canvas | `bg-background` (= `bg-surface`, = `bg-surface-dim`) |
| Section band | `bg-surface-container-low` |
| Card | `bg-surface-container-low border border-outline-variant/10 rounded-xl` |
| Elevated card | `bg-surface-container-high border border-outline-variant/10 rounded-2xl` |
| Heading text | `text-on-surface` |
| Body text | `text-on-surface-variant` |
| Hairline border | `border-outline-variant/15` |
| Live / playhead | `bg-tertiary text-on-tertiary` |
| Eyebrow | `text-xs uppercase tracking-widest font-bold text-on-surface-variant` |
| Pill button | `rounded-full px-8 py-3 font-bold` |

### Example Component Prompts

- "Build a hero section: dark `bg-background` canvas, an Ember Gold radial glow
  (`bg-primary/20 blur-[120px]`) behind a 60/800 headline in `text-on-surface` with
  one Ember Gold word, an 18/500 `text-on-surface-variant` subtitle, then a primary
  pill CTA (`bg-primary-container text-on-primary-container rounded-full px-10
  py-4 font-bold`) and a ghost pill secondary."
- "Make a stat tile strip with three `surface-container-highest` cards (`rounded-lg
  border border-outline-variant/5`), each containing a 10px uppercase
  `on-surface-variant` eyebrow and a 20px tabular bold number. Used for Total
  Effects / Sync Precision / Safety Clearance."
- "Design a feature card grid (3-col, gap-6) of `bg-surface-container-low`
  cards (`rounded-xl border border-outline-variant/15`) with a 48px Ember-Gold-on-
  primary/10 icon well, a 20/600 heading, and a 16/500 `on-surface-variant`
  description."
- "Sticky nav: `bg-surface` 64px tall, ShowCrafter wordmark in `text-primary` left,
  centre nav links 14/500 `text-on-surface-variant` (active link has 2px
  `border-primary-container` underline), right side has a primary pill CTA labelled
  'Get Started'."
- "Show editor timeline panel: `lg:col-span-8 bg-surface-container-low rounded-xl
  p-8`, with a faint `bg-gradient-to-b from-transparent to-black/20` overlay, a row
  of 10px uppercase tracked time labels, a 256px-tall waveform area centred on a
  single 2px Sky-Pulse playhead with a `shadow-[0_0_15px_rgba(143,213,255,0.6)]`,
  and a row of three stat tiles below."

### Iteration Guide

When refining a screen built with this system:

1. Refine one component at a time.
2. Reference token names ("Ember Gold", "Sky Pulse", `surface-container-high`)
   instead of inventing new hex values.
3. Remember: Ember Gold is the only brand accent; Sky Pulse is **only** for live
   state; everything else is grey/dark/off-white.
4. Use the surface ladder for elevation before adding shadow.
5. Numbers are first-class — wrap them in tabular numerals and give them their own
   tile if they're load-bearing for the user's decision.
6. Pills (`rounded-full`) for hero CTAs; rounded-xl/2xl for cards; rounded-md for
   inputs.
7. If you reach for a third colour or a heavier shadow, stop and re-read this
   document.

## 10. Reference Implementation

Live tokens: [app/globals.css](../../../app/globals.css)
Visual reference (HTML, soon to be retired): [prototypes/site-mockup/](../../../prototypes/site-mockup/)
Cursor pointer: [.cursor/rules/showcrafter-design-system.mdc](../../../.cursor/rules/showcrafter-design-system.mdc)
Team-facing index: [docs/design-system/README.md](../../../docs/design-system/README.md)
