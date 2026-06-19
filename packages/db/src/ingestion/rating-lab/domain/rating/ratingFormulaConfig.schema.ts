import { z } from "zod";

const weightSchema = z.number().min(0).max(1);
const ratingBucketSchema = z.number().int().min(55).max(99);

export const RatingFormulaJsonSchema = z
  .object({
    version: z.string().min(1),
    selectedStrategy: z.literal("RAW_EVIDENCE"),
    sourceBlendWeights: z.object({
      highConfidenceTransfermarkt: weightSchema,
      mediumConfidenceTransfermarkt: weightSchema,
      lowConfidenceTransfermarkt: weightSchema,
      worldCupWithHighConfidenceTransfermarkt: weightSchema,
      worldCupFallbackOnly: weightSchema
    }),
    transfermarkt: z.object({
      minimumCoverageToApply: weightSchema.default(0.25),
      seasonWindow: z.object({
        enabled: z.boolean(),
        usePreviousWorldCupCycle: z.boolean(),
        weights: z.object({
          oldest: weightSchema,
          twoBack: weightSchema,
          previous: weightSchema,
          worldCupYear: weightSchema
        })
      }),
      annualSignalWeights: z.object({
        marketValuePercentile: weightSchema,
        appearanceVolume: weightSchema,
        goalContribution: weightSchema,
        assistContribution: weightSchema,
        starterShare: weightSchema,
        clubStrength: weightSchema,
        leagueStrength: weightSchema,
        ageCurve: weightSchema,
        cardsDiscipline: weightSchema
      }),
      normalizeAnnualWeightsOverAvailableSignals: z.boolean().default(true),
      minimumSignalsForHighConfidenceRating: z.number().int().min(1).max(20).default(3),
      requiredSignalsForHighConfidenceRating: z.array(z.string()).default(["marketValuePercentile", "appearanceVolume"]),
      confidenceMultipliers: z.object({
        HIGH: weightSchema,
        MEDIUM: weightSchema,
        LOW: weightSchema
      })
    }),
    fbref: z.object({
      enabled: z.boolean(),
      affectsOverallRating: z.literal(false),
      affectsStatDecomposition: z.boolean(),
      minimumMinutesForStrongSeason: z.number().int().min(0),
      normalizeByPosition: z.boolean()
    }).default({
      enabled: true,
      affectsOverallRating: false,
      affectsStatDecomposition: true,
      minimumMinutesForStrongSeason: 900,
      normalizeByPosition: true
    }),
    manualAnchors: z.object({
      enabled: z.boolean()
    }).default({
      enabled: true
    }),
    missingSeasonRules: z.object({
      normalizeWeightsOverAvailableEligibleSeasons: z.boolean(),
      underAgeSeasonIsNotExpected: z.boolean(),
      underAgeCutoff: z.number().int().min(0).max(40),
      youngPlayerAgeMax: z.number().int().min(0).max(40),
      establishedPlayerAgeMin: z.number().int().min(0).max(40),
      missingExpectedSeasonAffects: z.enum(["confidence", "seasonScoreAndConfidence"]),
      missingExpectedSeasonRatingPenalty: z.number().min(0).max(20)
    }),
    availabilityRules: z.object({
      enabled: z.boolean(),
      useMinutesPlayed: z.boolean(),
      useAppearancesWhenMinutesMissing: z.boolean(),
      lowAvailabilityAffects: z.enum(["confidence", "seasonScoreAndConfidence"]),
      minimumStrongSeasonMinutes: z.number().int().min(0),
      minimumEliteSeasonMinutes: z.number().int().min(0),
      lowMinutesScorePenaltyMax: weightSchema,
      lowMinutesConfidencePenaltyMax: weightSchema
    }),
    caps: z.object({
      generatedOnlyNoStrongSignalMax: ratingBucketSchema,
      highRatingRequiresStrongSignalMin: ratingBucketSchema,
      eliteRatingRequiresExceptionalSignalMin: ratingBucketSchema
    }),
    distributionDiagnostics: z.object({
      enabled: z.boolean(),
      warnOnly: z.boolean(),
      buckets: z.array(ratingBucketSchema).min(1)
    }),
    preview: z.object({
      showRealNamesInLocalPreview: z.boolean(),
      showMaskedNamesInPublicPreview: z.boolean()
    }),
    comparisonOnlySources: z.object({
      sevenAZeroManual: z.object({
        enabled: z.boolean(),
        affectsRating: z.literal(false),
        defaultTolerance: z.number().min(0),
        warningDelta: z.number().min(0)
      })
    })
  })
  .superRefine((config, ctx) => {
    if (config.preview.showRealNamesInLocalPreview && config.preview.showMaskedNamesInPublicPreview) {
      ctx.addIssue({
        code: "custom",
        path: ["preview"],
        message:
          "Preview name display is ambiguous: showRealNamesInLocalPreview and showMaskedNamesInPublicPreview cannot both be true."
      });
    }

    const annualSum = Object.values(config.transfermarkt.annualSignalWeights).reduce((sum, value) => sum + value, 0);
    if (Math.abs(annualSum - 1) > 0.001) {
      ctx.addIssue({
        code: "custom",
        path: ["transfermarkt", "annualSignalWeights"],
        message: `Transfermarkt annualSignalWeights must sum to 1. Current sum: ${annualSum}`
      });
    }

    const yearSum = Object.values(config.transfermarkt.seasonWindow.weights).reduce((sum, value) => sum + value, 0);
    if (Math.abs(yearSum - 1) > 0.001) {
      ctx.addIssue({
        code: "custom",
        path: ["transfermarkt", "seasonWindow", "weights"],
        message: `Season window weights must sum to 1. Current sum: ${yearSum}`
      });
    }

    if (config.availabilityRules.minimumStrongSeasonMinutes > config.availabilityRules.minimumEliteSeasonMinutes) {
      ctx.addIssue({
        code: "custom",
        path: ["availabilityRules", "minimumStrongSeasonMinutes"],
        message: "minimumStrongSeasonMinutes must be <= minimumEliteSeasonMinutes."
      });
    }

    const missing = config.missingSeasonRules;
    if (!(missing.underAgeCutoff <= missing.youngPlayerAgeMax && missing.youngPlayerAgeMax <= missing.establishedPlayerAgeMin)) {
      ctx.addIssue({
        code: "custom",
        path: ["missingSeasonRules"],
        message: "Expected underAgeCutoff <= youngPlayerAgeMax <= establishedPlayerAgeMin."
      });
    }
  });

export type RatingFormulaJsonConfig = z.infer<typeof RatingFormulaJsonSchema>;
