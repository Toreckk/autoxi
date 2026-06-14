# Tech Stack

## Recommended Stack

- TypeScript everywhere
- pnpm workspaces
- React + Vite for frontend
- shadcn/ui + Tailwind for UI
- TanStack Query for API fetching
- React Router for navigation
- NestJS backend
- PostgreSQL database
- Drizzle ORM
- Zod for shared validation
- fp-ts for functional domain logic
- Neon PostgreSQL for first hosted development
- Tauri later for desktop/Steam packaging
- OpenTelemetry for vendor-neutral telemetry
- Grafana stack for free/open-source dashboards first
- Product analytics through a port, with PostHog or a custom event sink as likely first adapters

## Why React and Tauri

This game is UI-heavy: collection browsing, drafting, scouting, team building, history, settings, ranking, and post-match summaries are all application screens. React is a strong fit for that kind of interactive stateful interface, and Tauri can later package the same web app into a lightweight desktop shell for Steam.

## Why Godot Is Not Needed Yet

The first version does not need a real-time rendered match engine. The early game can be driven by cards, shop decisions, deterministic simulations, and rich UI screens. Godot may become useful later if match presentation becomes highly animated or spatial, but adding it now would slow the foundation.

## ORM Decision: Drizzle

NestJS provides structured modules, controllers, services, dependency injection, and testing patterns. PostgreSQL gives strong relational modeling for cards, identities, aliases, runs, snapshots, matches, and rankings.

Use Drizzle because it is lightweight, SQL-first, schema-in-TypeScript, and a good fit for explicit PostgreSQL modeling. It also fits the functional-core/use-case style: repositories can compose SQL-like queries and map database errors into typed application errors.

The tradeoff is that Drizzle has less official NestJS integration than Prisma, so the API will provide a custom `DatabaseModule` around the typed Drizzle client from `packages/db`.

## REST vs tRPC

Use REST first. It is simple with NestJS, works cleanly with Tauri/Steam-style clients, and keeps backend boundaries clear. tRPC can be reconsidered later if the shared TypeScript client experience becomes more valuable than explicit HTTP DTOs.

## Observability Direction

Use OpenTelemetry as the vendor-neutral instrumentation layer for traces, metrics, and logs. Start with free/open-source dashboards through Grafana-compatible tooling, then keep the option to export to Datadog or another paid platform later.

For product/game analytics, define a separate `AnalyticsPort` and emit stable domain events such as `collection_viewed`, `filter_changed`, `run_started`, `match_completed`, and `scouting_reroll_clicked`. Grafana is excellent for operational dashboards, but product funnels, retention, cohorts, and session replay are often better handled by a product analytics tool such as PostHog or a purpose-built events warehouse.
