import { describe, expect, it } from "vitest";
import { CARD_TIERS, SORT_OPTIONS } from "@autoxi/domain";

describe("collection controls", () => {
  it("has tier and sort options available for the UI", () => {
    expect(CARD_TIERS.length).toBeGreaterThan(0);
    expect(SORT_OPTIONS).toContain("rating_desc");
  });
});
