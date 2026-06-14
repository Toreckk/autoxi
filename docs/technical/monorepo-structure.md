# Monorepo Structure

Recommended initial structure:

```text
autoxi/
  apps/
    api/
    web/
  packages/
    domain/
    config/
  prisma/ or db/
    schema and migrations
    seed.ts
  docs/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
```

## Package Responsibilities

### `apps/api`

NestJS backend:

- controllers,
- modules,
- application services/use cases,
- repositories,
- database/ORM integration,
- HTTP error mapping.

### `apps/web`

React/Vite frontend:

- app shell,
- routes,
- Collection page,
- card components,
- API client,
- TanStack Query hooks,
- shadcn UI setup.

### `packages/domain`

Shared domain types and pure logic:

- card enums,
- Zod schemas,
- DTO types,
- tier calculation,
- filter normalization,
- stat validation,
- safe public card contracts.

This package should not import NestJS, Prisma, Drizzle, React, or browser-only code.

### `packages/config`

Optional shared config:

- TypeScript config helpers,
- ESLint config,
- Prettier config,
- shared constants if they are not domain-specific.

### `prisma` or `db`

Database schema, migrations, and seed scripts.

If Prisma is used, keep `prisma/` at the repo root so the generated client and migrations are easy to manage across API and seed commands. If Drizzle is used, keep schema and migration config in a root `db/` folder or an API-local `src/db/` folder, then document the choice clearly.
