# ShowCrafter Design System

This folder is the team-facing pointer to the ShowCrafter design system. The full
spec lives in an agent-readable skill file so automated assistants pick it up when
anyone on the team is editing UI:

- **Full spec:** [`.claude/skills/showcrafter-design-system/SKILL.md`](../../.claude/skills/showcrafter-design-system/SKILL.md)
- **Live tokens:** [`platform/app/globals.css`](../../platform/app/globals.css)
- **UI conventions:** [`platform/app/components/ui/styles.ts`](../../platform/app/components/ui/styles.ts)
- **Code-only tokens:** [`platform/app/components/ui/tokens.ts`](../../platform/app/components/ui/tokens.ts)

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

## Frontend Component Architecture

When building UI, follow this lookup order:

1. `platform/app/components/ui/` — base primitives, shared class maps, and token
   references.
2. `platform/app/components/{app,admin,marketing,theme}/` — domain components
   composed from UI primitives.
3. Route files under `platform/app/**` — page composition, data loading, and
   route-specific layout only.

Use `cn()` from `@/lib/cn` for class merging. Prefer imports from
`@/app/components/ui` for new code. Avoid hard-coded colours in TSX; use Tailwind
token classes such as `bg-surface`, `text-on-surface`, `border-outline-variant`,
`bg-primary-container`, and `text-on-primary-container`. If CSS tokens cannot be
used directly, such as in Three.js, SVG, or canvas code, use
`staticShowCrafterPalette` from `components/ui/tokens.ts`.

Form markup should use `Field`, `FieldLabel`, `FieldHint`, and `FieldError`.
Buttons use `Button` variants, cards use `Card`, loading states use `Skeleton`,
and empty states use `EmptyState` unless the shape is genuinely page-specific.
Lucide remains the only icon library for new UI.

## Updating the system

Tokens are sourced from `platform/app/globals.css`. If you change a value there:

1. Update the matching row(s) in the **Color Palette & Roles** table in `SKILL.md`.
2. If the change is structural (new token, removed token, new component pattern),
   update the cheatsheet-style summary at the top of `SKILL.md` if needed.
3. Open a PR labelled `design-system` so reviewers know to load the skill file.
