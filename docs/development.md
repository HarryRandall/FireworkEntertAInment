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
