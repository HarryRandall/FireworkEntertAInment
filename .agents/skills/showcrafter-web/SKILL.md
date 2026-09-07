---
name: showcrafter-web
description: Implement or refactor ShowCrafter web routes, components and application code in apps/web. Use for web changes and repository moves affecting the Next.js application.
---

# ShowCrafter web

The app is `apps/web`. Commands from the repository root use
`pnpm --filter @showcrafter/web <script>`; `pnpm dev` and `pnpm check` are root
shortcuts. Read [architecture](../../../../docs/architecture.md) for ownership,
shared primitives, colours and page conventions.

Before changing Next.js conventions, read the relevant installed documentation
under `apps/web/node_modules/next/dist/docs/`. The app owns its configuration,
`.env.local`, public assets and tests. Keep route URLs independent of file moves.

Keep TypeScript strict. Use narrowing or Zod at external boundaries. Separate
I/O, validation and state transitions when they have different responsibilities;
keep pure transformations testable. Avoid duplicating props in state and effects
for values that can be derived during render.

Default to Server Components. Keep server integrations and service-role clients
out of client bundles. Preserve keyboard access, visible focus and reduced motion.
Use `ui/primitives` for Radix/shadcn controls, `ui/patterns` for reusable
compositions and `ui/<domain>` for features. Keep colour values in `ui/theme.css`.
Inspect existing controls and semantic tokens before adding a wrapper.
Do not hand-edit files explicitly marked as generated.

Music upload/analysis must not create a show: only the final Generate action does.
Database, authorisation, billing and ownership read failures must remain failures.
Keep multi-write invariants in guarded transactions/RPCs. My Store preview data
must remain visibly labelled.

Run focused behaviour tests while developing. Source guards can protect fragile
boundaries, but do not freeze incidental filenames, package-manager spelling or
comment wording. Update guards when an intentional contract changes and retain
coverage of the underlying behaviour. For shared UI changes, inspect relevant
light/dark, mobile, focus and disabled states in the rendered app.
