import { describe, expect, it } from "vitest";
import type { PaginatedCardsDto, PublicPlayerCardDto } from "@autoxi/domain";
import { CardsController } from "./cards.controller.js";
import type { CardsService } from "./cards.service.js";

const forbiddenPublicFields = [
  "rawName",
  "sourceName",
  "internalSourceName",
  "sourcePlayerId",
  "sourceExternalId",
  "rawPayloadJson",
  "sourceImportId",
  "riskScore",
  "approvalNotes",
  "generationPrompt",
  "aliasNotes",
  "unapprovedAliases",
  "rawWinnerName",
  "awardSourceName",
  "sourceAwardWinnerName",
  "rawAwardWinnerName"
];

describe("CardsController public responses", () => {
  it("keeps GET /cards free of raw/private fields for normal, special, GK, and outfield cards", async () => {
    const controller = new CardsController(fakeCardsService(cardList));

    const response = await controller.listCards({});

    expectNoForbiddenPublicFields(response, forbiddenPublicFields);
    expect(response.items).toHaveLength(2);
    expect(response.items.some((card) => card.stats.profile === "GOALKEEPER")).toBe(true);
    expect(response.items.some((card) => card.stats.profile === "OUTFIELD")).toBe(true);
    expect(response.items.some((card) => card.editionKey !== "NONE")).toBe(true);
    expect(response.items.some((card) => card.editionKey === "NONE")).toBe(true);
  });

  it("keeps GET /cards/:id free of raw/private fields", async () => {
    const controller = new CardsController(fakeCardsService(cardList));

    const response = await controller.getCardById(specialGoalkeeperCard.id);

    expect(response).toMatchObject({
      id: specialGoalkeeperCard.id,
      editionKey: "GOLDEN_GLOVE",
      editionLabel: "Golden Glove",
      stats: { profile: "GOALKEEPER" }
    });
    expectNoForbiddenPublicFields(response, forbiddenPublicFields);
  });
});

function fakeCardsService(cards: PublicPlayerCardDto[]): CardsService {
  return {
    listCards: async () => ({
      items: cards,
      page: 1,
      pageSize: cards.length,
      totalItems: cards.length,
      totalPages: 1
    }),
    getCardById: async (id: string) => cards.find((card) => card.id === id) ?? null,
    getFilterMetadata: async () => ({
      tiers: ["SQUAD_PLAYER", "STARTER", "KEY_PLAYER", "STAR", "WORLD_CLASS", "HERO", "ICON"],
      positions: ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"],
      broadLines: ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"],
      roles: ["Shot Stopper", "Anchor", "Wingback", "Ball Winner", "Tempo Setter", "Creator", "Wide Threat", "Finisher"],
      statKeys: [
        "pace",
        "shooting",
        "passing",
        "dribbling",
        "defending",
        "physical",
        "diving",
        "handling",
        "kicking",
        "reflexes",
        "speed",
        "positioning"
      ],
      statGroups: {
        outfield: ["pace", "shooting", "passing", "dribbling", "defending", "physical"],
        goalkeeper: ["diving", "handling", "kicking", "reflexes", "speed", "positioning"]
      },
      sortOptions: ["rating_desc", "rating_asc", "name_asc", "name_desc"],
      nations: [],
      years: [],
      hosts: []
    })
  } as unknown as CardsService;
}

function expectNoForbiddenPublicFields(value: unknown, forbiddenFields: string[]): void {
  expect(collectObjectKeys(value)).not.toEqual(expect.arrayContaining(forbiddenFields));
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

const normalOutfieldCard: PublicPlayerCardDto = {
  id: "00000000-0000-4000-8000-000000000401",
  displayName: "Aurel Voss",
  shortName: "Voss",
  rating: 94,
  tier: "HERO",
  cost: 10,
  position: "CM",
  broadLine: "MIDFIELDER",
  statProfile: "OUTFIELD",
  role: "Tempo Setter",
  nation: {
    id: "00000000-0000-4000-8000-000000000402",
    code: "GER",
    name: "Germany",
    flagCode: "ger",
    flagUrl: "/flags/ger.svg"
  },
  worldCup: {
    id: "00000000-0000-4000-8000-000000000403",
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
  editionKey: "NONE",
  editionLabel: null,
  materialKey: "diamond",
  animationPreset: "premium-glow",
  animationLevel: "premium"
};

const specialGoalkeeperCard: PublicPlayerCardDto = {
  id: "00000000-0000-4000-8000-000000000404",
  displayName: "Emilio Duarte",
  shortName: "Duarte",
  rating: 94,
  tier: "HERO",
  cost: 10,
  position: "GK",
  broadLine: "GOALKEEPER",
  statProfile: "GOALKEEPER",
  role: "Shot Stopper",
  nation: {
    id: "00000000-0000-4000-8000-000000000405",
    code: "ARG",
    name: "Argentina",
    flagCode: "arg",
    flagUrl: "/flags/arg.svg"
  },
  worldCup: {
    id: "00000000-0000-4000-8000-000000000406",
    host: "Qatar",
    year: 2022,
    label: "Qatar 2022"
  },
  stats: {
    profile: "GOALKEEPER",
    diving: 95,
    handling: 91,
    kicking: 84,
    reflexes: 96,
    speed: 56,
    positioning: 93
  },
  editionKey: "GOLDEN_GLOVE",
  editionLabel: "Golden Glove",
  materialKey: "black-hole",
  animationPreset: "energy-vortex",
  animationLevel: "premium"
};

const cardList: PublicPlayerCardDto[] = [normalOutfieldCard, specialGoalkeeperCard];
