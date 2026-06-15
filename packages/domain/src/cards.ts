import { z } from "zod";

export const CARD_TIERS = [
  "SQUAD_PLAYER",
  "STARTER",
  "KEY_PLAYER",
  "STAR",
  "WORLD_CLASS",
  "HERO",
  "ICON"
] as const;

export const VISIBLE_POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST"
] as const;

export const BROAD_LINES = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;

export const CARD_ROLES = [
  "Shot Stopper",
  "Anchor",
  "Wingback",
  "Ball Winner",
  "Tempo Setter",
  "Creator",
  "Wide Threat",
  "Finisher"
] as const;

export const STAT_KEYS = [
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
] as const;

export const STAT_PROFILES = ["OUTFIELD", "GOALKEEPER"] as const;

export const OUTFIELD_STAT_KEYS = [
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defending",
  "physical"
] as const;

export const GOALKEEPER_STAT_KEYS = [
  "diving",
  "handling",
  "kicking",
  "reflexes",
  "speed",
  "positioning"
] as const;

export const MATERIAL_KEYS = [
  "brass",
  "emerald",
  "amethyst",
  "sapphire",
  "ruby",
  "diamond",
  "pink-diamond",
  "matte-graphite",
  "brushed-steel",
  "emerald-composite",
  "violet-phase",
  "cobalt-gold",
  "ruby-hero",
  "black-pearl-icon",
  "ivory-gold-icon",
  "black-hole",
  "obsidian-gold",
  "solar-gold",
  "supernova",
  "dark-matter",
  "rainbow-prism"
] as const;

export const CARD_EDITION_KEYS = [
  "NONE",
  "GOLDEN_BOOT",
  "GOLDEN_BALL",
  "BEST_YOUNG_PLAYER",
  "GOLDEN_GLOVE"
] as const;

export const ANIMATION_PRESETS = [
  "none",
  "subtle-glow",
  "subtle-wave",
  "shimmer",
  "glow-pulse",
  "premium-glow",
  "radiant-burst",
  "nebula-drift",
  "iridescent-shift",
  "energy-vortex"
] as const;

export const SORT_OPTIONS = [
  "rating_desc",
  "rating_asc",
  "name_asc",
  "name_desc",
  "tier_desc",
  "tier_asc",
  "year_desc",
  "year_asc",
  "nationality_asc"
] as const;

export type CardTier = (typeof CARD_TIERS)[number];
export type VisiblePosition = (typeof VISIBLE_POSITIONS)[number];
export type BroadLine = (typeof BROAD_LINES)[number];
export type CardRole = (typeof CARD_ROLES)[number];
export type StatProfile = (typeof STAT_PROFILES)[number];
export type OutfieldStatKey = (typeof OUTFIELD_STAT_KEYS)[number];
export type GoalkeeperStatKey = (typeof GOALKEEPER_STAT_KEYS)[number];
export type StatKey = (typeof STAT_KEYS)[number];
export type MaterialKey = (typeof MATERIAL_KEYS)[number];
export type CardEditionKey = (typeof CARD_EDITION_KEYS)[number];
export type AnimationPreset = (typeof ANIMATION_PRESETS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];
export type AnimationLevel = "none" | "subtle" | "medium" | "premium";

export type CardTierConfig = {
  code: CardTier;
  label: string;
  ratingMin: number;
  ratingMax: number;
  cost: number;
  materialKey: MaterialKey;
  animationPreset: AnimationPreset;
  animationLevel: AnimationLevel;
  rank: number;
};

export type CardEditionConfig = {
  key: CardEditionKey;
  label: string | null;
  materialKeyOverride: MaterialKey | null;
  animationPresetOverride: AnimationPreset | null;
};

export const CARD_TIER_MATERIAL_SET_EXPERIMENTAL = {
  SQUAD_PLAYER: "brass",
  STARTER: "emerald",
  KEY_PLAYER: "amethyst",
  STAR: "sapphire",
  WORLD_CLASS: "ruby",
  HERO: "diamond",
  ICON: "pink-diamond"
} as const satisfies Record<CardTier, MaterialKey>;

export const CARD_EDITION_CONFIG = {
  NONE: {
    key: "NONE",
    label: null,
    materialKeyOverride: null,
    animationPresetOverride: null
  },
  GOLDEN_BOOT: {
    key: "GOLDEN_BOOT",
    label: "Golden Boot",
    materialKeyOverride: "obsidian-gold",
    animationPresetOverride: "premium-glow"
  },
  GOLDEN_BALL: {
    key: "GOLDEN_BALL",
    label: "Golden Ball",
    materialKeyOverride: "solar-gold",
    animationPresetOverride: "glow-pulse"
  },
  BEST_YOUNG_PLAYER: {
    key: "BEST_YOUNG_PLAYER",
    label: "Best Young Player",
    materialKeyOverride: "rainbow-prism",
    animationPresetOverride: "iridescent-shift"
  },
  GOLDEN_GLOVE: {
    key: "GOLDEN_GLOVE",
    label: "Golden Glove",
    materialKeyOverride: "black-hole",
    animationPresetOverride: "energy-vortex"
  }
} as const satisfies Record<CardEditionKey, CardEditionConfig>;

