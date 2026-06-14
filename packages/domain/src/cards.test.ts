import { describe, expect, it } from "vitest";
import {
  CARD_TIERS,
  CARD_TIER_CONFIG_BY_CODE,
  GOALKEEPER_STAT_KEYS,
  MATERIAL_KEYS,
  OUTFIELD_STAT_KEYS,
  POSITION_CONFIG_BY_CODE,
  STAT_KEYS,
  VISIBLE_POSITIONS,
  animationLevelForTier,
  broadLineForPosition,
  deriveTier,
  materialForTier,
  normalizeCardQuery,
  publicPlayerCardSchema,
  statProfileForPosition,
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

  it("maps positions to stat profiles", () => {
    expect(statProfileForPosition("GK")).toBe("GOALKEEPER");
    expect(statProfileForPosition("CB")).toBe("OUTFIELD");
    expect(statProfileForPosition("CM")).toBe("OUTFIELD");
    expect(statProfileForPosition("ST")).toBe("OUTFIELD");
  });

  it("keeps public stat groups explicit and non-overlapping", () => {
    expect(STAT_KEYS).toEqual([...OUTFIELD_STAT_KEYS, ...GOALKEEPER_STAT_KEYS]);

    for (const stat of OUTFIELD_STAT_KEYS) {
      expect(GOALKEEPER_STAT_KEYS).not.toContain(stat as never);
    }
  });

  it("validates public cards with profile-specific stats", () => {
    const baseCard = {
      id: "00000000-0000-4000-8000-000000000001",
      displayName: "Test Player",
      shortName: "Player",
      rating: 84,
      tier: "STAR",
      position: "CM",
      broadLine: "MIDFIELDER",
      role: "Creator",
      cost: 5,
      materialKey: "violet-phase",
      animationLevel: "medium",
      nation: {
        id: "00000000-0000-4000-8000-000000000002",
        code: "TST",
        name: "Testland",
        flagCode: "tst",
        flagUrl: "/flags/tst.svg"
      },
      worldCup: {
        id: "00000000-0000-4000-8000-000000000003",
        host: "Testland",
        year: 2026,
        label: "Testland 2026"
      },
      tags: []
    };

    expect(
      publicPlayerCardSchema.parse({
        ...baseCard,
        statProfile: "OUTFIELD",
        stats: {
          profile: "OUTFIELD",
          pace: 80,
          shooting: 78,
          passing: 86,
          dribbling: 84,
          defending: 70,
          physical: 76
        }
      }).stats.profile
    ).toBe("OUTFIELD");

    expect(() =>
      publicPlayerCardSchema.parse({
        ...baseCard,
        statProfile: "GOALKEEPER",
        position: "GK",
        broadLine: "GOALKEEPER",
        stats: {
          profile: "GOALKEEPER",
          pace: 80,
          shooting: 78,
          passing: 86,
          dribbling: 84,
          defending: 70,
          physical: 76
        }
      })
    ).toThrow();
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
