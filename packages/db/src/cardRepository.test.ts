import { describe, expect, it } from "vitest";
import { CardRepository } from "./cardRepository.js";

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

describe("public card safety contract", () => {
  it("tracks private fields that must stay out of public card DTOs", () => {
    expect(forbiddenPublicFields).toContain("rawName");
    expect(forbiddenPublicFields).toContain("sourceExternalId");
    expect(forbiddenPublicFields).toContain("rawPayloadJson");
  });

  it("can check nested response payloads for forbidden keys", () => {
    const publicPayload = {
      id: "card-1",
      displayName: "Aurel Voss",
      statProfile: "OUTFIELD",
      nation: { name: "Germany", flagCode: "ger" },
      stats: { profile: "OUTFIELD", pace: 78 }
    };

    expect(collectObjectKeys(publicPayload)).not.toEqual(expect.arrayContaining(forbiddenPublicFields));
  });

  it("maps repository rows to public cards without private source fields", () => {
    const repository = new CardRepository({} as never) as unknown as {
      toPublicCard(row: unknown): unknown;
    };
    const publicCard = repository.toPublicCard({
      id: "00000000-0000-4000-8000-000000000201",
      displayName: "Leo Aranda",
      shortName: "Aranda",
      rating: 98,
      tier: "ICON",
      cost: 13,
      position: "CAM",
      broadLine: "MIDFIELDER",
      statProfile: "OUTFIELD",
      role: "Creator",
      editionKey: "GOLDEN_BALL",
      materialKey: "pink-diamond",
      nationId: "00000000-0000-4000-8000-000000000202",
      nationCode: "ARG",
      nationName: "Argentina",
      flagCode: "arg",
      flagAssetPath: "/flags/arg.svg",
      worldCupId: "00000000-0000-4000-8000-000000000203",
      host: "Qatar",
      year: 2022,
      pace: 87,
      shooting: 95,
      passing: 98,
      dribbling: 99,
      defending: 48,
      physical: 78,
      diving: null,
      handling: null,
      kicking: null,
      reflexes: null,
      speed: null,
      positioning: null,
      rawName: "private source name",
      sourceExternalId: "private-id",
      rawPayloadJson: { private: true }
    });

    expect(publicCard).toMatchObject({
      displayName: "Leo Aranda",
      editionKey: "GOLDEN_BALL",
      editionLabel: "Golden Ball",
      materialKey: "solar-gold",
      animationPreset: "glow-pulse"
    });
    expect(collectObjectKeys(publicCard)).not.toEqual(expect.arrayContaining(forbiddenPublicFields));
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
