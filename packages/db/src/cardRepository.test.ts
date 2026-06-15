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
  "internalSourceName",
  "aliasNotes",
  "unapprovedAliases",
  "rawWinnerName",
  "awardSourceName",
  "sourceAwardWinnerName",
  "rawAwardWinnerName"
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
    const publicCard = mapRepositoryRowToPublicCard({
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

  it("returns only outfield stats for outfield cards", () => {
    const publicCard = mapRepositoryRowToPublicCard({
      ...baseRepositoryRow(),
      statProfile: "OUTFIELD",
      position: "ST",
      broadLine: "FORWARD",
      pace: 84,
      shooting: 93,
      passing: 78,
      dribbling: 87,
      defending: 47,
      physical: 88,
      diving: null,
      handling: null,
      kicking: null,
      reflexes: null,
      speed: null,
      positioning: null
    });

    expect(publicCard).toMatchObject({
      statProfile: "OUTFIELD",
      stats: {
        profile: "OUTFIELD",
        pace: 84,
        shooting: 93,
        passing: 78,
        dribbling: 87,
        defending: 47,
        physical: 88
      }
    });
    expect(collectObjectKeys(publicCard)).not.toEqual(
      expect.arrayContaining(["diving", "handling", "kicking", "reflexes", "speed", "positioning"])
    );
  });

  it("returns only goalkeeper stats for GK cards", () => {
    const publicCard = mapRepositoryRowToPublicCard({
      ...baseRepositoryRow(),
      displayName: "Emilio Duarte",
      shortName: "Duarte",
      rating: 94,
      tier: "HERO",
      cost: 10,
      position: "GK",
      broadLine: "GOALKEEPER",
      statProfile: "GOALKEEPER",
      role: "Shot Stopper",
      editionKey: "GOLDEN_GLOVE",
      materialKey: "diamond",
      pace: null,
      shooting: null,
      passing: null,
      dribbling: null,
      defending: null,
      physical: null,
      diving: 95,
      handling: 91,
      kicking: 84,
      reflexes: 96,
      speed: 56,
      positioning: 93
    });

    expect(publicCard).toMatchObject({
      statProfile: "GOALKEEPER",
      editionKey: "GOLDEN_GLOVE",
      editionLabel: "Golden Glove",
      materialKey: "black-hole",
      animationPreset: "energy-vortex",
      stats: {
        profile: "GOALKEEPER",
        diving: 95,
        handling: 91,
        kicking: 84,
        reflexes: 96,
        speed: 56,
        positioning: 93
      }
    });
    expect(collectObjectKeys(publicCard)).not.toEqual(
      expect.arrayContaining(["pace", "shooting", "passing", "dribbling", "defending", "physical"])
    );
    expect(collectObjectKeys(publicCard)).not.toEqual(expect.arrayContaining(forbiddenPublicFields));
  });
});

function mapRepositoryRowToPublicCard(row: unknown): unknown {
  const repository = new CardRepository({} as never) as unknown as {
    toPublicCard(row: unknown): unknown;
  };

  return repository.toPublicCard(row);
}

function baseRepositoryRow() {
  return {
    id: "00000000-0000-4000-8000-000000000211",
    displayName: "Santiago Valez",
    shortName: "Valez",
    rating: 90,
    tier: "WORLD_CLASS",
    cost: 7,
    position: "ST",
    broadLine: "FORWARD",
    statProfile: "OUTFIELD",
    role: "Finisher",
    editionKey: "NONE",
    materialKey: "ruby",
    nationId: "00000000-0000-4000-8000-000000000212",
    nationCode: "URU",
    nationName: "Uruguay",
    flagCode: "uru",
    flagAssetPath: "/flags/uru.svg",
    worldCupId: "00000000-0000-4000-8000-000000000213",
    host: "South Africa",
    year: 2010
  };
}

function collectObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys);
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [key, ...collectObjectKeys(nestedValue)]);
}
