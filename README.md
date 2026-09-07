# ShowCrafter

Design consumer firework shows from a catalogue, build a timed sequence with
optional music analysis, and preview it in the browser. Retailers can manage
assortments and offer public QR entry for fixed-bundle shows.

The web app uses Next.js 16, React 19, TypeScript, Tailwind and Supabase. Python
services handle music analysis and firework video imports on Modal.

## Development

Use Node 24 and pnpm 12.3.4:

```bash
nvm use
corepack enable pnpm
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Fill the app's environment file with development credentials. Service setup,
verification and deployment instructions live in [Development](docs/development.md).

```bash
pnpm typecheck      # Focused TypeScript check
pnpm check          # Formatting, lint, types, application tests and build
pnpm audit:ui       # Page inventory and component import review
```

## Repository

```text
.agents/skills/     Project workflows for coding agents
apps/web/          Web code, assets, tests and Next.js configuration
services/          Independently deployed Python services
supabase/          Database migrations, seeds, templates and SQL tests
docs/              Architecture and development guidance
```

[Architecture](docs/architecture.md) explains file ownership, shared UI and the
colour scheme. My Store analytics and credit top-ups currently include labelled
preview data. [Security](SECURITY.md) describes private vulnerability reporting.