export const CARD_TIER_CONFIG_BY_CODE = {
  SQUAD_PLAYER: {
    code: "SQUAD_PLAYER",
    label: "Squad Player",
    ratingMin: 55,
    ratingMax: 67,
    cost: 1,
    materialKey: "brass",
    animationPreset: "none",
    animationLevel: "none",
    rank: 1
  },
  STARTER: {
    code: "STARTER",
    label: "Starter",
    ratingMin: 68,
    ratingMax: 74,
    cost: 2,
    materialKey: "emerald",
    animationPreset: "subtle-glow",
    animationLevel: "none",
    rank: 2
  },
  KEY_PLAYER: {
    code: "KEY_PLAYER",
    label: "Key Player",
    ratingMin: 75,
    ratingMax: 80,
    cost: 3,
    materialKey: "amethyst",
    animationPreset: "subtle-wave",
    animationLevel: "subtle",
    rank: 3
  },
  STAR: {
    code: "STAR",
    label: "Star",
    ratingMin: 81,
    ratingMax: 86,
    cost: 5,
    materialKey: "sapphire",
    animationPreset: "shimmer",
    animationLevel: "medium",
    rank: 4
  },
  WORLD_CLASS: {
    code: "WORLD_CLASS",
    label: "World Class",
    ratingMin: 87,
    ratingMax: 90,
    cost: 7,
    materialKey: "ruby",
    animationPreset: "glow-pulse",
    animationLevel: "medium",
    rank: 5
  },
  HERO: {
    code: "HERO",
    label: "Hero",
    ratingMin: 91,
    ratingMax: 94,
    cost: 10,
    materialKey: "diamond",
    animationPreset: "premium-glow",
    animationLevel: "premium",
    rank: 6
  },
  ICON: {
    code: "ICON",
    label: "Icon",
    ratingMin: 95,
    ratingMax: 99,
    cost: 13,
    materialKey: "pink-diamond",
    animationPreset: "premium-glow",
    animationLevel: "premium",
    rank: 7
  }
} as const satisfies Record<CardTier, CardTierConfig>;

export type PositionConfig = {
  label: string;
  broadLine: BroadLine;
};

export const POSITION_CONFIG_BY_CODE = {
  GK: { label: "GK", broadLine: "GOALKEEPER" },
  CB: { label: "CB", broadLine: "DEFENDER" },
  LB: { label: "LB", broadLine: "DEFENDER" },
  RB: { label: "RB", broadLine: "DEFENDER" },
  CDM: { label: "CDM", broadLine: "MIDFIELDER" },
  CM: { label: "CM", broadLine: "MIDFIELDER" },
  CAM: { label: "CAM", broadLine: "MIDFIELDER" },
  LM: { label: "LM", broadLine: "MIDFIELDER" },
  RM: { label: "RM", broadLine: "MIDFIELDER" },
  LW: { label: "LW", broadLine: "FORWARD" },
  RW: { label: "RW", broadLine: "FORWARD" },
  ST: { label: "ST", broadLine: "FORWARD" }
} as const satisfies Record<VisiblePosition, PositionConfig>;

export const integerStatSchema = z.number().int().min(0).max(99);

export const outfieldCardStatsSchema = z.object({
  profile: z.literal("OUTFIELD"),
  pace: integerStatSchema,
  shooting: integerStatSchema,
  passing: integerStatSchema,
  dribbling: integerStatSchema,
  defending: integerStatSchema,
  physical: integerStatSchema
});

export const goalkeeperCardStatsSchema = z.object({
  profile: z.literal("GOALKEEPER"),
  diving: integerStatSchema,
  handling: integerStatSchema,
  kicking: integerStatSchema,
  reflexes: integerStatSchema,
  speed: integerStatSchema,
  positioning: integerStatSchema
});

export const cardStatsSchema = z.discriminatedUnion("profile", [
  outfieldCardStatsSchema,
  goalkeeperCardStatsSchema
]);

export type OutfieldCardStatsDto = z.infer<typeof outfieldCardStatsSchema>;
export type GoalkeeperCardStatsDto = z.infer<typeof goalkeeperCardStatsSchema>;
export type PlayerCardStatsDto = z.infer<typeof cardStatsSchema>;

