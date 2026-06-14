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

describe("API public safety", () => {
  it("keeps the forbidden public field list explicit", () => {
    expect(forbiddenPublicFields).toContain("rawName");
    expect(forbiddenPublicFields).toContain("sourceImportId");
  });
});
