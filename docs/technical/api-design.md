# API Design

Use REST for the first slice.

## Endpoints

### `GET /health`

Returns API status.

Example:

```json
{
  "status": "ok"
}
```

### `GET /cards`

Returns paginated public cards.

Supported query params:

- `search`
- `tier`
- `minRating`
- `maxRating`
- `position`
- `broadLine`
- `nation`
- `year`
- `host`
- `role`
- `stat`
- `statMin`
- `sort`
- `page`
- `pageSize`

Example:

```text
GET /cards?search=maestro&tier=STAR&nation=CRO&minRating=80&sort=rating_desc&page=1&pageSize=40
```

### `GET /cards/:id`

Returns one public card by ID.

### `GET /cards/meta/filters`

Returns available filter values:

- nations,
- years,
- hosts,
- positions,
- broad lines,
- tiers,
- roles,
- stat keys,
- stat groups,
- sort options.

### Optional Dev Endpoint

`GET /dev/seed-status`

Only expose in development. It can help verify seed counts and data versions.

## Public Card DTO

```ts
type PublicPlayerCardDto = {
  id: string;
  displayName: string;
  shortName: string;
  rating: number;
  tier: CardTier;
  cost: number;
  position: VisiblePosition;
  broadLine: BroadLine;
  statProfile: "OUTFIELD" | "GOALKEEPER";
  nation: {
    id: string;
    code: string;
    name: string;
    flagCode: string;
    flagUrl?: string;
  };
  worldCup: {
    id: string;
    host: string;
    year: number;
    label: string;
  };
  role: CardRole;
  stats:
    | {
        profile: "OUTFIELD";
        pace: number;
        shooting: number;
        passing: number;
        dribbling: number;
        defending: number;
        physical: number;
      }
    | {
        profile: "GOALKEEPER";
        diving: number;
        handling: number;
        kicking: number;
        reflexes: number;
        speed: number;
        positioning: number;
      };
  materialKey: string;
  animationLevel: "none" | "subtle" | "medium" | "premium";
};
```

## Sorting

Initial sort keys:

- `rating_desc`
- `rating_asc`
- `name_asc`
- `name_desc`
- `tier_desc`
- `tier_asc`
- `year_desc`
- `year_asc`
- `nationality_asc`

## API Safety

Public endpoints must not return:

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

Public API safety tests must assert these fields are absent from both `GET /cards` and `GET /cards/:id`.

`flagUrl`, if included, must be frontend-derived/local. Phase 1 should not return remote per-card flag URLs.
