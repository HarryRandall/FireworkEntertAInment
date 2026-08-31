# ShowCrafter

Use British English, straight apostrophes and no em dashes. Keep changes focused
and preserve unrelated work in dirty checkouts.

## Project

ShowCrafter is a Next.js 16 application for designing consumer firework shows.
Supabase provides auth, Postgres, storage and RLS. Music analysis and firework
video imports are separate Python services under `services/` and deploy to
Modal.

Before changing Next.js APIs or conventions, read the relevant version-matched
documentation under `node_modules/next/dist/docs/`.

## Commands

```bash
npm ci
npm run dev
npm run check
npm run test:analyser
npm run test:worker
```

Use Node 24 from `.nvmrc`. Python services use Python 3.11 and their own
`requirements.txt` files.

## Structure

- `app/`: routes, layouts, API handlers and server actions.
- `components/`: shared UI grouped by product domain.
- `components/ui/`: lower-level Radix and shadcn primitives. Inspect headers
  before editing because only explicitly generated files are non-editable.
- `lib/`: domain, server, renderer and integration code.
- `services/`: independently deployed Python services.
- `supabase/`: migrations, templates, catalogue tooling and database tests.
- `tests/`: Node test suites for application and cross-service contracts.
- `docs/`: focused architecture and operational documentation.

## TypeScript and React

- Keep TypeScript strict. Avoid `any`, unchecked casts, non-null assertions and
  `@ts-ignore`; use `unknown`, narrowing, discriminated unions or Zod at external
  boundaries.
- Prefer cohesive functions with one responsibility. Extract a function when
  code mixes I/O, validation, state transitions or rendering concerns, not
  because it crosses an arbitrary line count.
- Split files when they have more than one reason to change. Keep tightly
  coupled types, helpers and tests together.
- Use early returns for invalid states. Parallelise independent I/O and avoid
  sequential request waterfalls.
- Keep side effects at system boundaries and make domain transformations pure
  where practical.
- Default to Server Components. Add `'use client'` only where browser state,
  effects or event handlers require it.
- Do not mirror props into state or use effects for values that can be derived
  during render. Prefer explicit variants or composition over collections of
  boolean props.
- Preserve keyboard access, visible focus, semantic controls and reduced-motion
  behaviour.

## Product and data invariants

- Music analysis may start after upload, but only the final Generate action may
  create a show and start cue generation.
- Treat database, authorisation, billing, ownership and cue-safety read errors
  as failures. Do not turn them into empty data or permissive defaults.
- Keep multi-write invariants in a transaction or guarded RPC. Never report a
  partially completed workflow as success.
- Every exposed Supabase table requires RLS and an intentional policy. Privileged
  functions need explicit caller checks, revoked public execution and narrow
  grants.
- Never expose service-role credentials or use user-editable metadata for
  authorisation.
- Keep Explore presets database-managed, draft-first, canonical and safe per
  launch position.
- Renderer and editor changes must keep schema, defaults, controls, persistence,
  timing and tests aligned.

## Working practice

- Inspect live files, migrations, routes and tests before making broad claims.
- Do not revert, tidy or overwrite unrelated local changes.
- Do not hand-edit generated files. Regenerate database types after schema
  changes.
- Comments should explain rationale, invariants, security boundaries,
  asynchronous lifecycles or non-obvious contracts. Do not narrate the code.
- Put enforceable style rules in ESLint, Prettier, TypeScript or tests rather
  than expanding this file.
- Run the narrowest useful checks while developing and `npm run check` before
  delivery. Run the relevant Python suite when a service or its contract moves.
