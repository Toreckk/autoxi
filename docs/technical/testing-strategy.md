# Testing Strategy

Keep tests focused and proportional to the first slice.

## Domain Tests

Test pure helpers:

- tier derivation from rating,
- stat validation,
- position to broad-line mapping,
- filter normalization,
- alias risk helper functions once added.

## Backend Tests

Test:

- health endpoint,
- card filter parsing,
- repository query behavior with seeded test data,
- public DTO mapping excludes raw names,
- card detail 404 behavior.

Public card API safety tests must assert `GET /cards` and `GET /cards/:id` never include:

- `rawName`
- `sourceName`
- `sourcePlayerId`
- `sourceExternalId`
- `rawPayloadJson`
- `sourceImportId`
- `riskScore`
- `approvalNotes`
- `generationPrompt`
- `internalSourceName`

## Frontend Tests

Test:

- Collection renders cards from mock API data,
- filters update query state,
- empty state appears,
- error state appears,
- card detail opens.

## Visual Verification

Use browser screenshots for the card grid after the frontend exists. Verify:

- card layout is readable,
- no text overflow,
- reduced motion is respected,
- lower tiers do not over-animate,
- high-tier material effects are visible but not overwhelming.
