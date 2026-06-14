# Backend Structure

Recommended NestJS structure:

```text
apps/api/src/
  main.ts
  app.module.ts
  modules/
    health/
    cards/
      cards.controller.ts
      cards.repository.ts
      list-cards.use-case.ts
      get-card.use-case.ts
      get-card-filters-meta.use-case.ts
      cards.mapper.ts
      cards.dto.ts
      cards.errors.ts
    database/
      database.module.ts
      database.provider.ts
    config/
    observability/
      observability.module.ts
      telemetry.port.ts
      analytics.port.ts
      error-reporting.port.ts
      console-telemetry.adapter.ts
      console-analytics.adapter.ts
      console-error-reporting.adapter.ts
  common/
    errors/
      app-error.ts
      http-error.mapper.ts
```

## Layers

### Controller

- Parse request query/params.
- Call service/use case.
- Convert errors to HTTP responses.
- Return DTOs.

### Service / Use Case

- Normalize filters.
- Call repository.
- Return `TaskEither<AppError, Result>` where useful.
- Keep business logic away from controller.

### Repository

- Encapsulate Drizzle queries.
- Return promises or small TaskEither wrappers.
- Map database records to public DTOs.

### Domain Package

Shared pure code should live in `packages/domain`, not inside the API app.

## Public-Safe Mapping

Create a single mapping function from database card records to `PublicPlayerCardDto`. This helps ensure raw names are never accidentally returned.
