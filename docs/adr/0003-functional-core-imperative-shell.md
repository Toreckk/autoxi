# ADR 0003: Functional Core, Imperative Shell

## Status

Accepted.

## Context

The project should use fp-ts as a refresher without making React components or simple NestJS controllers painful.

## Decision

Use a functional core, imperative shell approach.

NestJS controllers remain simple. They receive requests, call use cases, and map typed application errors to HTTP responses.

Use fp-ts in:

- domain validation flows,
- use cases,
- repository wrappers if useful,
- data ingestion scripts,
- name fictionalization scripts,
- card generation/transformation,
- card filter normalization,
- later match simulation,
- later scouting generation.

Avoid heavy fp-ts in:

- React components,
- shadcn components,
- basic controllers,
- Drizzle schema definitions,
- simple DTO declarations.

## Consequences

- Domain logic is easier to test.
- Errors can be modeled as values instead of thrown exceptions.
- The imperative framework boundaries stay readable.
- The team must avoid turning every trivial operation into fp-ts ceremony.

## Alternatives Considered

- Fully imperative NestJS style: simpler at first, but weaker for pure transformation-heavy game logic.
- Heavy fp-ts everywhere: educational, but likely too slow and awkward for UI and framework code.
