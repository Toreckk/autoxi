# Backend Structure

Recommended NestJS structure:

```text
apps/api/src/
  main.ts
  app.module.ts
  health/
    health.controller.ts
  cards/
    cards.module.ts
    cards.controller.ts
    cards.service.ts
    cards.repository.ts
    dto/
      card-query.dto.ts
  db/
    db.module.ts
    db.service.ts
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

- Encapsulate ORM queries.
- Return promises or small TaskEither wrappers.
- Map database records to public DTOs.

### Domain Package

Shared pure code should live in `packages/domain`, not inside the API app.

## Public-Safe Mapping

Create a single mapping function from database card records to `PublicCardDto`. This helps ensure raw names are never accidentally returned.
