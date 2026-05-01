# ShowCrafter Design System

This folder is the team-facing pointer to the ShowCrafter design system. The full
spec lives in two agent-readable files (so Claude / Cursor pick it up automatically
when anyone on the team is editing UI):

- **Full spec:** [`.claude/skills/showcrafter-design-system/SKILL.md`](../../.claude/skills/showcrafter-design-system/SKILL.md)
- **Cursor cheatsheet (always-on rule):** [`.cursor/rules/showcrafter-design-system.mdc`](../../.cursor/rules/showcrafter-design-system.mdc)
- **Live tokens:** [`app/globals.css`](../../app/globals.css)

## TL;DR

ShowCrafter defaults to a dark navy/black cinematic AI-tool interface with neon
cyan, electric blue, violet, and magenta accents. Yellow is reserved for finale
or "wow moment" states. Light mode is fully tokenised and uses cool blue/violet
accents rather than warm parchment surfaces. Geist Sans is the primary UI font;
Geist Mono is used for timings, product codes, quantities, prices, and metadata.
Lucide icons only. Pill CTAs (`rounded-full`); cards `rounded-xl` or
`rounded-2xl`; visible focus rings; tabular numerals on every number.

## How to use this on the team

- **Claude Code / Cursor agents** — both `SKILL.md` and the `.mdc` rule are loaded
  automatically when you edit `app/**`, `*.tsx`, or `*.css`. You don't need to do
  anything; the agent will read them and follow them.
- **Humans designing in Figma** — copy the hex values out of `app/globals.css` (the
  `@theme` block); names match Tailwind class names exactly (`primary` →
  `bg-primary`, `on-surface-variant` → `text-on-surface-variant`, etc.).
- **PR reviews** — the bottom of `SKILL.md` has a Do / Don't list and an iteration
  guide that's a good rubric for "does this look like ShowCrafter?".

## Updating the system

Tokens are sourced from `app/globals.css`. If you change a value there:

1. Update the matching row(s) in the **Color Palette & Roles** table in `SKILL.md`.
2. If the change is structural (new token, removed token, new component pattern),
   add a short note to the cheatsheet in
   `.cursor/rules/showcrafter-design-system.mdc`.
3. Open a PR labelled `design-system` so reviewers know to load both files.
