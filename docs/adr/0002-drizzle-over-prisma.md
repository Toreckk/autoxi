# ADR 0002: Drizzle Over Prisma

## Status

Accepted.

## Context

The original plan treated Prisma as the default ORM with Drizzle as an alternative. The project direction has changed: Drizzle is preferred because it is SQL-first, lightweight, TypeScript-friendly, and a good way to refresh PostgreSQL knowledge.

Card filtering/query composition is naturally SQL-like. Drizzle also fits a functional repository/use-case style because repositories can expose explicit query functions and map errors at the boundary.

## Decision

Use Drizzle ORM for Phase 1.

Create `packages/db` to own:

- Drizzle schema,
- Drizzle client factory,
- database connection helpers,
- migrations,
- seed helpers,
- future DB test utilities.

The NestJS API will depend on `packages/db` through a custom `DatabaseModule` that provides a typed Drizzle client.

## Consequences

- We keep closer contact with PostgreSQL and SQL concepts.
- We avoid the heavier generated-client model.
- We need to write a little more integration code for NestJS.
- We do not rely on Prisma Studio; Drizzle Studio or direct SQL tools can be used instead.

## Alternatives Considered

- Prisma: excellent ergonomics and migration tooling, but less aligned with the SQL-first learning goal.
- Raw SQL only: maximum control, but more repetitive and easier to type incorrectly.
- Kysely: strong SQL builder, but Drizzle gives schema, migrations, and ORM-style helpers in one ecosystem.
