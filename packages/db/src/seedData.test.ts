import { describe, expect, it } from "vitest";
import {
  CARD_EDITION_CONFIG,
  GOALKEEPER_STAT_KEYS,
  OUTFIELD_STAT_KEYS,
  effectiveMaterialForCard,
  materialForTier,
  statProfileForPosition,
  type StatKey
} from "@autoxi/domain";
import { seedCards } from "./seedData.js";

describe("curated seed cards", () => {
  it("uses the position-derived stat profile for every card", () => {
    for (const card of seedCards) {
      expect(card.statProfile).toBe(statProfileForPosition(card.position));
      expect(card.stats.profile).toBe(card.statProfile);
    }
  });

  it("keeps ratings inside the public card range", () => {
    for (const card of seedCards) {
      expect(card.rating).toBeGreaterThanOrEqual(55);
      expect(card.rating).toBeLessThanOrEqual(99);
    }
  });

  it("uses only the stat keys allowed by each profile", () => {
    for (const card of seedCards) {
      const expectedKeys: readonly StatKey[] =
        card.stats.profile === "GOALKEEPER" ? GOALKEEPER_STAT_KEYS : OUTFIELD_STAT_KEYS;
      const actualKeys = Object.keys(card.stats).filter((key) => key !== "profile").sort();

      expect(actualKeys).toEqual([...expectedKeys].sort());

      if (card.stats.profile === "GOALKEEPER") {
        for (const key of GOALKEEPER_STAT_KEYS) {
          expect(card.stats[key]).toBeGreaterThanOrEqual(0);
          expect(card.stats[key]).toBeLessThanOrEqual(99);
        }
      } else {
        for (const key of OUTFIELD_STAT_KEYS) {
          expect(card.stats[key]).toBeGreaterThanOrEqual(0);
          expect(card.stats[key]).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it("stores base tier materials while edition keys drive public special-edition visuals", () => {
    const specialCards = seedCards.filter((card) => card.editionKey !== "NONE");

    expect(specialCards).toHaveLength(4);

    for (const card of specialCards) {
      const editionConfig = CARD_EDITION_CONFIG[card.editionKey];

      expect(card.materialKey).toBe(materialForTier(card.tier));
      expect(editionConfig.materialKeyOverride).not.toBeNull();
      expect(effectiveMaterialForCard(card.tier, card.editionKey)).toBe(
        editionConfig.materialKeyOverride
      );
    }
  });
});
