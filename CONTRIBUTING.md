# Contributing

## Set up the repository

Follow the [README quick start](README.md#local-development) for Node 24, npm 11
and environment setup. `.env.example` documents the supported integrations.

The Python services use Python 3.11 and separate virtual environments:

```bash
python3.11 -m venv services/music-analyser/.venv
services/music-analyser/.venv/bin/python -m pip install -r services/music-analyser/requirements.txt

python3.11 -m venv services/firework-import-worker/.venv
services/firework-import-worker/.venv/bin/python -m pip install -r services/firework-import-worker/requirements.txt
```

## Make a change

- Start from the latest `main`.
- Use a typed branch such as `feat/fir-123-description`,
  `fix/fir-123-description` or `refactor/fir-123-description`.
- Keep the change focused and preserve unrelated work.
- Use Conventional Commit wording for commits and pull request titles.
- Link the pull request to its Linear issue.

## Code conventions

- Keep TypeScript strict and validate external input at the boundary.
- Prefer cohesive functions and modules over arbitrary file-size limits.
- Extract code when responsibilities, lifecycle or test boundaries differ.
- Keep server-only code out of client bundles.
- Use the existing component, icon, type and design-token systems.
- Add comments only for non-obvious rationale or contracts.
- Add or update tests for behavioural changes.

[Architecture](docs/architecture.md) owns component placement, shared primitives,
colour tokens and page conventions. [AGENTS.md](AGENTS.md) summarises the rules
for agents. The README owns quick start and project orientation; service-specific
instructions stay beside their service. Update the existing source of truth
instead of adding another overlapping guide.

## Database changes

- Create migrations through the Supabase CLI rather than inventing filenames.
- Enable RLS and add intentional policies for every exposed table.
- Restrict privileged RPCs to the narrowest roles and test their access path.
- Regenerate `lib/database.types.ts` after schema changes.
- Review the migration and run the relevant database tests before opening a
  pull request.

## Verify

Run `npm run audit:ui` when adding pages or moving components. Its candidates
need review before deletion. ESLint checks route ownership and shared UI colour
conventions as part of the web application gate:

```bash
npm run check
```

Run service tests when their code or contracts change:

```bash
npm run test:analyser
npm run test:worker
```

Pull requests should explain the user-visible result, important implementation
decisions, verification performed and any deployment or migration steps.
