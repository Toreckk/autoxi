# fp-ts Guidelines

Use fp-ts where it makes the codebase safer and more explicit, not everywhere.

## Architecture Style

Use functional core, imperative shell:

- Controllers are simple and Nest-like.
- Use cases orchestrate operations.
- Domain functions are pure where possible.
- Repositories hide ORM details.
- Errors are values in the domain/application layers.
- Controllers map application errors to HTTP exceptions.

## Good Uses

- validation pipelines,
- ingestion transforms,
- name fictionalization,
- card tier derivation,
- rating/stat normalization,
- filter normalization,
- match simulation later,
- scouting board generation later,
- backend use cases that benefit from `TaskEither`.

## Avoid Overuse

Do not force fp-ts into:

- React rendering code,
- shadcn UI components,
- simple NestJS controllers,
- ORM schema,
- plain DTO declarations,
- trivial functions where normal TypeScript is clearer.

## Example Shapes

```ts
type AppTask<A> = TaskEither<AppError, A>;
type ValidationResult<A> = Either<ValidationError, A>;
```

Use cases can return:

```ts
TaskEither<AppError, PublicCardDto[]>
```

Filter parsing can return:

```ts
Either<ValidationError, CardFilter>
```

Only introduce `ReaderTaskEither<Dependencies, AppError, Result>` if dependency threading becomes painful. Start with normal Nest dependency injection and small pure functions.

## Error Mapping

Keep domain errors typed:

- `ValidationError`
- `NotFoundError`
- `DatabaseError`
- `ExternalSourceError`
- `AliasRiskError`

Map them at the boundary:

- validation -> 400
- not found -> 404
- database/unexpected -> 500
- forbidden dev-only endpoint -> 403 or 404
