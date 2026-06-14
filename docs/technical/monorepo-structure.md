# Monorepo Structure

Recommended initial structure:

```text
autoxi/
  apps/
    api/
    web/
  packages/
    domain/
    db/
    config/
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

This package should not import NestJS, Drizzle, React, or browser-only code.

### `packages/db`

Drizzle/PostgreSQL package:

- Drizzle schema,
- Drizzle client factory,
- DB connection helpers,
- migrations,
- seed helpers,
- future DB test utilities.

The API depends on this package instead of scattering database setup through app modules.

### `packages/config`

Optional shared config:

- TypeScript config helpers,
- ESLint config,
- Prettier config,
- shared constants if they are not domain-specific.
