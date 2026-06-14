# Executive Plan

## Summary

Start with a small but sturdy vertical slice: a TypeScript monorepo, shared card domain package, NestJS API, PostgreSQL schema, seed data, and a React Collection page that displays and filters player cards. This builds the foundation needed for later systems without forcing game simulation, matchmaking, or Steam packaging too early.

## Why This Slice First

The Collection page exercises the important early architecture without requiring the hardest game systems yet. It proves that the project can:

- model player cards safely,
- store and query card data,
- keep raw real-world source names away from the public API,
- render the core collectible object,
- support search and filter UX,
- share types between backend and frontend,
- grow toward runs, scouting, and async matches later.

## Recommended Stack

- TypeScript everywhere.
- pnpm workspaces for a lightweight monorepo.
- React + Vite for the web client.
- shadcn/ui + Tailwind for UI primitives and styling.
- NestJS for a structured backend API.
- PostgreSQL hosted on Neon for the first Windows-friendly setup.
- Drizzle for schema, migrations, PostgreSQL queries, and seed workflow.
- Zod for shared runtime validation.
- fp-ts in the functional core and ingestion pipelines.
- TanStack Query for frontend server state.
- Tauri later for desktop/Steam packaging.

React/Tauri fits because this game is UI-heavy: collection browsing, drafting, scouting, shop decisions, history, rankings, and run management are all application screens. Godot is not necessary for the first version because the early game does not require a physics-heavy or animation-engine-heavy match presentation. If the match presentation later becomes a core spectacle, Godot can be reconsidered.

## How fp-ts Should Be Used

Use a functional core, imperative shell style:

- Keep domain transformations pure.
- Use `Either` for validation and parsing.
- Use `TaskEither` for use cases that call repositories or external services.
- Keep NestJS controllers simple and imperative.
- Map domain errors to HTTP responses at the controller boundary.
- Avoid using fp-ts heavily inside React components, shadcn components, DTO declarations, or ORM schema code.

Good places for fp-ts:

- data ingestion,
- name fictionalization,
- card generation,
- filter normalization,
- match simulation later,
- scouting generation later,
- backend use-case orchestration where it improves clarity.

## Local Development Without Docker

The first setup should avoid Docker entirely:

1. Create a free Neon PostgreSQL project.
2. Copy the pooled and direct connection strings.
3. Add local `.env.local` for API, web, and Drizzle.
4. Run Drizzle migrations against Neon.
5. Seed the database.
6. Start the NestJS API locally.
7. Start the Vite client locally.
8. Verify `/health`, `/cards`, `/cards/meta/filters`, and the Collection page.

Hosted free-tier limits can change, so Neon limits should be checked before relying on them for long-term development.

## Implementation Phases

- [Phase 0: Project Decisions](phase-0-project-decisions.md)
- [Phase 1: Foundation and Collection](phase-1-foundation-and-collection.md)
- [Phase 2: Data Ingestion and Fictionalization](phase-2-data-ingestion.md)
- [Phase 3: First Solo Run Loop](phase-3-first-run-loop.md)
- [Phase 4: Async and Progression](phase-4-async-and-progression.md)

## First Concrete Tasks

1. Scaffold pnpm workspace and package boundaries.
2. Create shared card domain models and Zod schemas.
3. Scaffold NestJS API with health endpoint.
4. Add Drizzle schema for first-slice tables.
5. Configure Neon connection and migration scripts.
6. Add seed data with fictional names only.
7. Add card list, detail, and metadata endpoints.
8. Scaffold React/Vite client with shadcn/Tailwind.
9. Add main menu routes.
10. Build Collection filters, grid, card component, and detail drawer.
