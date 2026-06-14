import { describe, expect, it } from "vitest";
import {
  GOALKEEPER_STAT_KEYS,
  OUTFIELD_STAT_KEYS,
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
});
