# Autoxi

Autoxi is a web-first asynchronous football/soccer squad-builder autobattler. The first implementation slice is deliberately small: build the monorepo foundation, player-card domain, Drizzle/PostgreSQL schema, card API, provisional menu, Collection page, material-style player cards, and basic observability ports.

The full game loop, async matchmaking, scouting shop, rankings, Tauri packaging, and Steam integration are later phases.

## Documentation

Start here:

- [Docs Index](docs/README.md)
- [Phase 1 Overview](docs/plan/phase-1-overview.md)
- [Phase 1 Plan](docs/plan/phase-1-foundation-and-collection.md)
- [ADRs](docs/adr/)
- [Drizzle Schema Proposal](docs/technical/drizzle-schema-proposal.md)
- [Observability and Analytics](docs/technical/observability-and-analytics.md)

## Local Runtime Hints

- Node.js: `24.11.1`
- pnpm: `10.24.0`

The repo uses `.node-version` as a simple Node version hint. Docker is not required for Phase 1.

## Environment

Do not commit real secrets. Use `.env.example` as the committed template and `.env.local` for private local values.

When the database work begins, create/fill `.env.local` with Neon PostgreSQL connection strings:

```env
NODE_ENV=development
API_PORT=3000

DATABASE_URL="postgresql://..."
DATABASE_MIGRATION_URL="postgresql://..."

VITE_API_BASE_URL=http://localhost:3000
```

For Phase 1, using the same Neon connection string for both database variables is acceptable.
