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
- Prisma ORM by default; Drizzle is a documented alternative
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

## ORM Decision: Prisma vs Drizzle

NestJS provides structured modules, controllers, services, dependency injection, and testing patterns. PostgreSQL gives strong relational modeling for cards, identities, aliases, runs, snapshots, matches, and rankings.

Prisma remains the default because it is fast to start, has a mature migration workflow, generates a highly ergonomic type-safe client, and includes Prisma Studio for inspecting data. That is useful for a solo developer building the first vertical slice.

Drizzle is a serious alternative because it is lightweight, SQL-like, schema-in-TypeScript, and serverless-friendly. It may fit especially well if we want more explicit SQL control and a smaller abstraction layer.

Recommendation: keep Prisma for Phase 1 unless we deliberately run a short Drizzle spike before creating the schema. If Drizzle feels clearer after modeling `cards`, `card_stats`, and `player_aliases`, switch before migrations exist. Once the first migration lands, avoid changing ORM until a real constraint appears.

## REST vs tRPC

Use REST first. It is simple with NestJS, works cleanly with Tauri/Steam-style clients, and keeps backend boundaries clear. tRPC can be reconsidered later if the shared TypeScript client experience becomes more valuable than explicit HTTP DTOs.

## Observability Direction

Use OpenTelemetry as the vendor-neutral instrumentation layer for traces, metrics, and logs. Start with free/open-source dashboards through Grafana-compatible tooling, then keep the option to export to Datadog or another paid platform later.

For product/game analytics, define a separate `AnalyticsPort` and emit stable domain events such as `collection_viewed`, `filter_changed`, `run_started`, `match_completed`, and `scouting_reroll_clicked`. Grafana is excellent for operational dashboards, but product funnels, retention, cohorts, and session replay are often better handled by a product analytics tool such as PostHog or a purpose-built events warehouse.
