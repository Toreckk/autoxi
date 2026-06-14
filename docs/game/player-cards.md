# Player Cards

A card is a World Cup version of an internal player identity:

```text
player identity + nation + World Cup edition/year
```

Examples:

- fictional Argentina CAM from Qatar 2022,
- fictional Brazil ST from Mexico 1970,
- fictional Germany GK from Brazil 2014.

Different World Cup versions of the same underlying identity are separate cards. Later, a run cannot own two versions of the same underlying player identity at the same time.

## Public Safety

The client should receive fictional public names only. Raw source names must remain internal and should be used only for private audit/admin workflows.

Cards should avoid:

- real player photos,
- silhouettes that imply real likeness,
- official FIFA, EA, FUT, World Cup, federation, or club branding,
- official Counter-Strike or CS:GO branding,
- copied FUT-style frames or proprietary card shapes,
- names that are too close to raw source names.

## Card Fields

Public card DTOs should include:

- `id`
- `displayName`
- `shortName`
- `rating`
- `tier`
- `cost`
- `position`
- `broadLine`
- `nation.code`
- `nation.name`
- `nation.flagCode`
- optional local/frontend-derived `nation.flagUrl`
- `worldCup.host`
- `worldCup.year`
- `role`
- `stats`
- `materialKey`
- `animationLevel`

The API should return `flagCode`; the frontend resolves `/flags/{flagCode}.svg` locally and falls back to `/flags/unknown.svg`.

Public card DTOs must not include:

- raw source player name,
- raw source provider IDs,
- audit mapping,
- alias risk notes,
- unapproved aliases.

Use `displayName` and `shortName` for public identity. Do not use a generic internal field named `name` for raw player names; use explicit private names such as `rawName`, `sourceName`, `internalSourceName`, or `rawSourceName`.

## Tiers

| Tier | Name | Rating Range | Material Direction |
| --- | --- | --- | --- |
| 1 | Squad Player | 55-67 | matte graphite / carbon weave |
| 2 | Starter | 68-74 | brushed steel / cyan steel phase |
| 3 | Key Player | 75-80 | emerald composite / green phase |
| 4 | Star | 81-86 | amethyst/violet phase |
| 5 | World Class | 87-90 | cobalt/sapphire phase with restrained gold trim |
| 6 | Hero | 91-94 | ruby/crimson high-sheen material |
| 7 | Icon | 95-99 | black pearl or ivory/gold/pearl with strongest premium glow |

Tier is derived from rating unless manually overridden.

## Costs

| Tier | Cost |
| --- | ---: |
| Squad Player | 1 |
| Starter | 2 |
| Key Player | 3 |
| Star | 5 |
| World Class | 7 |
| Hero | 10 |
| Icon | 13 |

## Positions

Broad lines:

- GK
- DF
- MF
- FW

Visible positions:

- GK
- CB
- LB
- RB
- CM
- CDM
- CAM
- LW
- RW
- ST

## Stats

Hidden stats are 0-99 integers:

- pace
- shooting
- passing
- dribbling
- defending
- physical
- goalkeeping

Rating is an integer from 55-99.

## Roles

Initial roles/archetypes:

- Maestro
- Finisher
- Engine
- Anchor
- Commander
- Sweeper
- Shot Stopper
- Wide Creator
- Target Man
- Ball Winner
- Dribbler
- Libero
