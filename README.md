# ShowCrafter

ShowCrafter is being rebuilt from the ground up. The live product remains on `main`;
the rebuild is developed on the `rebuild/main` stack and will switch over only after
the final rebuild PR and the owner's approval.

The rebuild serves four areas:

- shoppers discover a retailer's range through QR codes and plan a show;
- retailers manage their organisation, stores, range, stock and shows;
- suppliers submit products, price lists and video evidence for review;
- platform staff manage the catalogue, Studio, review and platform operations.

## Development

Use Node 24 and the pinned pnpm version:

```bash
eval "$(fnm env)" && fnm use 24
corepack enable
pnpm install --frozen-lockfile
pnpm db:setup
pnpm dev
```

Run `pnpm check` before delivery. The database is local Supabase during the rebuild.
See [Development](docs/development.md), [Architecture](docs/architecture.md) and
[Database](docs/database.md) for the working rules.

## Repository

```text
apps/web/                 Next.js application
packages/fireworks/       Renderer and design schema, added in the renderer stage
services/music-analyser/  Modal music-analysis worker
supabase/                 Declarative schema, generated baseline and SQL tests
docs/                     Rebuild documentation
```

The reference worktree contains the redesign prototype, decisions and build plan.
