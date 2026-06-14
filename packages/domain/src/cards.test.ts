import { describe, expect, it } from "vitest";
import {
  CARD_TIERS,
  CARD_TIER_CONFIG_BY_CODE,
  MATERIAL_KEYS,
  POSITION_CONFIG_BY_CODE,
  VISIBLE_POSITIONS,
  animationLevelForTier,
  broadLineForPosition,
  deriveTier,
  materialForTier,
  normalizeCardQuery,
  tierRank
} from "./cards.js";

describe("card domain helpers", () => {
  it("derives tier from rating boundaries", () => {
    expect(deriveTier(55)).toBe("SQUAD_PLAYER");
    expect(deriveTier(68)).toBe("STARTER");
    expect(deriveTier(75)).toBe("KEY_PLAYER");
    expect(deriveTier(81)).toBe("STAR");
    expect(deriveTier(87)).toBe("WORLD_CLASS");
    expect(deriveTier(91)).toBe("HERO");
    expect(deriveTier(95)).toBe("ICON");
  });

  it("maps every supported rating to exactly one tier", () => {
    for (let rating = 55; rating <= 99; rating += 1) {
      const matches = CARD_TIERS.filter((tier) => {
        const config = CARD_TIER_CONFIG_BY_CODE[tier];
        return rating >= config.ratingMin && rating <= config.ratingMax;
      });

      expect(matches, `rating ${rating}`).toHaveLength(1);
      expect(deriveTier(rating)).toBe(matches[0]);
    }
  });

  it("fails clearly for unsupported tier ratings", () => {
    expect(() => deriveTier(54)).toThrow(RangeError);
    expect(() => deriveTier(100)).toThrow(RangeError);
  });

  it("has contiguous, non-overlapping tier ranges", () => {
    const ranges = CARD_TIERS.map((tier) => CARD_TIER_CONFIG_BY_CODE[tier]).sort((a, b) => a.ratingMin - b.ratingMin);

    expect(ranges[0]?.ratingMin).toBe(55);
    expect(ranges.at(-1)?.ratingMax).toBe(99);

    ranges.slice(1).forEach((range, index) => {
      expect(range.ratingMin).toBe(ranges[index]!.ratingMax + 1);
    });
  });

  it("normalizes inverted rating ranges", () => {
    expect(normalizeCardQuery({ minRating: 90, maxRating: 75 })).toMatchObject({
      minRating: 75,
      maxRating: 90
    });
  });

  it("maps positions to broad lines", () => {
    expect(broadLineForPosition("GK")).toBe("GOALKEEPER");
    expect(broadLineForPosition("CB")).toBe("DEFENDER");
    expect(broadLineForPosition("CM")).toBe("MIDFIELDER");
    expect(broadLineForPosition("ST")).toBe("FORWARD");
  });

  it("has metadata for every tier", () => {
    for (const tier of CARD_TIERS) {
      const config = CARD_TIER_CONFIG_BY_CODE[tier];
      expect(config.code).toBe(tier);
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.cost).toBeGreaterThan(0);
      expect(MATERIAL_KEYS).toContain(materialForTier(tier));
      expect(["none", "subtle", "medium", "premium"]).toContain(animationLevelForTier(tier));
      expect(tierRank(tier)).toBe(config.rank);
    }
  });

  it("has broad-line metadata for every visible position", () => {
    for (const position of VISIBLE_POSITIONS) {
      expect(POSITION_CONFIG_BY_CODE[position].label).toBe(position);
      expect(["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"]).toContain(broadLineForPosition(position));
    }
  });
});
