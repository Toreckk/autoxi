# Frontend Structure

Recommended React/Vite structure:

```text
apps/web/src/
  main.tsx
  app/
    router.tsx
    providers.tsx
    query-client.ts
  features/
    menu/
    collection/
    cards/
  components/
    layout/
    player-card/
      PlayerCardFull.tsx
      PlayerCardCompact.tsx
      PlayerCardMini.tsx
      PlayerCardSkeleton.tsx
      CardDetailDrawer.tsx
  lib/
    api/
    observability/
  components/
    ui/
  public/
    flags/
```

## Routes

- `/`
- `/collection`
- `/history` placeholder
- `/settings` placeholder
- `/play-solo` placeholder
- `/play-online-ranked` placeholder

## Main Menu

Menu options:

- Play Solo
- Play Online Ranked
- Collection
- History
- Settings
- Quit

Only Collection needs to work in the first slice.

## Collection Page

The page should include:

- API-backed card list,
- filters,
- sorting,
- pagination,
- loading skeletons,
- error state,
- empty state,
- card detail drawer/dialog,
- local flag assets resolved from `nation.flagCode`,
- analytics events for menu and Collection interactions.

## Data Fetching

Use TanStack Query:

- query key should include normalized filters,
- keep previous data during pagination/filter changes where useful,
- expose loading and error states cleanly.

## Error Handling

Add a React ErrorBoundary for route/render errors and report captured errors through `ErrorReportingPort`.

Frontend failed API calls should emit `api_request_failed`. Slow API calls should emit `api_request_slow`.

## Shared Validation

Use `packages/domain` Zod schemas where practical. The frontend can use them for API response validation later, but the first version can start with typed DTOs and gradually add runtime parsing.
