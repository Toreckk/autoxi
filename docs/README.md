# Autoxi Documentation

Autoxi is a web-first asynchronous football squad-builder autobattler. The current working title from the preplan is "World Cup Battles", but the name is intentionally provisional.

This documentation turns the original planning notes into smaller files that are easier to maintain while implementation evolves.

## Start Here

- [Executive Plan](plan/README.md)
- [Phase 1: Foundation and Collection Vertical Slice](plan/phase-1-foundation-and-collection.md)
- [Game Concept](game/concept.md)
- [Player Cards](game/player-cards.md)
- [Card Visual Design](design/player-card-visual-design.md)
- [Recommended Tech Stack](technical/tech-stack.md)
- [ORM Decision](technical/orm-decision.md)
- [Monorepo Structure](technical/monorepo-structure.md)
- [Initial Setup Commands](technical/setup-commands.md)
- [Database Schema](technical/database-schema.md)
- [API Design](technical/api-design.md)
- [Frontend Structure](technical/frontend-structure.md)
- [Observability and Analytics](technical/observability-and-analytics.md)

## First Implementation Goal

The first slice deliberately avoids full gameplay, async matchmaking, Steam packaging, or match simulation. It should establish the project foundation:

1. Build the pnpm monorepo.
2. Add shared player-card domain models.
3. Add PostgreSQL and ORM database models.
4. Seed the database with fictional public player/card information.
5. Generate fictionalized public names from raw source names.
6. Build API requests for querying player cards.
7. Build a simple frontend main menu.
8. Build a working Collection page with card filters.

Only `Collection` needs to work in the first menu. The other menu entries can be visible but disabled or placeholder routes.

## Source Notes

The original `preplan.md` and `cards-code.md` were used as input material. The long-form source notes can be removed once these docs are complete because the actionable content has been split here.
