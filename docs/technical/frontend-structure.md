# Frontend Structure

Recommended React/Vite structure:

```text
apps/web/src/
  main.tsx
  app/
    App.tsx
    router.tsx
    queryClient.ts
  pages/
    MainMenuPage.tsx
    CollectionPage.tsx
  features/
    cards/
      api/
        cardsApi.ts
        cardsQueries.ts
      components/
        PlayerCardFull.tsx
        PlayerCardCompact.tsx
        PlayerCardMini.tsx
        PlayerCardSkeleton.tsx
        CardDetailDrawer.tsx
        CardGrid.tsx
        CardFilters.tsx
      styles/
        player-card.css
  components/
    ui/
```

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
- card detail drawer/dialog.

## Data Fetching

Use TanStack Query:

- query key should include normalized filters,
- keep previous data during pagination/filter changes where useful,
- expose loading and error states cleanly.

## Shared Validation

Use `packages/domain` Zod schemas where practical. The frontend can use them for API response validation later, but the first version can start with typed DTOs and gradually add runtime parsing.

