# Contributing

## Set up the repository

Use Node 24 and npm 11:

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with development credentials. Never commit secrets. The
variable descriptions and optional integrations live in `.env.example`.

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

Detailed agent guidance lives in [AGENTS.md](AGENTS.md). Keep the root README
brief and put service-specific setup beside the service it describes.

## Database changes

- Create migrations through the Supabase CLI rather than inventing filenames.
- Enable RLS and add intentional policies for every exposed table.
- Restrict privileged RPCs to the narrowest roles and test their access path.
- Regenerate `lib/database.types.ts` after schema changes.
- Review the migration and run the relevant database tests before opening a
  pull request.

## Verify

Run the web application gate:

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
