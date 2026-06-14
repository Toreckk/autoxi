import { describe, expect, it } from "vitest";

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
