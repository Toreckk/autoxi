# ORM Decision

Status: provisional Prisma default, Drizzle spike optional before first migration.

## Recommendation

Use Prisma for the first vertical slice unless we choose to spend a short spike comparing Drizzle before any schema/migration files are committed.

Drizzle is worth considering. It is not just hype: its SQL-like style, TypeScript-native schema definitions, small abstraction layer, and serverless-friendly posture are attractive for a PostgreSQL game backend. But this project already has plenty of new surface area: NestJS backend, shared domain package, ingestion, fictionalization, seed data, card UI, and eventually game simulation. Prisma reduces initial uncertainty.

## Why Prisma By Default

- Faster first slice for a solo developer.
- Very ergonomic generated TypeScript client.
- Prisma Migrate and Prisma Studio are useful during early data modeling.
- Clear schema file that is easy to discuss and review.
- Good fit for standard NestJS service/repository patterns.

## Why Drizzle Is Tempting

- SQL-like query style.
- Schema is written in TypeScript.
- Lightweight and close to the database.
- Strong fit for explicit PostgreSQL modeling.
- Good mental model if we want to improve SQL fluency.
- Potentially better alignment with a functional-core style because queries are plain composable TypeScript expressions.

## Decision Gate

Before implementing the first migration, we can run a 60-90 minute spike:

1. Model `nations`, `world_cup_editions`, `player_aliases`, `cards`, and `card_stats` in Prisma.
2. Model the same subset in Drizzle.
3. Write one filtered card-list query in each.
4. Write one seed insert in each.
5. Compare clarity, migration workflow, Studio/data inspection, and NestJS integration.

Switch to Drizzle only if it clearly feels better for this project. A tie goes to Prisma because it is the lower-risk first-slice choice.

## Sources Checked

- [Prisma ORM docs](https://www.prisma.io/docs/orm) describe Prisma ORM as a TypeScript ORM with type-safe database access, migrations, and a visual data editor.
- [Drizzle ORM docs](https://orm.drizzle.team/docs/overview) describe Drizzle as a lightweight, SQL-like TypeScript ORM with schema management, migrations, and relational query APIs.
