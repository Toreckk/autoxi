# ADR 0006: Hosted PostgreSQL, No Docker For Phase 1

## Status

Accepted.

## Context

The development machine is Windows and limited. Docker may not be available. Phase 1 needs PostgreSQL, but should not block on local database setup.

## Decision

Use hosted PostgreSQL for Phase 1, preferably Neon. Do not require Docker.

Setup steps:

1. Create hosted PostgreSQL project.
2. Copy connection string.
3. Create local `.env.local`.
4. Paste `DATABASE_URL` and `DATABASE_MIGRATION_URL`.
5. Install dependencies.
6. Run Drizzle migrations.
7. Run seed script.
8. Start API.
9. Start web app.
10. Verify `GET /health`.
11. Verify `GET /cards`.
12. Verify Collection page loads.

For Phase 1, using the same Neon connection string for both `DATABASE_URL` and `DATABASE_MIGRATION_URL` is acceptable. Later, use pooled Neon URL for runtime and direct/unpooled URL for migrations if needed.

## Consequences

- No Docker dependency.
- Local setup is lighter.
- Development depends on internet access and hosted DB availability.
- Real database credentials must stay in `.env.local` and never be committed.

## Alternatives Considered

- Dockerized PostgreSQL: common and reproducible, but not viable for this machine.
- Local PostgreSQL installer: possible fallback, but not the preferred first setup.
- SQLite: simpler, but does not match PostgreSQL behavior closely enough for Drizzle/Postgres schema work.
