# Collection

The Collection page is the first playable-feeling feature. It should show all cards in the MVP, then later evolve into a discovered-card catalog.

## MVP Behavior

- Show the full collection with every card visible.
- No mystery-card state yet.
- Support search, filters, sorting, pagination, loading, error, and empty states.
- Open card details in a drawer or dialog.

## Future Behavior

- Only discovered cards show full information.
- Undiscovered cards appear as mystery cards.
- The Collection can later show discovery progress, favorites, owned counts, card sources, and run history.

## Filters

Required first-slice filters:

- search by public player/card name,
- rating min/max,
- tier,
- visible position,
- broad line,
- nationality,
- World Cup host/year,
- role,
- stat filter such as `pace >= 80`,
- sort by rating, name, tier, year, nationality.

## UI Shape

Use a dark premium interface with practical controls:

- search input,
- range inputs or sliders for rating,
- selects or segmented controls for tier, line, position, nation, and year,
- stat selector plus threshold input,
- compact active-filter chips,
- responsive grid,
- skeleton cards while loading.

The first version can use a rough sidebar or top filter panel. It should be clean enough to validate the workflow without becoming a final design project.

