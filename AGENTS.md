# ShowCrafter

## Rebuild in progress

The app is being rebuilt as a stack of pull requests on `rebuild/main` (see the
repository skill). Nothing on `rebuild/main` may be merged to `main` before the
switch-over PR.

Use British English, straight apostrophes and no em dashes. Preserve unrelated
work. Follow the user's requested scope and keep commits focused.

## Start here

- Web application: `apps/web/`.
- Shared packages: `packages/` (renderer and planner).
- Python services: `services/music-analyser/` (and the video importer from stage 9).
- Declarative database schema, baseline, seeds and pgTAP tests: `supabase/`.
- Ownership and UI conventions: [Architecture](docs/architecture.md).
- Setup, checks and deployment: [Development](docs/development.md).
- Product overview and repository presentation: [README](README.md).

Use Node 24 (`fnm use` or `nvm use`) and the pinned pnpm version. From the repository root:
`pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm check`.

## Agent workflows

Read the matching skill before working in its area:

- Web code, UI or routes: [.agents/skills/showcrafter-web/SKILL.md](.agents/skills/showcrafter-web/SKILL.md).
- UI, shared shells and visual checks: [.agents/skills/showcrafter-ui/SKILL.md](.agents/skills/showcrafter-ui/SKILL.md).
- File structure, tooling and cleanup: [.agents/skills/showcrafter-repository/SKILL.md](.agents/skills/showcrafter-repository/SKILL.md).
- Analysis, rendering or app/worker contracts: [.agents/skills/showcrafter-contracts/SKILL.md](.agents/skills/showcrafter-contracts/SKILL.md).
- Database schema, queries or permissions: [.agents/skills/showcrafter-data/SKILL.md](.agents/skills/showcrafter-data/SKILL.md).

Inspect the implementation and its callers before changing it. Keep comments
for rationale, constraints and non-obvious behaviour. Remove stale instructions
when their underlying constraint changes; enforce mechanical rules in tooling.

Verify changed behaviour with the narrowest useful checks, then run `pnpm check`
for delivery. Run service suites when their code or contracts change. Report
checks that did not run and distinguish local checks from live verification.
