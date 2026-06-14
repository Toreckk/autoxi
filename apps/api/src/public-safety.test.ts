import { describe, expect, it } from "vitest";
import { publicPlayerCardSchema } from "@autoxi/domain";

const forbiddenPublicFields = [
  "rawName",
  "sourceName",
  "sourcePlayerId",
  "sourceExternalId",
  "rawPayloadJson",
  "sourceImportId",
  "riskScore",
  "approvalNotes",
  "generationPrompt",
  "internalSourceName"
];

describe("API public safety", () => {
  it("keeps the forbidden public field list explicit", () => {
    expect(forbiddenPublicFields).toContain("rawName");
    expect(forbiddenPublicFields).toContain("sourceImportId");
  });

  it("keeps representative public card DTOs free of private source fields", () => {
    const card = publicPlayerCardSchema.parse({
      id: "00000000-0000-4000-8000-000000000101",
      displayName: "Aurel Voss",
      shortName: "Voss",
      rating: 94,
      tier: "HERO",
      position: "CM",
      broadLine: "MIDFIELDER",
      statProfile: "OUTFIELD",
      role: "Tempo Setter",
      cost: 10,
      materialKey: "ruby-hero",
      animationLevel: "premium",
      nation: {
        id: "00000000-0000-4000-8000-000000000102",
        code: "GER",
        name: "Germany",
        flagCode: "ger",
        flagUrl: "/flags/ger.svg"
      },
      worldCup: {
        id: "00000000-0000-4000-8000-000000000103",
        host: "Germany",
        year: 2006,
        label: "Germany 2006"
      },
      stats: {
        profile: "OUTFIELD",
        pace: 78,
        shooting: 86,
        passing: 96,
        dribbling: 91,
        defending: 82,
        physical: 84
      },
      tags: ["tempo"]
    });

    expect(collectObjectKeys(card)).not.toEqual(expect.arrayContaining(forbiddenPublicFields));
  });
});

function collectObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys);
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [key, ...collectObjectKeys(nestedValue)]);
}
