# Phase 1: Foundation and Collection Vertical Slice

Goal: build a working end-to-end card Collection experience.

## Scope

Implement:

- pnpm monorepo,
- shared domain package,
- NestJS API,
- Drizzle/PostgreSQL schema,
- seed data,
- card query endpoints,
- Vite React client,
- main menu,
- Collection page,
- reusable player card component,
- filters, sorting, pagination, loading, empty, and error states,
- observability and analytics ports with no-op/console adapters.

Do not implement:

- match simulation,
- scouting shop,
- online ranked,
- Steam packaging,
- real player images,
- real public player names,
- official FIFA/EA/FUT/World Cup branding,
- copied FUT-style frames or distinctive proprietary card shapes.

## User-Facing Flow

1. User opens the app.
2. Main menu shows:
   - Play Solo
   - Play Online Ranked
   - Collection
   - History
   - Settings
   - Quit
3. User selects Collection.
4. Collection loads cards from the API.
5. User searches, filters, sorts, and opens a card detail drawer.

For now, all cards are visible. Undiscovered mystery cards come later.

## Backend Tasks

1. Scaffold `apps/api`.
2. Add `/health`.
3. Add Drizzle schema for first-slice tables.
4. Add card seed data.
5. Add card repository.
6. Add card query use cases.
7. Add `GET /cards`.
8. Add `GET /cards/:id`.
9. Add `GET /cards/meta/filters`.
10. Ensure DTOs return public-safe fields only.
11. Add request IDs/correlation IDs.
12. Add structured logging for health and card endpoints.
13. Emit basic API metrics through `TelemetryPort`.

## Frontend Tasks

1. Scaffold `apps/web`.
2. Install and configure Tailwind/shadcn.
3. Add React Router.
4. Add TanStack Query.
5. Add App shell and main menu.
6. Add Collection route.
7. Add filter controls.
8. Add card grid.
9. Add `PlayerCardFull`, `PlayerCardCompact`, `PlayerCardMini`, and `PlayerCardSkeleton`.
10. Add card detail drawer/dialog.
11. Emit Collection analytics events through `AnalyticsPort`.
12. Capture client-side errors through `ErrorReportingPort`.

## Shared Domain Tasks

1. Define card tier enum and rating ranges.
2. Define visible positions and broad lines.
3. Define stat schema with 0-99 integer constraints.
4. Define public card DTO schema.
5. Define filter query schema.
6. Add pure helpers for tier derivation and filter normalization.
7. Define shared analytics event names and payload schemas where they cross app boundaries.

## Definition of Done

- `pnpm install` works.
- API starts locally and returns `GET /health`.
- Drizzle migration can run against Neon.
- Seed script creates enough card data to exercise filters.
- `GET /cards` supports the MVP filters.
- Frontend Collection page loads API data.
- Card visuals match the documented football-card plus material/skin direction.
- Raw source names are not returned by public endpoints.
- Basic request logging, API timing, client errors, and Collection interactions are instrumented through ports.