export const publicPlayerCardSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  rating: z.number().int().min(1).max(99),
  tier: z.enum(CARD_TIERS),
  cost: z.number().int().nonnegative(),
  position: z.enum(VISIBLE_POSITIONS),
  broadLine: z.enum(BROAD_LINES),
  statProfile: z.enum(STAT_PROFILES),
  nation: z.object({
    id: z.string().uuid(),
    code: z.string().min(2),
    name: z.string().min(1),
    flagCode: z.string().min(2),
    flagUrl: z.string().optional()
  }),
  worldCup: z.object({
    id: z.string().uuid(),
    host: z.string().min(1),
    year: z.number().int(),
    label: z.string().min(1)
  }),
  role: z.enum(CARD_ROLES),
  stats: cardStatsSchema,
  editionKey: z.enum(CARD_EDITION_KEYS),
  editionLabel: z.string().nullable().optional(),
  materialKey: z.enum(MATERIAL_KEYS),
  animationPreset: z.enum(ANIMATION_PRESETS),
  animationLevel: z.enum(["none", "subtle", "medium", "premium"])
});

export type PublicPlayerCardDto = z.infer<typeof publicPlayerCardSchema>;

export const cardFilterQuerySchema = z.object({
  search: z.string().trim().min(1).max(80).optional(),
  tier: z.enum(CARD_TIERS).optional(),
  minRating: z.coerce.number().int().min(1).max(99).optional(),
  maxRating: z.coerce.number().int().min(1).max(99).optional(),
  position: z.enum(VISIBLE_POSITIONS).optional(),
  broadLine: z.enum(BROAD_LINES).optional(),
  nation: z.string().trim().min(2).max(64).optional(),
  year: z.coerce.number().int().min(1930).max(2100).optional(),
  host: z.string().trim().min(1).max(80).optional(),
  role: z.enum(CARD_ROLES).optional(),
  stat: z.enum(STAT_KEYS).optional(),
  statMin: z.coerce.number().int().min(0).max(99).optional(),
  sort: z.enum(SORT_OPTIONS).default("rating_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24)
});

export type CardFilterQuery = z.input<typeof cardFilterQuerySchema>;
export type NormalizedCardFilterQuery = z.output<typeof cardFilterQuerySchema>;

export type PaginatedCardsDto = {
  items: PublicPlayerCardDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CardFilterMetadataDto = {
  tiers: CardTier[];
  positions: VisiblePosition[];
  broadLines: BroadLine[];
  roles: CardRole[];
  statKeys: StatKey[];
  statGroups: {
    outfield: OutfieldStatKey[];
    goalkeeper: GoalkeeperStatKey[];
  };
  sortOptions: SortOption[];
  nations: Array<{ id: string; code: string; name: string; flagCode: string; flagUrl?: string }>;
  years: number[];
  hosts: string[];
};

export function normalizeCardQuery(input: CardFilterQuery): NormalizedCardFilterQuery {
  const parsed = cardFilterQuerySchema.parse(input);
  if (parsed.minRating && parsed.maxRating && parsed.minRating > parsed.maxRating) {
    return {
      ...parsed,
      minRating: parsed.maxRating,
      maxRating: parsed.minRating
    };
  }
  return parsed;
}

export function deriveTier(rating: number): CardTier {
  const tier = CARD_TIERS.find((code) => {
    const config = CARD_TIER_CONFIG_BY_CODE[code];
    return rating >= config.ratingMin && rating <= config.ratingMax;
  });

  if (!tier) {
    throw new RangeError(`Rating ${rating} is outside supported card tier range 55-99.`);
  }

  return tier;
}

export function materialForTier(tier: CardTier): MaterialKey {
  return CARD_TIER_CONFIG_BY_CODE[tier].materialKey;
}

export function animationPresetForTier(tier: CardTier): AnimationPreset {
  return CARD_TIER_CONFIG_BY_CODE[tier].animationPreset;
}

export function editionLabelForKey(editionKey: CardEditionKey): string | null {
  return CARD_EDITION_CONFIG[editionKey].label;
}

export function effectiveMaterialForCard(tier: CardTier, editionKey: CardEditionKey): MaterialKey {
  return CARD_EDITION_CONFIG[editionKey].materialKeyOverride ?? materialForTier(tier);
}

export function effectiveAnimationPresetForCard(tier: CardTier, editionKey: CardEditionKey): AnimationPreset {
  return CARD_EDITION_CONFIG[editionKey].animationPresetOverride ?? animationPresetForTier(tier);
}

export function animationLevelForTier(tier: CardTier): AnimationLevel {
  return CARD_TIER_CONFIG_BY_CODE[tier].animationLevel;
}

export function costForTier(tier: CardTier): number {
  return CARD_TIER_CONFIG_BY_CODE[tier].cost;
}

export function broadLineForPosition(position: VisiblePosition): BroadLine {
  return POSITION_CONFIG_BY_CODE[position].broadLine;
}

export function statProfileForPosition(position: VisiblePosition): StatProfile {
  return position === "GK" ? "GOALKEEPER" : "OUTFIELD";
}

export function tierRank(tier: CardTier): number {
  return CARD_TIER_CONFIG_BY_CODE[tier].rank;
}
