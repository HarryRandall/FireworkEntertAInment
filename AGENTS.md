# ShowCrafter

Use British English, straight apostrophes and no em dashes. Preserve unrelated
work. Follow the user's requested scope and keep commits focused.

## Start here

- Web application: `apps/web/`.
- Python services: `services/music-analyser/` and `services/firework-import-worker/`.
- Database migrations, seeds and SQL tests: `supabase/`.
- Ownership and UI conventions: [Architecture](docs/architecture.md).
- Setup, checks and deployment: [Development](docs/development.md).

Use Node 24 (`nvm use`) and the pinned pnpm version. From the repository root:
`pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm check`.

## Agent workflows

Read the matching skill before working in its area:

- Web code, UI or routes: [.agents/skills/showcrafter-web/SKILL.md](.agents/skills/showcrafter-web/SKILL.md).
- Analysis, rendering or app/worker contracts: [.agents/skills/showcrafter-contracts/SKILL.md](.agents/skills/showcrafter-contracts/SKILL.md).
- Database schema, queries or permissions: [.agents/skills/showcrafter-data/SKILL.md](.agents/skills/showcrafter-data/SKILL.md).

Inspect the implementation and its callers before changing it. Keep comments
for rationale, constraints and non-obvious behaviour. Remove stale instructions
when their underlying constraint changes; enforce mechanical rules in tooling.

Verify changed behaviour with the narrowest useful checks, then run `pnpm check`
for delivery. Run service suites when their code or contracts change. Report
checks that did not run and distinguish local checks from live verification.
