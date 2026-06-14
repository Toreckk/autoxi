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
});
