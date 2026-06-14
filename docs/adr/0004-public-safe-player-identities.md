# ADR 0004: Public-Safe Player Identities

## Status

Accepted.

## Context

Autoxi uses World Cup-inspired football history, but public use of real or confusingly similar player identities can create commercial risk. Real names are not the same category as images or artwork, but publicity rights, passing off, licensing, consumer confusion, trademarks, player/league rights, and platform review can still matter.

This is not legal advice. Commercial release requires legal review.

## Decision

Store raw/source player names internally only. Public APIs and frontend UI use approved fictional aliases:

- `displayName`
- `shortName`

Private/internal fields must be explicit:

- `rawName`
- `sourceName`
- `internalSourceName`
- `rawSourceName`

Recognition should mostly come from:

```text
nation + World Cup year + position + rating + tier + role
```

Do not ship exact real names, one-letter changes, famous nicknames, official branding, real player photos, or too-close aliases.

Alias risk levels:

- `SAFE`
- `EVOCATIVE`
- `RISKY`
- `BLOCKED`

High-tier aliases require manual approval.

## Consequences

- The game can feel historically evocative without exposing raw source identities.
- Data modeling needs explicit source/private and alias/public separation.
- Public API tests must assert private fields are absent.
- Manual review is required for high-tier aliases before commercial release.

## Alternatives Considered

- Use real names: simpler and more recognizable, but riskier.
- Use random names without source mapping: safer, but weaker auditability and balancing.
- Use close parody names: still risky and not worth depending on.
