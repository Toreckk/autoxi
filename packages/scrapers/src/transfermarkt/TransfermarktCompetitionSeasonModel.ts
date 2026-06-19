export type TransfermarktCompetitionSeasonModel = "EUROPE_CROSS_YEAR" | "CALENDAR_YEAR" | "UNKNOWN";

export type TransfermarktTournamentTiming = "SUMMER" | "WINTER";

export type TransfermarktCompetitionSeasonConfig = {
  worldCupOverrides?: Record<string, { tournamentTiming?: TransfermarktTournamentTiming }>;
  competitionSeasonModelOverrides?: Record<string, TransfermarktCompetitionSeasonModel>;
};

export const DEFAULT_COMPETITION_SEASON_MODEL_OVERRIDES: Record<string, TransfermarktCompetitionSeasonModel> = {
  GB1: "EUROPE_CROSS_YEAR",
  ES1: "EUROPE_CROSS_YEAR",
  IT1: "EUROPE_CROSS_YEAR",
  L1: "EUROPE_CROSS_YEAR",
  FR1: "EUROPE_CROSS_YEAR",
  NL1: "EUROPE_CROSS_YEAR",
  PO1: "EUROPE_CROSS_YEAR",
  BE1: "EUROPE_CROSS_YEAR",
  TR1: "EUROPE_CROSS_YEAR",
  BRA1: "CALENDAR_YEAR",
  AR1: "CALENDAR_YEAR",
  MLS1: "CALENDAR_YEAR",
  J1: "CALENDAR_YEAR",
  RS1: "CALENDAR_YEAR"
};

export const DEFAULT_TRANSFERMARKT_COMPETITION_SEASON_CONFIG: Required<TransfermarktCompetitionSeasonConfig> = {
  worldCupOverrides: {
    "2022": { tournamentTiming: "WINTER" }
  },
  competitionSeasonModelOverrides: DEFAULT_COMPETITION_SEASON_MODEL_OVERRIDES
};

export function mergeTransfermarktCompetitionSeasonConfig(
  override?: TransfermarktCompetitionSeasonConfig
): Required<TransfermarktCompetitionSeasonConfig> {
  return {
    worldCupOverrides: {
      ...DEFAULT_TRANSFERMARKT_COMPETITION_SEASON_CONFIG.worldCupOverrides,
      ...(override?.worldCupOverrides ?? {})
    },
    competitionSeasonModelOverrides: {
      ...DEFAULT_TRANSFERMARKT_COMPETITION_SEASON_CONFIG.competitionSeasonModelOverrides,
      ...(override?.competitionSeasonModelOverrides ?? {})
    }
  };
}

export function seasonModelForCompetition(
  competitionId: string | undefined,
  config?: TransfermarktCompetitionSeasonConfig
): TransfermarktCompetitionSeasonModel {
  if (!competitionId) return "EUROPE_CROSS_YEAR";
  const merged = mergeTransfermarktCompetitionSeasonConfig(config);
  return merged.competitionSeasonModelOverrides[competitionId] ?? "UNKNOWN";
}

export function tournamentTimingForWorldCup(
  worldCupYear: number,
  config?: TransfermarktCompetitionSeasonConfig
): TransfermarktTournamentTiming {
  const merged = mergeTransfermarktCompetitionSeasonConfig(config);
  return merged.worldCupOverrides[String(worldCupYear)]?.tournamentTiming ?? "SUMMER";
}

export function parseTransfermarktCompetitionSeasonConfig(value: unknown): TransfermarktCompetitionSeasonConfig {
  if (!value || typeof value !== "object") return {};
  const source = value as {
    worldCupOverrides?: unknown;
    competitionSeasonModelOverrides?: unknown;
  };
  return {
    worldCupOverrides: parseWorldCupOverrides(source.worldCupOverrides),
    competitionSeasonModelOverrides: parseSeasonModelOverrides(source.competitionSeasonModelOverrides)
  };
}

function parseWorldCupOverrides(value: unknown): TransfermarktCompetitionSeasonConfig["worldCupOverrides"] {
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([year, raw]) => {
      if (!raw || typeof raw !== "object") return [];
      const timing = (raw as { tournamentTiming?: unknown }).tournamentTiming;
      if (timing !== "SUMMER" && timing !== "WINTER") return [];
      return [[year, { tournamentTiming: timing }]];
    })
  );
}

function parseSeasonModelOverrides(value: unknown): TransfermarktCompetitionSeasonConfig["competitionSeasonModelOverrides"] {
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([competitionId, raw]) =>
      raw === "EUROPE_CROSS_YEAR" || raw === "CALENDAR_YEAR" || raw === "UNKNOWN" ? [[competitionId, raw]] : []
    )
  );
}
