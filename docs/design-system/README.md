# ShowCrafter Design System

This folder is the team-facing pointer to the ShowCrafter design system. The full
spec lives in an agent-readable skill file so automated assistants pick it up when
anyone on the team is editing UI:

- **Full spec:** [`.claude/skills/showcrafter-design-system/SKILL.md`](../../.claude/skills/showcrafter-design-system/SKILL.md)
- **Live tokens:** [`platform/app/globals.css`](../../platform/app/globals.css)

## TL;DR

ShowCrafter defaults to a dark navy/black cinematic AI-tool interface with neon
cyan, electric blue, violet, and magenta accents. Yellow is reserved for finale
or "wow moment" states. Light mode is fully tokenised and uses cool blue/violet
accents rather than warm parchment surfaces. Geist Sans is the primary UI font;
Geist Mono is used for timings, product codes, quantities, prices, and metadata.
Lucide icons only. Pill CTAs (`rounded-full`); cards `rounded-xl` or
`rounded-2xl`; visible focus rings; tabular numerals on every number.

## How to use this on the team

- **Agents** — load `SKILL.md` when you edit `app/**`, `*.tsx`, or `*.css`. You
  don't need to do anything special if your tooling already reads `.claude/skills/`.
- **Humans designing in Figma** — copy the hex values out of `platform/app/globals.css` (the
  `@theme` block); names match Tailwind class names exactly (`primary` →
  `bg-primary`, `on-surface-variant` → `text-on-surface-variant`, etc.).
- **PR reviews** — the bottom of `SKILL.md` has a Do / Don't list and an iteration
  guide that's a good rubric for "does this look like ShowCrafter?".

## Updating the system

Tokens are sourced from `platform/app/globals.css`. If you change a value there:

1. Update the matching row(s) in the **Color Palette & Roles** table in `SKILL.md`.
2. If the change is structural (new token, removed token, new component pattern),
   update the cheatsheet-style summary at the top of `SKILL.md` if needed.
3. Open a PR labelled `design-system` so reviewers know to load the skill file.
