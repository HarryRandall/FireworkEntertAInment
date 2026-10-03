# Development

Use Node 24 and the pinned pnpm version from the repository root:

```bash
eval "$(fnm env)" && fnm use 24
corepack enable
pnpm install --frozen-lockfile
```

## Local services

Supabase is local-only until switch-over. Start a clean local environment with:

```bash
pnpm db:setup
pnpm db:test
pnpm dev
```

Keep secrets in ignored local environment files. Do not link a hosted project or
apply a schema change outside the eventual switch-over runbook.

Modal workers are introduced in later rebuild stages. Configure and deploy them only
when their stage defines the worker contract. A web check does not deploy a worker,
change hosted Supabase or verify production.

## Checks

Run focused behaviour or SQL tests while changing code, then run:

```bash
pnpm check
```

From the database foundations stage onwards, also run `pnpm db:reset && pnpm db:test`
against local Supabase. For UI work, inspect the requested desktop and narrow layouts
in light and dark themes and attach the screenshots to the PR.

## Renderer review

`http://localhost:3000/dev/fireworks` needs no local Supabase. It shows all built-in
templates and three simulation fixtures as static previews produced by one WebGL
context. Selecting a card plays it in that same context. The comparison link opens
`http://localhost:8765/fireworks.html` in a separate tab so the owner can arrange the
two pages alongside each other. The prototype must already be served from the
read-only reference checkout.

The view uses three.js 0.184.0 and a single output target and pass. Add `?ldr` to the
review URL to exercise its 8-bit fallback. The fixed review camera fits sampled
particle bounds; interactive camera controls and sound are separate concerns.

Install the test browser once with `pnpm exec playwright install chromium`.
`pnpm test:browser` runs Chromium journeys, accessibility checks, exact seek replay
and representative template screenshots at desktop and 390 px widths in both
colour schemes. It is included in `pnpm check`. Screenshots stay in ignored
`output/playwright/`; they are review evidence, not approved visual baselines.
Software GL measurements do not establish performance on a real device. The owner
must review visual parity against the prototype before delivery is called verified.

## Agent tooling

Project skills are maintained once under `.agents/skills`. Claude uses relative links
from `.claude/skills`; the composer creates and verifies those links because agent
configuration is protected from workspace edits.

The project `.mcp.json` pins the Playwright MCP used for local visual reviews. It runs
an isolated Chromium profile, accepts only the local app and prototype origins, and
writes temporary output outside the repository. These settings reduce accidental
cross-project access but are not a security boundary. Use synthetic local data and
keep production sessions out of the profile.

Read documentation shipped with installed packages first. Use matching official docs
when installed docs are absent, and Context7 only for an unresolved version-specific
library question. Never send credentials, personal data or private source in a
documentation query.

| Tool           | Pinned source            | Licence    | Purpose                                    |
| -------------- | ------------------------ | ---------- | ------------------------------------------ |
| Playwright MCP | `@playwright/mcp@0.0.83` | Apache-2.0 | Local screenshots and browser interactions |

## Readability lint

Each handwritten TypeScript workspace composes the shared policy in
`scripts/eslint/readability.mjs`. The policy includes type-checked TypeScript rules,
TSDoc syntax, complexity and size limits, numeric-literal checks, selected SonarJS
checks and local rules for export documentation and lint exceptions.

Dated `eslint-suppressions-*.json` files record violations that existed when the gate
was introduced. Do not regenerate them during ordinary feature work. New violations
fail lint, and resolved entries should be pruned rather than retained.
