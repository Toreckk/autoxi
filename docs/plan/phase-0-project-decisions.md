# Phase 0: Project Decisions

Goal: lock the initial direction before code structure spreads.

## Decisions

- Use a web-first monorepo.
- Use hosted Neon PostgreSQL first, not Docker.
- Use Prisma as the default ORM for the first slice, with a short Drizzle spike before schema implementation if we want to test the newer SQL-like workflow.
- Use REST for the first API surface.
- Use fictional public names in all client-facing responses.
- Keep raw source names server-side and audit-only.
- Build Collection before gameplay.
- Use shadcn/ui and Tailwind for the client.
- Keep card visuals football-card-readable, but original: lightly FUT-adjacent information layout, mixed with material/skin-inspired premium treatments.

## Open Naming

The current working name is "World Cup Battles". Keep code package names neutral enough that the game can be renamed later.

Recommended internal names:

- repo: `autoxi`
- app package: `@autoxi/web`
- api package: `@autoxi/api`
- shared package: `@autoxi/domain`

## Definition of Done

- Initial decisions are documented.
- The first implementation phase has a clear checklist.
- No gameplay implementation has started before the foundation is ready.
