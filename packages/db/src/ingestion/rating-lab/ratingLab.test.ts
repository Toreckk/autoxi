import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  evaluateBenchmark,
  evaluateBenchmarkDistance,
  findBenchmarkCandidates,
  getBenchmarkSearchTerms
} from "./domain/evaluation/benchmarkRanges.js";
import { compareRatingLabReports } from "./domain/evaluation/compareRatingLabReports.js";
import { resolveRatingDistributionDiagnostics } from "./domain/evaluation/resolveRatingDistributionDiagnostics.js";
import {
  findSevenAZeroComparison,
  isValidOverallRating,
  loadSevenAZeroLocalJsonComparisons,
  loadSevenAZeroLocalJsonComparisonsWithWarnings
} from "./sources/seven-a-zero/compareWithSevenAZero.js";
import { estimatePreviewImportSize } from "./db-preview/estimatePreviewImportSize.js";
import { estimateOverallFromStats } from "./domain/rating/estimateOverallFromStats.js";
import { evaluateRatingGates } from "./domain/evaluation/evaluateRatingGates.js";
import { generateOverallFromFjelstulContext } from "./domain/rating/generateOverallFromFjelstulContext.js";
import { generateStatsFromOverall } from "./domain/rating/generateStatsFromOverall.js";
import { MANUAL_RATING_FLOORS } from "./sources/manual/iconicTargets.js";
import {
  loadFjelstulSample,
  loadFjelstulSampleWithReadiness,
  mapFjelstulPosition,
  playerDisplayNameFromRow,
  positionForRow
} from "./sources/fjelstul/loadFjelstulSample.js";
import { detectAnomalyDetails } from "./domain/evaluation/anomalyDetection.js";
import { evaluatePairwiseCheck } from "./domain/evaluation/pairwiseChecks.js";
import { buildReports, detectAnomalies, toCardReport, writeRatingLabReports } from "./reporting/reportWriter.js";
import { renderRatingLabPreviewHtml, writeRatingLabPreviewHtml } from "./reporting/previewHtmlWriter.js";
import { resolveCardRating } from "./domain/rating/resolveCardRating.js";
import { blendAppliedRatings } from "./domain/rating/blendAppliedRatings.js";
import { RatingFormulaJsonSchema } from "./domain/rating/ratingFormulaConfig.schema.js";
import { loadRatingFormulaConfig, mergeRatingFormulaConfig } from "./domain/rating/ratingFormulaConfig.js";
import { applyFormulaJsonConfig, loadRatingFormulaConfigFromFile } from "./config/loadRatingFormulaConfig.js";
import { prePhase1BCalibrationConfig } from "./domain/rating/ratingFormulaPresets.js";
import { runRatingLabWriteDevPreview } from "./cli/runRatingLabWriteDevPreview.js";
import { resolveRatingLabPresetOptions, runRatingLab } from "./cli/runRatingLab.js";
import { assertFjelstulAvailable, resolveRatingLabSourcePaths } from "./config/ratingLabSourcePaths.js";
import {
  evaluateSevenAZeroReference,
  evaluateSevenAZeroManualReferences,
  findManualReferenceCandidates
} from "./sources/seven-a-zero/sevenAZeroManualReferences.js";
import { createEaHistoricalAdapter } from "./sources/ea/eaHistoricalAdapter.js";
import { createRetroReferenceAdapter } from "./sources/retro/retroReferenceAdapter.js";
import { profileRegisteredSources } from "./sources/sourceRegistry.js";
import { profileTransfermarktSource } from "./sources/transfermarkt/transfermarktProfiler.js";
import { matchTransfermarktPlayer } from "./sources/transfermarkt/transfermarktMatcher.js";
import { loadTransfermarktSeasons } from "./sources/transfermarkt/loadTransfermarktSeasons.js";
import {
  discoverLocalTransfermarktPlayerIds,
  findLocalTransfermarktIdEvidence
} from "./enrichment/application/transfermarktLocalIdDiscovery.js";
import { exportEnrichmentRequests } from "./enrichment/application/exportEnrichmentRequests.js";
import { approvedProviderLinks, loadProviderPlayerLinks } from "./sources/identity/providerPlayerLinks.js";
import { profileFbrefOverlay } from "./sources/fbref/fbrefOverlayAdapter.js";
import { resolveFlagCode } from "./sources/nations/flagCodeResolver.js";
import { createStaticNationAliasIndex, normalizeNationToCode } from "./sources/nations/normalizeNation.js";
import { resolveTransfermarktSeasonBaseline } from "./sources/transfermarkt/transfermarktSeasonBaseline.js";
import {
  resolveTransfermarktMultiSeasonBaseline,
  resolveTransfermarktRating,
  worldCupCycleYears
} from "./sources/transfermarkt/transfermarktMultiSeasonBaseline.js";
import type {
  BenchmarkResult,
  BenchmarkTarget,
  FjelstulCardContext,
  RatingLabCardReport,
  RatingLabSummary,
  SevenAZeroManualReference
} from "./domain/types.js";
import { publicSafePlaceholderName } from "./utils.js";

describe("rating lab spike", () => {
  it("loads realistic Fjelstul-like CSV files with exact filename priority", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-"));
    await writeFixtureCsv(dir, "players.csv", [
      "player_id,given_name,family_name",
      "p1,Diego,Maradona",
      "p2,Backup,Keeper"
    ]);
    await writeFixtureCsv(dir, "squads.csv", [
      "player_id,tournament_id,team_id,position,appearances,minutes,goals,captain",
      "p1,wc1986,arg,CAM,7,630,5,true",
      "p2,wc1986,arg,GK,0,0,0,false"
    ]);
    await writeFixtureCsv(dir, "players_extra_awards.csv", ["player_id,player_name,year,team_code,award", "wrong,Wrong Pick,1986,ARG,Golden Boot"]);
    await writeFixtureCsv(dir, "tournaments.csv", ["tournament_id,year", "wc1986,1986"]);
    await writeFixtureCsv(dir, "teams.csv", ["team_id,team_code", "arg,ARG"]);
    await writeFixtureCsv(dir, "tournament_standings.csv", ["tournament_id,team_id,position", "wc1986,arg,1"]);
    await writeFixtureCsv(dir, "host_countries.csv", ["tournament_id,team_id", "wc1986,arg"]);
    await writeFixtureCsv(dir, "awards.csv", ["award_id,award_name", "golden_ball,Golden Ball"]);
    await writeFixtureCsv(dir, "award_winners.csv", ["tournament_id,award_id,player_id,team_id", "wc1986,golden_ball,p1,arg"]);

    const { cards, sourceReadiness } = await loadFjelstulSampleWithReadiness({ sourceDir: dir, sample: "all", seed: "test" });

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      identityKey: "fjelstul:p1",
      internalRawName: "Diego Maradona",
      position: "CAM",
      teamResult: "CHAMPION",
      host: true
    });
    expect(cards[0]?.awards).toContain("GOLDEN_BALL");
    expect(sourceReadiness).toMatchObject({
      playersRowsRead: 2,
      squadRowsRead: 2,
      tournamentRowsRead: 1,
      teamRowsRead: 1,
      standingRowsRead: 1,
      awardRowsRead: 1,
      awardWinnerRowsRead: 1,
      hostRowsRead: 1,
      requiredSourceFilesLoaded: true
    });
    expect(sourceReadiness.sourceWarnings).toEqual(expect.arrayContaining(["appearances_missing", "goals_missing"]));
    expect(sourceReadiness.requiredSourceFilesLoaded).toBe(true);
    expect(mapFjelstulPosition("PD")).toBe("RW");
    expect(mapFjelstulPosition("Goalkeeper")).toBe("GK");
  });

  it("uses fallback name and nation identity only when no player_id exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-fallback-"));
    await writeFixtureCsv(dir, "players.csv", ["player_id,given_name,family_name", "unused,Unused,Player"]);
    await writeFixtureCsv(dir, "squads.csv", ["player_name,year,team_code,position", "Solo Fallback,1994,BRA,ST"]);
    await writeFixtureCsv(dir, "tournaments.csv", ["tournament_id,year", "wc1994,1994"]);
    await writeFixtureCsv(dir, "teams.csv", ["team_id,team_code", "bra,BRA"]);

    const cards = await loadFjelstulSample({ sourceDir: dir, sample: "all", seed: "test" });

    expect(cards[0]?.identityKey).toBe("fallback:solo fallback:bra");
  });

  it("prefers team_id mapping over free-text team fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-team-id-"));
    await writeFixtureCsv(dir, "players.csv", ["player_id,given_name,family_name", "p1,Diego,Maradona"]);
    await writeFixtureCsv(dir, "squads.csv", [
      "player_id,year,team_id,team,position",
      "p1,1986,arg,Argentina Display,CAM"
    ]);
    await writeFixtureCsv(dir, "tournaments.csv", ["tournament_id,year", "wc1986,1986"]);
    await writeFixtureCsv(dir, "teams.csv", ["team_id,team_code", "arg,ARG"]);

    const cards = await loadFjelstulSample({ sourceDir: dir, sample: "all", seed: "test" });

    expect(cards[0]?.nation).toBe("ARG");
  });

  it("uses squad-derived player+tournament nation fallback for awards, appearances, and goals", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-nation-fallback-"));
    await writeFixtureCsv(dir, "players.csv", ["player_id,given_name,family_name", "p1,Diego,Maradona"]);
    await writeFixtureCsv(dir, "squads.csv", ["player_id,tournament_id,team_id,position", "p1,wc1986,arg,CAM"]);
    await writeFixtureCsv(dir, "tournaments.csv", ["tournament_id,year", "wc1986,1986"]);
    await writeFixtureCsv(dir, "teams.csv", ["team_id,team_code", "arg,ARG"]);
    await writeFixtureCsv(dir, "awards.csv", ["award_id,award_name", "golden_ball,Golden Ball"]);
    await writeFixtureCsv(dir, "award_winners.csv", ["tournament_id,award_id,player_id", "wc1986,golden_ball,p1"]);
    await writeFixtureCsv(dir, "appearances.csv", ["tournament_id,player_id,appearances,minutes", "wc1986,p1,7,630"]);
    await writeFixtureCsv(dir, "goals.csv", ["tournament_id,player_id,goals", "wc1986,p1,5"]);

    const { cards, sourceReadiness } = await loadFjelstulSampleWithReadiness({ sourceDir: dir, sample: "all", seed: "test" });

    expect(cards[0]).toMatchObject({ awards: ["GOLDEN_BALL"], appearances: 7, minutes: 630, goals: 5 });
    expect(sourceReadiness.sourceWarnings).not.toContain("player_tournament_nation_unresolved");
  });

  it("excludes women's World Cup tournament years by default and reports the denominator", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-gender-filter-"));
    await writeFixtureCsv(dir, "players.csv", [
      "player_id,given_name,family_name",
      "m1,Men,Player",
      "w1,Women,Player"
    ]);
    await writeFixtureCsv(dir, "squads.csv", [
      "player_id,tournament_id,team_id,position",
      "m1,wc1994,usa,CM",
      "w1,wwc1999,usa,CM"
    ]);
    await writeFixtureCsv(dir, "tournaments.csv", [
      "tournament_id,year,tournament_name,gender",
      "wc1994,1994,FIFA World Cup,men",
      "wwc1999,1999,FIFA Women's World Cup,women"
    ]);
    await writeFixtureCsv(dir, "teams.csv", ["team_id,team_code", "usa,USA"]);

    const defaultLoad = await loadFjelstulSampleWithReadiness({ sourceDir: dir, sample: "all", seed: "test" });
    const includeWomen = await loadFjelstulSampleWithReadiness({
      sourceDir: dir,
      sample: "all",
      seed: "test",
      includeWomensWorldCups: true
    });

    expect(defaultLoad.cards.map((card) => card.worldCupYear)).toEqual([1994]);
    expect(defaultLoad.sourceReadiness.tournamentFilterSummary).toMatchObject({
      totalCardsBeforeGenderFilter: 2,
      totalCardsAfterGenderFilter: 1,
      excludedWomenWorldCupYears: [1999]
    });
    expect(includeWomen.cards.map((card) => card.worldCupYear).sort()).toEqual([1994, 1999]);
  });

  it("does not treat player as a display-name field", () => {
    expect(playerDisplayNameFromRow({ player: "p123" })).toBe("Unknown Player");
    expect(playerDisplayNameFromRow({ player: "p123", given_name: "Diego", family_name: "Maradona" })).toBe("Diego Maradona");
  });

  it("ignores source placeholder values when building player display names", () => {
    expect(playerDisplayNameFromRow({ given_name: "not applicable", family_name: "Socrates" })).toBe("Socrates");
    expect(playerDisplayNameFromRow({ given_name: "Diego", family_name: "Maradona" })).toBe("Diego Maradona");
  });

  it("falls back to player role flags when row position text is absent", () => {
    expect(positionForRow({ goal_keeper: "1", defender: "0", midfielder: "0", forward: "0" })).toBe("GK");
    expect(positionForRow({ goal_keeper: "0", defender: "0", midfielder: "0", forward: "1" })).toBe("ST");
    expect(positionForRow({ goal_keeper: "0", defender: "1", midfielder: "0", forward: "0" })).toBe("CB");
    expect(positionForRow({ position_name: "goal keeper", goal_keeper: "0" })).toBe("GK");
    expect(positionForRow({ position_code: "FW", midfielder: "1" })).toBe("ST");
  });

  it("marks missing required source files as readiness failures without failing optional files", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "rating-lab-empty-"));
    const missing = await loadFjelstulSampleWithReadiness({ sourceDir: emptyDir, sample: "all", seed: "test" });

    expect(missing.cards).toHaveLength(0);
    expect(missing.sourceReadiness.requiredSourceFilesLoaded).toBe(false);
    expect(missing.sourceReadiness.sourceWarnings).toEqual(
      expect.arrayContaining(["players_missing", "squads_missing", "tournaments_missing", "teams_missing"])
    );
  });

  it("generates deterministic overall ratings with award floors, team result, goals, and clamps", () => {
    const context = cardContext({
      awards: ["GOLDEN_BALL"],
      teamResult: "CHAMPION",
      goals: 5,
      appearances: 7,
      minutes: 630
    });

    const first = generateOverallFromFjelstulContext(context);
    const second = generateOverallFromFjelstulContext(context);

    expect(first).toEqual(second);
    expect(first.overall).toBeGreaterThanOrEqual(95);
    expect(first.overall).toBeLessThanOrEqual(99);
    expect(first.modifiers.some((modifier) => modifier.key === "team_result_champion")).toBe(true);
    expect(first.modifiers.some((modifier) => modifier.key === "goals")).toBe(true);
  });

  it("keeps no-appearance generated ratings in the 55-99 range", () => {
    const result = generateOverallFromFjelstulContext(
      cardContext({ appearances: 0, minutes: 0, goals: 0, teamResult: "UNKNOWN" })
    );

    expect(result.overall).toBeGreaterThanOrEqual(55);
    expect(result.overall).toBeLessThanOrEqual(99);
  });

  it("caps generated no-signal ratings at 78", () => {
    const result = generateOverallFromFjelstulContext(
      cardContext({
        appearances: 0,
        minutes: 0,
        goals: 0,
        awards: [],
        teamResult: "CHAMPION",
        captain: false,
        host: true,
        samePlayerEditionCount: 5
      })
    );

    expect(result.overall).toBeLessThanOrEqual(78);
  });

  it("caps limited-signal generated ratings at 84", () => {
    const result = generateOverallFromFjelstulContext(
      cardContext({ appearances: 2, minutes: 120, goals: 0, awards: [], teamResult: "CHAMPION", captain: false })
    );

    expect(result.overall).toBeLessThanOrEqual(84);
  });

  it("allows award floors to exceed generated caps", () => {
    const result = generateOverallFromFjelstulContext(
      cardContext({ appearances: 0, minutes: 0, goals: 0, awards: ["GOLDEN_BALL"], teamResult: "UNKNOWN", captain: false })
    );

    expect(result.overall).toBeGreaterThanOrEqual(95);
  });

  it("does not cap generated Golden Boot ratings below the absolute 99 clamp", () => {
    const result = generateOverallFromFjelstulContext(
      cardContext({ awards: ["GOLDEN_BOOT"], goals: 8, teamResult: "CHAMPION", appearances: 7, minutes: 630 })
    );

    expect(result.reasons).not.toContain("generated award cap applied");
    expect(result.overall).toBeLessThanOrEqual(99);
  });

  it("generates deterministic profile-specific stats and estimates overall", () => {
    const outfield = generateStatsFromOverall({ overall: 88, position: "CAM", role: "Creator", seed: "stats" });
    const outfieldAgain = generateStatsFromOverall({ overall: 88, position: "CAM", role: "Creator", seed: "stats" });
    const goalkeeper = generateStatsFromOverall({ overall: 90, position: "GK", role: "Shot Stopper", seed: "stats" });

    expect(outfield).toEqual(outfieldAgain);
    expect(outfield.profile).toBe("OUTFIELD");
    expect(goalkeeper.profile).toBe("GOALKEEPER");
    for (const value of Object.values(outfield).filter((value) => typeof value === "number")) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(99);
    }
    expect(Math.abs(estimateOverallFromStats({ position: "CAM", stats: outfield }) - 88)).toBeLessThanOrEqual(4);
  });

  it("warns when supplied stats do not explain the visible overall", () => {
    const resolved = resolveCardRating(cardContext({ position: "CAM" }), {
      eaHistorical: [
        {
          normalizedName: "test player",
          worldCupYear: 1986,
          overall: 95,
          confidence: "HIGH",
          reason: "fixture",
          stats: {
            profile: "OUTFIELD",
            pace: 55,
            shooting: 55,
            passing: 55,
            dribbling: 55,
            defending: 55,
            physical: 55
          }
        }
      ]
    });

    expect(resolved.primarySource).toBe("EA_HISTORICAL");
    expect(resolved.warnings.map((warning) => warning.code)).toContain("overall_stat_delta_gt_4");
  });

  it("does not use low-confidence EA stats when a manual floor supplies the visible overall", () => {
    const resolved = resolveCardRating(
      cardContext({ internalRawName: "Ronaldo Nazario", nation: "BRA", worldCupYear: 2002, appearances: 1, minutes: 90 }),
      {
        manualCurated: MANUAL_RATING_FLOORS,
        eaHistorical: [
          {
            normalizedName: "ronaldo nazario",
            nation: "BRA",
            worldCupYear: 2002,
            overall: 78,
            confidence: "LOW",
            reason: "low-confidence fixture",
            stats: {
              profile: "OUTFIELD",
              pace: 55,
              shooting: 55,
              passing: 55,
              dribbling: 55,
              defending: 55,
              physical: 55
            }
          }
        ]
      }
    );

    expect(resolved.primarySource).toBe("MANUAL_CURATED");
    expect(resolved.overall).toBeGreaterThanOrEqual(95);
    expect(resolved.overallStatDelta).toBeLessThanOrEqual(4);
  });

  it("parses and matches local 7a0 JSON without applying it by default", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-7a0-"));
    await writeFile(
      join(dir, "uru-1954.json"),
      JSON.stringify({ sel: "URU", copa: 1954, squad: [{ name: "Luis Castro", sel: "URU", copa: 1954, f: 74 }] }),
      "utf8"
    );

    const comparisons = await loadSevenAZeroLocalJsonComparisons(dir);
    const match = findSevenAZeroComparison(
      { internalRawName: "Luis Castro", nation: "URU", worldCupYear: 1954 },
      comparisons
    );

    expect(comparisons).toHaveLength(1);
    expect(match?.rating).toBe(74);
  });

  it("keeps 7a0 manual references comparison-only without special-case manual anchors", () => {
    const resolved = resolveCardRating(
      cardContext({
        internalRawName: "Diego Maradona",
        nation: "ARG",
        worldCupYear: 1982,
        appearances: 5,
        minutes: 450,
        goals: 2,
        teamResult: "UNKNOWN"
      }),
      { manualCurated: MANUAL_RATING_FLOORS }
    );

    expect(resolved.primarySource).toBe("FJELSTUL_GENERATED");
    expect(resolved.evidence.map((evidence) => evidence.source)).not.toContain("SEVEN_A_ZERO_COMPARISON");
    expect(resolved.breakdown?.comparisonReferences).toHaveLength(0);
  });

  it("chooses the strongest matching manual floor when curated sources overlap", () => {
    const resolved = resolveCardRating(cardContext({ internalRawName: "Franz Beckenbauer", nation: "DEU", worldCupYear: 1974 }), {
      manualCurated: [
        {
          id: "fixture-beckenbauer-floor",
          nameSearch: "Beckenbauer",
          nationCode: "FRG",
          worldCupYear: 1974,
          floor: 94,
          reason: "fixture floor"
        }
      ]
    });

    expect(resolved.primarySource).toBe("MANUAL_CURATED");
    expect(resolved.overall).toBeGreaterThanOrEqual(94);
  });

  it("validates optional local 7a0 JSON ratings before using player.f", async () => {
    expect(isValidOverallRating(74)).toBe(true);
    expect(isValidOverallRating(95)).toBe(true);
    expect(isValidOverallRating(218)).toBe(false);
    expect(isValidOverallRating(null)).toBe(false);
    expect(isValidOverallRating("95")).toBe(false);

    const dir = await mkdtemp(join(tmpdir(), "rating-lab-7a0-invalid-"));
    await writeFile(
      join(dir, "sample.json"),
      JSON.stringify({
        sel: "BRA",
        copa: 1974,
        squad: [
          { name: "Rivelino", sel: "BRA", copa: 1974, f: 92 },
          { name: "Impossible", sel: "BRA", copa: 1974, f: 218 }
        ]
      }),
      "utf8"
    );

    const comparisons = await loadSevenAZeroLocalJsonComparisons(dir);

    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]?.internalName).toBe("Rivelino");
  });

  it("surfaces local 7a0 JSON validation warnings in the rating-lab summary", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "rating-lab-source-"));
    const sevenAZeroDir = await mkdtemp(join(tmpdir(), "rating-lab-7a0-warnings-"));
    const outputDir = await mkdtemp(join(tmpdir(), "rating-lab-output-"));
    await writeFixtureCsv(sourceDir, "players.csv", ["player_id,given_name,family_name", "p1,Luis,Castro"]);
    await writeFixtureCsv(sourceDir, "squads.csv", ["player_id,year,team_id,position", "p1,1954,uru,CM"]);
    await writeFixtureCsv(sourceDir, "tournaments.csv", ["tournament_id,year", "wc1954,1954"]);
    await writeFixtureCsv(sourceDir, "teams.csv", ["team_id,team_code", "uru,URU"]);
    await writeFile(
      join(sevenAZeroDir, "uru-1954.json"),
      JSON.stringify({ sel: "URU", copa: 1954, squad: [{ name: "Luis Castro", sel: "URU", copa: 1954, f: 218 }] }),
      "utf8"
    );

    await runRatingLab({
      sourceDir,
      sevenAZeroDir,
      sample: "all",
      randomCount: 10,
      seed: "test",
      outputDir
    });
    const summary = JSON.parse(await readFile(join(outputDir, "latest-summary.json"), "utf8")) as RatingLabSummary;

    expect(summary.sourceWarnings).toContain("seven_a_zero_rating_out_of_range");
    expect(summary.warningsByCode.seven_a_zero_rating_out_of_range).toBe(1);
  });

  it("returns local 7a0 JSON validation warning details", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-7a0-warning-details-"));
    await writeFile(
      join(dir, "sample.json"),
      JSON.stringify({ sel: "BRA", copa: 1974, squad: [{ name: "Bad Rating", sel: "BRA", copa: 1974, f: "95" }] }),
      "utf8"
    );

    const result = await loadSevenAZeroLocalJsonComparisonsWithWarnings(dir);

    expect(result.comparisons).toHaveLength(0);
    expect(result.warnings).toEqual([
      { code: "seven_a_zero_rating_field_unknown", file: "sample.json", playerName: "Bad Rating" }
    ]);
  });

  it("evaluates benchmark pass, warn, fail, and missing states", () => {
    const target = benchmarkTarget({
      nameSearch: "Maradona",
      worldCupYear: 1986,
      expectedRatingMin: 96,
      expectedRatingMax: 99
    });

    expect(evaluateBenchmark(target, [report({ internalRawName: "Diego Maradona", overall: 97 })]).status).toBe("PASS");
    expect(evaluateBenchmark(target, [report({ internalRawName: "Diego Maradona", overall: 94 })]).status).toBe("WARN");
    expect(evaluateBenchmark(target, [report({ internalRawName: "Diego Maradona", overall: 90 })]).status).toBe("FAIL");
    expect(evaluateBenchmark(target, []).status).toBe("MISSING");
    expect(evaluateBenchmarkDistance(100, 96, 99)).toBe(1);
  });

  it("matches benchmarks by aliases, accents, and nation code", () => {
    const target = benchmarkTarget({
      nameSearch: "Pele",
      aliases: ["Pelé", "Edson Arantes"],
      worldCupYear: 1970,
      nationCode: "BRA",
      expectedRatingMin: 95,
      expectedRatingMax: 99
    });
    const cards = [
      report({ internalRawName: "Edson Arantes do Nascimento", nation: "BRA", worldCupYear: 1970, overall: 97 }),
      report({ internalRawName: "Pele Example", nation: "POR", worldCupYear: 1970, overall: 80 })
    ];
    const result = evaluateBenchmark(target, cards);

    expect(getBenchmarkSearchTerms(target)).toContain("Pelé");
    expect(findBenchmarkCandidates(target, cards)).toHaveLength(1);
    expect(result.status).toBe("PASS");
    expect(result.matchedInternalRawName).toBe("Edson Arantes do Nascimento");
    expect(result.matchedNation).toBe("BRA");
  });

  it("returns ambiguous benchmark results when multiple equally plausible candidates match", () => {
    const target = benchmarkTarget({ nameSearch: "Ronaldo", worldCupYear: 2002, nationCode: "BRA" });
    const result = evaluateBenchmark(target, [
      report({ internalRawName: "Ronaldo One", nation: "BRA", worldCupYear: 2002, overall: 96 }),
      report({ internalRawName: "Ronaldo Two", nation: "BRA", worldCupYear: 2002, overall: 92 })
    ]);

    expect(result.status).toBe("AMBIGUOUS");
    expect(result.actualRating).toBeNull();
    expect(result.candidateCount).toBe(2);
    expect(result.candidateNames).toEqual(["Ronaldo One", "Ronaldo Two"]);
  });

  it("prefers a clear exact benchmark candidate over broader alias matches", () => {
    const target = benchmarkTarget({ nameSearch: "Edu", worldCupYear: 1974, nationCode: "BRA" });
    const result = evaluateBenchmark(target, [
      report({ internalRawName: "Edu", nation: "BRA", worldCupYear: 1974, overall: 80 }),
      report({ internalRawName: "Eduardo Silva", nation: "BRA", worldCupYear: 1974, overall: 70 })
    ]);

    expect(result.status).toBe("PASS");
    expect(result.matchedInternalRawName).toBe("Edu");
  });

  it("evaluates 7a0 manual references with pass, warn, fail, missing, and ambiguous states", () => {
    const reference = manualReference({
      playerName: "Raul",
      aliases: ["Raúl"],
      nationCode: "ESP",
      worldCupYear: 2002,
      referenceOverall: 89,
      tolerance: 4
    });

    expect(evaluateSevenAZeroReference(reference, [report({ internalRawName: "Raúl", nation: "ESP", worldCupYear: 2002, overall: 92 })]).status).toBe("PASS");
    expect(evaluateSevenAZeroReference(reference, [report({ internalRawName: "Raul", nation: "ESP", worldCupYear: 2002, overall: 95 })]).status).toBe("WARN");
    expect(evaluateSevenAZeroReference(reference, [report({ internalRawName: "Raul", nation: "ESP", worldCupYear: 2002, overall: 97 })]).status).toBe("FAIL");
    expect(evaluateSevenAZeroReference(reference, []).status).toBe("MISSING");

    const ambiguous = evaluateSevenAZeroReference(reference, [
      report({ internalRawName: "Raul One", nation: "ESP", worldCupYear: 2002, overall: 89 }),
      report({ internalRawName: "Raul Two", nation: "ESP", worldCupYear: 2002, overall: 88 })
    ]);
    expect(ambiguous.status).toBe("AMBIGUOUS");
    expect(ambiguous.candidateNames).toEqual(["Raul One", "Raul Two"]);
  });

  it("finds 7a0 manual references through aliases and historical nation-code aliases", () => {
    const reference = manualReference({
      playerName: "Beckenbauer",
      aliases: ["Franz Beckenbauer"],
      nationCode: "FRG",
      worldCupYear: 1974,
      referenceOverall: 97,
      tolerance: 3
    });
    const cards = [report({ internalRawName: "Franz Beckenbauer", nation: "GER", worldCupYear: 1974, overall: 96 })];
    const result = evaluateSevenAZeroReference(reference, cards);

    expect(findManualReferenceCandidates(reference, cards)).toHaveLength(1);
    expect(result.status).toBe("PASS");
    expect(result.delta).toBe(-1);
  });

  it("exposes the full manual 7a0 reference evaluator", () => {
    const results = evaluateSevenAZeroManualReferences([
      report({ internalRawName: "Rivelino", nation: "BRA", worldCupYear: 1974, overall: 92 })
    ]);

    expect(results.some((result) => result.id === "7a0-bra-1974-rivelino" && result.status === "PASS")).toBe(true);
  });

  it("writes a dedicated manual 7a0 reference CSV report", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "rating-lab-reports-"));
    const reports = buildReports({
      cards: [report({ internalRawName: "Rivelino", nation: "BRA", worldCupYear: 1974, overall: 92 })],
      sourceDir: "fixture",
      sampleMode: "all",
      seed: "test",
      sourceReadiness: sourceReadinessFixture()
    });

    const paths = await writeRatingLabReports({ reports, outputDir, timestamp: "fixture" });
    const manualReportPath = paths.find((path) => path.endsWith("rating-lab-seven-a-zero-manual-references-fixture.csv"));
    expect(manualReportPath).toBeDefined();
    expect(reports.summary.sevenAZeroManualMatched).toBeGreaterThan(0);
    expect(await readFile(manualReportPath!, "utf8")).toContain(
      "referenceId,playerName,aliases,worldCupYear,nationCode,referenceOverall,actualRating,delta,status,matchedInternalRawName,matchedPublicName,candidateNames,tolerance,reason"
    );
  });

  it("writes Transfermarkt merge-readiness and identity status reports", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "rating-lab-tm-readiness-"));
    const reports = buildReports({
      cards: [
        report({
          internalRawName: "OneName",
          debugRealName: "OneName",
          nation: "BRA",
          worldCupYear: 2002,
          overall: 91,
          tier: "ICON",
          transfermarktIdentityConfidence: "HIGH",
          transfermarktIdentityCoverage: true,
          transfermarktContextCoverage: true,
          transfermarktRatingEvidenceCoverage: false,
          transfermarktAppliedRatingCoverage: false,
          transfermarktPlayerId: "fixture-tm-1",
          transfermarktRatingEvidenceReason: "real_transfermarkt_season_stats_not_imported"
        }),
        report({
          internalRawName: "Fake Evidence",
          worldCupYear: 2002,
          overall: 88,
          tier: "WORLD_CLASS",
          transfermarktIdentityCoverage: true,
          transfermarktRatingEvidenceCoverage: true,
          evidenceSummary: "TRANSFERMARKT:HIGH:80:transfermarkt_squad_presence"
        })
      ],
      sourceDir: "fixture",
      sampleMode: "all",
      seed: "test",
      sourceReadiness: sourceReadinessFixture()
    });

    const paths = await writeRatingLabReports({ reports, outputDir, timestamp: "fixture" });
    const mergeReadinessPath = paths.find((path) => path.endsWith("rating-lab-transfermarkt-merge-readiness-fixture.json"));
    const highPriorityPath = paths.find((path) => path.endsWith("rating-lab-transfermarkt-high-priority-coverage-fixture.csv"));
    const oneTokenPath = paths.find((path) => path.endsWith("rating-lab-transfermarkt-one-token-status-fixture.csv"));

    expect(mergeReadinessPath).toBeDefined();
    expect(highPriorityPath).toBeDefined();
    expect(oneTokenPath).toBeDefined();
    expect(await readFile(mergeReadinessPath!, "utf8")).toContain('"fakeRatingEvidenceCount": 1');
    expect(await readFile(highPriorityPath!, "utf8")).toContain("rating_evidence_missing_reason");
    expect(await readFile(oneTokenPath!, "utf8")).toContain("OneName");
  });

  it("writes a static HTML preview with escaped dev-only raw text", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "rating-lab-preview-"));
    const summary = summaryFixture({
      cardSnapshots: [
        {
          ...summaryFixture().cardSnapshots[0]!,
          internalRawName: "<script>alert(1)</script>",
          publicPlaceholderName: "ARG-1986-CAM-SAFE"
        }
      ],
      confidenceGateReasons: ["fixture gate"]
    });
    const outputPath = join(outputDir, "rating-lab-preview.html");

    await writeRatingLabPreviewHtml({ summary, outputPath });
    const html = await readFile(outputPath, "utf8");

    expect(html).toContain("Rating Lab Preview");
    expect(html).toContain("fixture gate");
    expect(html).toContain("Identity coverage");
    expect(html).toContain("TM Rating Evidence");
    expect(html).toContain("High-Priority Transfermarkt Identity Status");
    expect(html).toContain("One-Token Name Auto-Detection Status");
    expect(html).toContain("Merge Readiness");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("renders preview sections for top cards and 7a0 manual deltas", () => {
    const html = renderRatingLabPreviewHtml(
      summaryFixture({
        sevenAZeroManualAverageAbsoluteDelta: 3,
        sevenAZeroManualDeltaP90: 5
      })
    );

    expect(html).toContain("Top Cards By Tournament");
    expect(html).toContain("7a0 Manual Reference Deltas");
  });

  it("estimates dev preview import size conservatively", () => {
    const estimate = estimatePreviewImportSize(summaryFixture(), 500);

    expect(estimate.cardsToWrite).toBe(1);
    expect(estimate.estimatedTotalRows).toBeGreaterThan(estimate.cardsToWrite);
    expect(estimate.estimatedStorageMb).toBeGreaterThan(0);
  });

  it("refuses dev preview without required safety flags", async () => {
    await expect(runRatingLabWriteDevPreview(["--report", "missing.json"])).rejects.toThrow("--dev-only");
  });

  it("allows dev preview estimate-only without DATABASE_URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-dev-preview-"));
    const reportPath = join(dir, "latest-summary.json");
    await writeFile(reportPath, JSON.stringify(summaryFixture()), "utf8");

    const message = await runRatingLabWriteDevPreview([
      "--report",
      reportPath,
      "--max-cards",
      "500",
      "--dev-only",
      "--estimate-only"
    ]);

    expect(message).toContain("Rating lab dev preview estimate");
  });

  it("refuses dev preview writes without DATABASE_URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-dev-preview-write-"));
    const reportPath = join(dir, "latest-summary.json");
    await writeFile(reportPath, JSON.stringify(summaryFixture()), "utf8");
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";

    try {
      await expect(
        runRatingLabWriteDevPreview([
          "--report",
          reportPath,
          "--max-cards",
          "500",
          "--dev-only",
          "--reset-rating-lab-preview"
        ])
      ).rejects.toThrow("DATABASE_URL");
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });

  it("reports skeleton external rating adapters as unavailable", async () => {
    const ea = createEaHistoricalAdapter();
    const retro = createRetroReferenceAdapter();

    expect((await ea.load({ mode: "report-only" })).warnings).toContain("source_unavailable");
    expect((await retro.load({ sourceDir: "missing", mode: "report-only" })).warnings).toContain("source_unavailable");
    expect(ea.findCandidates(cardContext())).toHaveLength(0);
  });

  it("marks local skeleton source folders as present but not implemented", async () => {
    const root = await mkdtemp(join(tmpdir(), "rating-lab-sources-"));
    const clubEloDir = join(root, "data", "sources", "club-elo");
    await mkdir(clubEloDir, { recursive: true });
    await writeFixtureCsv(clubEloDir, "club_elo_1982-06-13.csv", ["Rank,Club,Elo", "1,Liverpool,1900"]);
    const resolved = resolveRatingLabSourcePaths({ cwd: root, env: {} });

    const availability = await profileRegisteredSources(resolved);
    const clubElo = availability.find((source) => source.sourceKey === "CLUB_ELO");

    expect(clubElo).toMatchObject({
      status: "available",
      warnings: ["adapter_not_implemented"],
      rowCount: 1
    });
  });

  it("keeps domain files independent from IO and adapter layers", async () => {
    const files = await listTypeScriptFiles(join(process.cwd(), "src", "ingestion", "rating-lab", "domain"));
    const forbidden = [
      /from "node:/,
      /from '\s*node:/,
      /process\./,
      /\.\.\/\.\.\/sources\//,
      /\.\.\/\.\.\/reporting\//,
      /\.\.\/\.\.\/db-preview\//,
      /\.\.\/\.\.\/cli\//
    ];

    for (const file of files) {
      const contents = await readFile(file, "utf8");
      expect(
        forbidden.some((pattern) => pattern.test(contents)),
        `${file} imports an infrastructure layer or runtime API`
      ).toBe(false);
    }
  });

  it("applies manual floors only to matching nation and year", () => {
    const matching = resolveCardRating(
      cardContext({ internalRawName: "Ronaldo Nazario", nation: "BRA", worldCupYear: 2002, appearances: 1, minutes: 90 }),
      { manualCurated: MANUAL_RATING_FLOORS }
    );
    const wrongYear = resolveCardRating(
      cardContext({ internalRawName: "Ronaldo Nazario", nation: "BRA", worldCupYear: 2006, appearances: 1, minutes: 90 }),
      { manualCurated: MANUAL_RATING_FLOORS }
    );
    const wrongNation = resolveCardRating(
      cardContext({ internalRawName: "Cristiano Ronaldo", nation: "POR", worldCupYear: 2002, appearances: 1, minutes: 90 }),
      { manualCurated: MANUAL_RATING_FLOORS }
    );

    expect(matching.primarySource).toBe("MANUAL_CURATED");
    expect(matching.overall).toBeGreaterThanOrEqual(95);
    expect(wrongYear.primarySource).not.toBe("MANUAL_CURATED");
    expect(wrongNation.primarySource).not.toBe("MANUAL_CURATED");
  });

  it("keeps Neuer 2014 as a protective floor below max rating", () => {
    const neuerFloor = MANUAL_RATING_FLOORS.find((floor) => floor.id === "manual-neuer-2014");
    const openEndedFloors = MANUAL_RATING_FLOORS.filter((floor) => floor.worldCupYear === undefined);

    expect(neuerFloor?.floor).toBe(92);
    expect(neuerFloor?.floor).toBeLessThan(99);
    expect(openEndedFloors).toHaveLength(0);
  });

  it("detects anomaly rules and public-safe placeholder naming", () => {
    const placeholder = publicSafePlaceholderName({
      nation: "ARG",
      worldCupYear: 1986,
      position: "CAM",
      identityKey: "diego-maradona-arg-1986"
    });
    const anomalies = detectAnomalies([
      report({
        internalRawName: "Unknown Player",
        overall: 91,
        primarySource: "FJELSTUL_GENERATED",
        appearances: 0,
        goals: 0,
        warnings: ""
      })
    ]);

    expect(placeholder).not.toContain("diego");
    expect(anomalies[0]?.warnings).toContain("unknown_high_rating");
    expect(anomalies[0]?.warnings).toContain("no_appearance_high_rating");
  });

  it("marks generated-only tournament top-three as warning for partial samples", () => {
    const anomalies = detectAnomalyDetails([
      report({ internalRawName: "Generated Star", worldCupYear: 1970, nation: "BRA", overall: 91, primarySource: "FJELSTUL_GENERATED" }),
      report({ internalRawName: "Curated Star", worldCupYear: 1970, nation: "BRA", overall: 90, primarySource: "MANUAL_CURATED" }),
      report({ internalRawName: "Known Star", worldCupYear: 1970, nation: "ITA", overall: 89, primarySource: "MANUAL_CURATED" })
    ], { sampleMode: "iconic-plus-random" });

    expect(anomalies.find((anomaly) => anomaly.code === "generated_only_top3_tournament")?.severity).toBe("WARNING");
  });

  it("marks generated-only tournament top-three as hard fail for full samples", () => {
    const anomalies = detectAnomalyDetails([
      report({ internalRawName: "Generated Star", worldCupYear: 1970, nation: "BRA", overall: 91, primarySource: "FJELSTUL_GENERATED" }),
      report({ internalRawName: "Curated Star", worldCupYear: 1970, nation: "BRA", overall: 90, primarySource: "MANUAL_CURATED" }),
      report({ internalRawName: "Known Star", worldCupYear: 1970, nation: "ITA", overall: 89, primarySource: "MANUAL_CURATED" })
    ], { sampleMode: "all" });

    expect(anomalies.find((anomaly) => anomaly.code === "generated_only_top3_tournament")?.severity).toBe("HARD_FAIL");
  });

  it("builds a report row from a resolved card", () => {
    const context = cardContext({ internalRawName: "Lionel Messi", worldCupYear: 2022, nation: "ARG" });
    const resolved = resolveCardRating(context, {
      manualCurated: [
        {
          id: "fixture-messi-2022",
          nameSearch: "Messi",
          aliases: ["Lionel Messi"],
          nationCode: "ARG",
          worldCupYear: 2022,
          floor: 96,
          reason: "fixture floor"
        }
      ]
    });
    const row = toCardReport({ context, resolved });

    expect(row.primarySource).toBe("MANUAL_CURATED");
    expect(row.overall).toBeGreaterThanOrEqual(96);
    expect(row.publicPlaceholderName).not.toContain("Messi");
    expect(row.baseRating).not.toBeNull();
    expect(row.sourceTypes).toContain("MANUAL_CURATED");
    expect(row.manualFloorApplied).toBe("true");
    expect(row.finalOverall).toBe(row.overall);
  });

  it("does not double-count anomaly warnings already present on card rows", () => {
    const reports = buildReports({
      cards: [
        report({
          internalRawName: "Generated Star",
          overall: 91,
          primarySource: "FJELSTUL_GENERATED",
          warnings: "unknown_high_rating"
        })
      ],
      sourceDir: "fixture",
      sampleMode: "all",
      seed: "test",
      sourceReadiness: sourceReadinessFixture()
    });

    expect(reports.summary.warningsByCode.unknown_high_rating).toBe(1);
  });

  it("counts source coverage from structured sourceTypes instead of reason strings", () => {
    const reports = buildReports({
      cards: [
        report({
          primarySource: "FJELSTUL_GENERATED",
          sourceTypes: "FJELSTUL_GENERATED|RETRO_REFERENCE",
          reasons: ""
        })
      ],
      sourceDir: "fixture",
      sampleMode: "all",
      seed: "test",
      sourceReadiness: sourceReadinessFixture()
    });

    expect(reports.summary.cardsWithRetroReference).toBe(1);
  });

  it("documents the 7a0 manual reference CSV and local JSON distinction", async () => {
    const docs = await readFile(join(process.cwd(), "..", "..", "docs", "spikes", "pre-phase-1b-rating-lab.md"), "utf8");

    expect(docs).toContain("rating-lab-seven-a-zero-manual-references-*.csv");
    expect(docs).toContain("manual references");
    expect(docs).toContain("local JSON comparison");
  });

  it("evaluates gates as ready when hard failures and warnings are clear", () => {
    const evaluation = evaluateRatingGates(summaryFixture());

    expect(evaluation.status).toBe("READY_FOR_PHASE_1B");
    expect(evaluation.hardFailures).toHaveLength(0);
  });

  it("evaluates gates as needs tuning for warning thresholds", () => {
    const evaluation = evaluateRatingGates(
      summaryFixture({
        sevenAZeroManualAverageAbsoluteDelta: 6
      })
    );

    expect(evaluation.status).toBe("NEEDS_TUNING");
    expect(evaluation.warnings.some((warning) => warning.key === "seven_a_zero_manual_average_delta")).toBe(true);
  });

  it("evaluates gates as blocked when no meaningful ratings exist", () => {
    const evaluation = evaluateRatingGates(
      summaryFixture({
        totalCardsSampled: 0,
        cardsResolved: 0,
        cardSnapshots: []
      })
    );

    expect(evaluation.status).toBe("BLOCKED_BY_SOURCE_QUALITY");
  });

  it("separates hard gate failures from warning failures", () => {
    const evaluation = evaluateRatingGates(
      summaryFixture({
        benchmarks: [benchmarkResult({ status: "FAIL" })],
        sevenAZeroManualDeltaP90: 10
      })
    );

    expect(evaluation.hardFailures.some((failure) => failure.key === "benchmark_fails")).toBe(true);
    expect(evaluation.warnings.some((warning) => warning.key === "seven_a_zero_manual_p90_delta")).toBe(true);
  });

  it("compares report summaries for rating and benchmark status changes", () => {
    const baseline = summaryFixture();
    const current = summaryFixture({
      benchmarks: [benchmarkResult({ id: "fixture-target", status: "WARN" })],
      cardSnapshots: [
        {
          ...baseline.cardSnapshots[0]!,
          overall: 84,
          tier: "STAR",
          primarySource: "MANUAL_CURATED"
        }
      ]
    });
    const diff = compareRatingLabReports(baseline, current);

    expect(diff.ratingChanges).toHaveLength(1);
    expect(diff.tierChanges).toHaveLength(1);
    expect(diff.benchmarkStatusChanges).toHaveLength(1);
    expect(diff.sourceProvenanceChanges).toHaveLength(1);
  });

  it("evaluates pairwise checks with pass, warning, missing, and ambiguous states", () => {
    const check = {
      id: "fixture-pairwise",
      higher: { nameSearch: "Higher", nationCode: "ARG", worldCupYear: 1986 },
      lower: { nameSearch: "Lower", nationCode: "ARG", worldCupYear: 1986 },
      minGap: 2,
      severity: "WARNING" as const,
      reason: "fixture"
    };

    expect(
      evaluatePairwiseCheck(check, [
        report({ internalRawName: "Higher", overall: 90 }),
        report({ internalRawName: "Lower", overall: 86 })
      ]).status
    ).toBe("PASS");
    expect(
      evaluatePairwiseCheck(check, [
        report({ internalRawName: "Higher", overall: 87 }),
        report({ internalRawName: "Lower", overall: 86 })
      ]).status
    ).toBe("WARN");
    expect(evaluatePairwiseCheck(check, [report({ internalRawName: "Higher", overall: 90 })]).status).toBe("MISSING");
    expect(
      evaluatePairwiseCheck(check, [
        report({ internalRawName: "Higher One", overall: 90 }),
        report({ internalRawName: "Higher Two", overall: 91 }),
        report({ internalRawName: "Lower", overall: 86 })
      ]).status
    ).toBe("AMBIGUOUS");
  });

  it("returns deterministic pre-Phase-1B preset options", () => {
    expect(resolveRatingLabPresetOptions("pre-phase-1b-calibration")).toEqual({
      sample: "iconic-plus-random",
      randomCount: 300,
      seed: "42"
    });
    expect(resolveRatingLabPresetOptions("pre-phase-1b-calibration")).toEqual(
      resolveRatingLabPresetOptions("pre-phase-1b-calibration")
    );
  });

  it("loads formula presets and applies structured overrides without changing the default distribution mode", async () => {
    const config = await loadRatingFormulaConfig();
    const merged = mergeRatingFormulaConfig(prePhase1BCalibrationConfig, {
      caps: { ...prePhase1BCalibrationConfig.caps, noSignalGeneratedMax: 72 }
    });

    expect(config.ratingDistribution.selectedStrategy).toBe("RAW_EVIDENCE");
    expect(merged.caps.noSignalGeneratedMax).toBe(72);
    expect(merged.finalOverallWeights.worldCupOnlyFallback.generatedBaseline).toBe(
      prePhase1BCalibrationConfig.finalOverallWeights.worldCupOnlyFallback.generatedBaseline
    );
  });

  it("resolves rating-lab source paths with defaults, env, and CLI-style overrides", () => {
    const resolved = resolveRatingLabSourcePaths({
      cwd: "D:\\Programming\\autoxi",
      env: { RATING_LAB_SOURCE_ROOT: "custom-sources", RATING_LAB_TRANSFERMARKT_SOURCE_DIR: "env-tm" },
      overrides: { transfermarkt: "cli-tm" }
    });

    expect(resolved.sources.fjelstul.path).toContain("custom-sources");
    expect(resolved.sources.transfermarkt.path).toContain("cli-tm");
    expect(resolved.availability.find((source) => source.sourceKey === "SEVEN_A_ZERO_MANUAL")?.affectsRating).toBe(false);
  });

  it("explains missing Fjelstul source while optional sources remain warnings", () => {
    const resolved = resolveRatingLabSourcePaths({ cwd: "D:\\definitely-missing-rating-lab", env: {} });

    expect(() => assertFjelstulAvailable(resolved)).toThrow("Set RATING_LAB_FJELSTUL_SOURCE_DIR or pass --fjelstul-source-dir.");
    expect(resolved.sources.transfermarkt.warnings).toContain("transfermarkt_source_unavailable");
  });

  it("profiles Transfermarkt CSV files and extracts coverage years", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-tm-"));
    await writeFixtureCsv(dir, "players.csv", [
      "player_name,season,market_value_eur",
      "Diego Maradona,1982/83,10000000",
      "Socrates,1981,8000000"
    ]);

    const profile = await profileTransfermarktSource(dir);

    expect(profile.totalRows).toBe(2);
    expect(profile.files[0]).toMatchObject({ minYear: 1981, maxYear: 1982 });
  });

  it("discovers local Transfermarkt player ids from non-profile files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-tm-discovery-"));
    await writeFixtureCsv(dir, "game_lineups.csv", [
      "player_id,player_name,date,type,position,country",
      "3373,Ronaldinho,2002-06-30,starting_lineup,FW,BRA"
    ]);
    await writeFixtureCsv(dir, "game_events.csv", [
      "player_id,player_name,date,type,club_name",
      "3373,Ronaldinho,2002-06-30,Goals,Paris Saint-Germain"
    ]);

    const discovered = await discoverLocalTransfermarktPlayerIds(dir);

    expect(discovered[0]).toMatchObject({
      playerId: "3373",
      seenInPlayers: false,
      seenInLineups: true,
      seenInEvents: true
    });
    expect(findLocalTransfermarktIdEvidence(discovered, "Ronaldinho")?.playerId).toBe("3373");
  });

  it("loads Transfermarkt overlay profiles and valuations without overwriting base profile data", async () => {
    const root = await mkdtemp(join(tmpdir(), "rating-lab-tm-overlay-"));
    const baseDir = join(root, "transfermarkt");
    const overlayDir = join(root, "transfermarkt-overlay");
    await mkdir(baseDir, { recursive: true });
    await mkdir(overlayDir, { recursive: true });
    await writeFixtureCsv(baseDir, "players.csv", [
      "player_id,name,country_of_citizenship,position",
      "3373,Ronaldinho,BRA,Attack"
    ]);
    await writeFixtureCsv(overlayDir, "players_overlay.csv", [
      "player_id,name,country_of_citizenship,date_of_birth,position",
      "3373,Ronaldo de Assis Moreira,BRA,1980-03-21,Midfield"
    ]);
    await writeFixtureCsv(overlayDir, "player_valuations_overlay.csv", [
      "player_id,date,market_value_in_eur",
      "3373,2002-06-01,30000000"
    ]);

    const rows = await loadTransfermarktSeasons(baseDir, { years: new Set([2002]), targetNames: ["Ronaldinho"] });

    expect(rows[0]).toMatchObject({
      playerId: "3373",
      playerName: "Ronaldinho",
      birthYear: 1980,
      marketValueEur: 30000000
    });
  });

  it("ignores squad-presence placeholder rows as Transfermarkt rating evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "rating-lab-tm-context-only-"));
    const baseDir = join(root, "transfermarkt");
    const overlayDir = join(root, "transfermarkt-overlay");
    await mkdir(baseDir, { recursive: true });
    await mkdir(overlayDir, { recursive: true });
    await writeFixtureCsv(overlayDir, "players_overlay.csv", [
      "player_id,name,country_of_citizenship,date_of_birth,position",
      "10,Miroslav Klose,DEU,1978-06-09,Centre-Forward"
    ]);
    await writeFixtureCsv(overlayDir, "appearances_overlay.csv", [
      "appearance_id,date,player_id,player_name,competition_id,goals,assists,minutes_played,source",
      "fake-klose,2002-07-01,10,Miroslav Klose,L1,0,0,1,transfermarkt_squad_presence"
    ]);

    const rows = await loadTransfermarktSeasons(baseDir, { years: new Set([2002]), targetNames: ["Miroslav Klose"] });

    expect(rows).toEqual([]);
  });

  it("parses approved provider links and leaves needs-review links inactive", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-links-"));
    const path = join(dir, "provider_player_links.csv");
    await writeFixtureCsv(dir, "provider_player_links.csv", [
      "subject_provider,subject_id,target_provider,target_id,player_name,nation_code,world_cup_year,confidence,link_method,evidence,review_status",
      "fjelstul,BRA-2002-ronaldinho,transfermarkt,3373,Ronaldinho,BRA,2002,HIGH,external_known_id,local events,auto_approved",
      "fjelstul,ITA-1994-baggio,transfermarkt,123,Roberto Baggio,ITA,1994,HIGH,search,candidate,needs_review"
    ]);

    const links = await loadProviderPlayerLinks(path);

    expect(links).toHaveLength(2);
    expect(approvedProviderLinks(links).map((link) => link.targetId)).toEqual(["3373"]);
  });

  it("keeps FBref overlay report-only and non-fatal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-fbref-empty-"));
    const profile = await profileFbrefOverlay(dir);

    expect(profile.available).toBe(false);
    expect(profile.totalRows).toBe(0);
  });

  it("profiles FBref overlay files as optional source rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-fbref-"));
    await writeFixtureCsv(dir, "player_season_standard.csv", [
      "fbref_player_id,player_name,season,squad,competition,nation,position,age,minutes",
      "abc123,Ronaldinho,2001-2002,Paris Saint-Germain,Ligue 1,BRA,FW,22,2200"
    ]);

    const profile = await profileFbrefOverlay(dir);

    expect(profile).toMatchObject({ available: true, totalRows: 1, linkedPlayersCount: 1 });
  });

  it("exports enrichment candidates and JSONL from a tiny rating report", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "rating-lab-enrichment-export-"));
    const reportPath = join(outputDir, "rating-lab-rating-breakdown-fixture.csv");
    await writeFile(
      reportPath,
      [
        "cardKey,internalRawName,debugRealName,worldCupYear,nation,position,overall,tier,primarySource,awards,sevenAZeroDelta,rating99Eligible,transfermarktMatchConfidence,transfermarktPlayerId,transfermarktCoverage,transfermarktSignalsMissing",
        "fjelstul:p1:2002,Ronaldinho,Ronaldinho,2002,BRA,FW,94,ICON,FJELSTUL_GENERATED,GOLDEN_BALL,7,true,NONE,,,"
      ].join("\n") + "\n",
      "utf8"
    );

    const result = await exportEnrichmentRequests({
      outputDir,
      outputPath: join(outputDir, "missing-player-enrichment.jsonl"),
      reportPath,
      transfermarktSourceDir: outputDir,
      dryRun: true
    });

    expect(result.requestCount).toBeGreaterThan(0);
    expect(await readFile(result.candidatesPath, "utf8")).toContain("TRANSFERMARKT_IMPORTANT_FJELSTUL_ONLY");
  });

  it("loads and validates the default JSON formula config with path metadata", async () => {
    const config = await loadRatingFormulaConfigFromFile();

    expect(config.version).toBe("pre-phase-1b-raw-evidence-v1");
    expect(config.ratingDistribution.selectedStrategy).toBe("RAW_EVIDENCE");
    expect(config.formulaConfigPath).toContain("data");
    expect(config.formulaConfigFallbackUsed).toBe(false);
  });

  it("applies the JSON manual anchor switch to the runtime formula config", () => {
    const parsed = RatingFormulaJsonSchema.parse(
      formulaJsonFixture({
        manualAnchors: { enabled: false }
      })
    );
    const config = applyFormulaJsonConfig(prePhase1BCalibrationConfig, parsed, {
      path: "fixture-formula.json",
      fallbackUsed: false
    });

    expect(config.manualAnchors.enabled).toBe(false);
  });

  it("rejects invalid formula weights and ambiguous preview name settings", () => {
    const invalid = formulaJsonFixture({
      transfermarkt: {
        ...formulaJsonFixture().transfermarkt,
        annualSignalWeights: {
          ...formulaJsonFixture().transfermarkt.annualSignalWeights,
          marketValuePercentile: 0.25
        }
      },
      preview: {
        showRealNamesInLocalPreview: true,
        showMaskedNamesInPublicPreview: true
      }
    });

    const result = RatingFormulaJsonSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join("|")).toContain("annualSignalWeights must sum to 1");
    expect(result.error?.issues.map((issue) => issue.message).join("|")).toContain("cannot both be true");
  });

  it("rejects 7a0 when configured to affect ratings", () => {
    const result = RatingFormulaJsonSchema.safeParse(
      formulaJsonFixture({
        comparisonOnlySources: {
          sevenAZeroManual: {
            enabled: true,
            affectsRating: true,
            defaultTolerance: 3,
            warningDelta: 6
          }
        }
      })
    );

    expect(result.success).toBe(false);
  });

  it("uses normalized active source weights when blending applied ratings", () => {
    const blended = blendAppliedRatings([
      {
        sourceKey: "TRANSFERMARKT",
        rating: 96,
        baseWeight: 0.65,
        confidence: "HIGH",
        coverage: 1,
        effectiveWeight: 0.65,
        affectsRating: true,
        reasons: [],
        warnings: []
      },
      {
        sourceKey: "FJELSTUL_WORLD_CUP",
        rating: 82,
        baseWeight: 0.35,
        confidence: "MEDIUM",
        coverage: 1,
        effectiveWeight: 0.35,
        affectsRating: true,
        reasons: [],
        warnings: []
      },
      {
        sourceKey: "SEVEN_A_ZERO_MANUAL",
        rating: 99,
        baseWeight: 0,
        confidence: "HIGH",
        coverage: 1,
        effectiveWeight: 0,
        affectsRating: false,
        reasons: [],
        warnings: []
      }
    ]);

    expect(blended.finalOverallBeforeCaps).toBe(91);
    expect(blended.appliedSources.map((source) => source.sourceKey)).toEqual(["TRANSFERMARKT", "FJELSTUL_WORLD_CUP"]);
    expect(blended.ignoredSources.map((source) => source.sourceKey)).toEqual(["SEVEN_A_ZERO_MANUAL"]);
  });

  it("matches Transfermarkt candidates at high, medium, and low confidence", () => {
    const context = cardContext({ internalRawName: "Diego Armando Maradona", nation: "ARG", worldCupYear: 1982 });
    const candidates = matchTransfermarktPlayer(context, [
      tmSeason("Diego Armando Maradona", 1982, 1, 90),
      tmSeason("Diego Maradona", 1984, 1, 90),
      tmSeason("Maradona", 1978, 1, 90, { nation: "BRA" })
    ]);

    expect(candidates.map((candidate) => candidate.confidence)).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("does not auto-promote one-token Transfermarkt names without birth-year support", () => {
    const ambiguous = matchTransfermarktPlayer(
      cardContext({ internalRawName: "Ronaldo", nation: "BRA", worldCupYear: 2002 }),
      [tmSeason("Ronaldo", 2002, 1, 90, { nation: "BRA" })]
    )[0]!;
    const supported = matchTransfermarktPlayer(
      cardContext({ internalRawName: "Ronaldo", nation: "BRA", worldCupYear: 2002, birthYear: 1976 }),
      [tmSeason("Ronaldo", 2002, 1, 90, { nation: "BRA", birthYear: 1976 })]
    )[0]!;

    expect(ambiguous.confidence).toBe("MEDIUM");
    expect(ambiguous.matchFailureReason).toBe("single_token_name_without_birth_year");
    expect(supported.confidence).toBe("HIGH");
    expect(supported.matchFailureReason).toBe("");
  });

  it("centralizes nation aliases and resolves FIFA flag codes for preview assets", () => {
    const aliases = createStaticNationAliasIndex();

    expect(normalizeNationToCode("Argentina", aliases)).toBe("ARG");
    expect(normalizeNationToCode("Germany", aliases)).toBe("DEU");
    expect(normalizeNationToCode("West Germany", aliases)).toBe("DEU");
    expect(normalizeNationToCode("FRG", aliases)).toBe("DEU");
    expect(resolveFlagCode("DEU")).toBe("de");
    expect(resolveFlagCode("ARG")).toBe("ar");
  });

  it("uses the pre-tournament Transfermarkt season as the World Cup rating season", () => {
    expect(worldCupCycleYears(2002)).toEqual([1998, 1999, 2000, 2001]);
    expect(worldCupCycleYears(1998)).toEqual([1994, 1995, 1996, 1997]);
    expect(worldCupCycleYears(2022)).toEqual([2019, 2020, 2021, 2022]);
  });

  it("uses Transfermarkt playerId instead of normalized name for multi-season grouping", () => {
    const context = cardContext({
      internalRawName: "Shared Name",
      nation: "ARG",
      worldCupYear: 2022,
      birthYear: 1994
    });
    const records = [
      { ...tmSeason("Shared Name", 2019, 100, 1800), playerId: "target" },
      { ...tmSeason("Shared Name", 2020, 200, 1800), playerId: "other" },
      { ...tmSeason("Shared Name", 2021, 300, 1800), playerId: "other" },
      { ...tmSeason("Shared Name", 2022, 400, 1800), playerId: "target" }
    ];
    const candidate = {
      ...matchTransfermarktPlayer(context, records)[0]!,
      record: records[0]!,
      transfermarktPlayerId: "target"
    };
    const rating = resolveTransfermarktRating({ context, candidate, records });

    expect(rating?.reasons).toContain("available_years:2019|2022");
    expect(rating?.signals.transfermarktPlayerId).toBe("target");
  });

  it("does not grant high Transfermarkt rating confidence from market value alone", () => {
    const context = cardContext({
      internalRawName: "Market Only",
      nation: "ARG",
      worldCupYear: 2022,
      birthYear: 1994
    });
    const records = [
      {
        ...tmSeason("Market Only", 2022, 400, 0),
        appearances: null,
        minutes: null,
        goals: null,
        assists: null,
        starterCount: null,
        benchCount: null,
        yellowCards: null,
        redCards: null
      }
    ];
    const candidate = matchTransfermarktPlayer(context, records)[0]!;
    const rating = resolveTransfermarktRating({ context, candidate, records });

    expect(rating?.matchConfidence).toBe("HIGH");
    expect(rating?.confidence).not.toBe("HIGH");
    expect(rating?.warnings).toContain("insufficient_rating_signals");
  });

  it("turns Transfermarkt raw values into percentiles and multi-season trends", () => {
    const peerGroup = [
      tmSeason("A", 1982, 1, 90, { goals: 0, assists: 0, appearances: 1 }),
      tmSeason("B", 1982, 10, 900, { goals: 3, assists: 2, appearances: 10 })
    ];
    const baseline = resolveTransfermarktSeasonBaseline(peerGroup[1]!, peerGroup);
    const multiSeason = resolveTransfermarktMultiSeasonBaseline({
      sameSeasonScore: 91,
      previousSeasonScore: 87,
      twoSeasonsBackScore: 84,
      threeSeasonsBackScore: 81
    });

    expect(baseline.marketValuePercentile).toBe(1);
    expect(baseline.score).toBeGreaterThan(90);
    expect(multiSeason.marketValueTrend).toBe("RISING");
    expect(multiSeason.trendAdjustment).toBe(1);
  });

  it("creates a high-confidence Transfermarkt rating from configured World Cup cycle weights", () => {
    const context = cardContext({
      internalRawName: "Diego Maradona",
      nation: "ARG",
      worldCupYear: 1982,
      birthYear: 1960
    });
    const records = [
      tmSeason("Diego Maradona", 1978, 80, 1800),
      tmSeason("Diego Maradona", 1979, 100, 2000),
      tmSeason("Diego Maradona", 1980, 200, 2500),
      tmSeason("Diego Maradona", 1981, 300, 2800),
      tmSeason("Diego Maradona", 1982, 400, 3000),
      tmSeason("Peer One", 1982, 10, 500),
      tmSeason("Peer Two", 1982, 20, 700)
    ];
    const candidate = matchTransfermarktPlayer(context, records)[0]!;
    const rating = resolveTransfermarktRating({ context, candidate, records });

    expect(worldCupCycleYears(1982)).toEqual([1978, 1979, 1980, 1981]);
    expect(rating?.matchConfidence).toBe("HIGH");
    expect(rating?.coverage).toBe(1);
    expect(rating?.rating).toBeGreaterThanOrEqual(55);
    expect(rating?.rating).toBeLessThanOrEqual(99);
    expect(rating?.multiSeason.weightedMultiSeasonScore).not.toBeNull();
  });

  it("does not penalize young players for under-age missing seasons", () => {
    const context = cardContext({
      internalRawName: "Young Star",
      nation: "ARG",
      worldCupYear: 2022,
      birthYear: 2004
    });
    const records = [
      tmSeason("Young Star", 2021, 100, 1300, { birthYear: 2004 }),
      tmSeason("Young Star", 2022, 200, 1800, { birthYear: 2004 })
    ];
    const candidate = matchTransfermarktPlayer(context, records)[0]!;
    const rating = resolveTransfermarktRating({ context, candidate, records });

    expect(rating?.coverage).toBe(1);
    expect(rating?.warnings.some((warning) => warning.startsWith("missing_expected_seasons"))).toBe(false);
  });

  it("low minutes lower Transfermarkt confidence", () => {
    const context = cardContext({ internalRawName: "Low Minutes", nation: "ARG", worldCupYear: 2022, birthYear: 1994 });
    const records = [tmSeason("Low Minutes", 2019, 100, 300), tmSeason("Low Minutes", 2022, 200, 350)];
    const candidate = matchTransfermarktPlayer(context, records)[0]!;
    const rating = resolveTransfermarktRating({ context, candidate, records });

    expect(rating?.confidence).not.toBe("HIGH");
    expect(rating?.warnings).toEqual(expect.arrayContaining(["low_availability:2019", "low_availability:2022"]));
  });

  it("blends high-confidence Transfermarkt with Fjelstul and leaves medium Transfermarkt report-only", () => {
    const baseContext = cardContext({ appearances: 2, minutes: 180, goals: 0, teamResult: "GROUP_STAGE" });
    const high = resolveCardRating(baseContext, {
      transfermarktRatings: [
        {
          sourceKey: "TRANSFERMARKT",
          rating: 96,
          baseWeight: 0.65,
          confidence: "HIGH",
          coverage: 1,
          effectiveWeight: 0.65,
          affectsRating: true,
          reasons: ["fixture"],
          warnings: []
        }
      ]
    });
    const medium = resolveCardRating(baseContext, {
      transfermarktRatings: [
        {
          sourceKey: "TRANSFERMARKT",
          rating: 96,
          baseWeight: 0,
          confidence: "MEDIUM",
          coverage: 1,
          effectiveWeight: 0,
          affectsRating: true,
          reasons: ["fixture"],
          warnings: []
        }
      ]
    });
    const fallback = resolveCardRating(baseContext);

    expect(high.breakdown?.transfermarktEffectiveWeight).toBe(0.65);
    expect(high.overall).toBeGreaterThan(fallback.overall);
    expect(medium.breakdown?.transfermarktEffectiveWeight).toBe(0);
    expect(medium.overall).toBe(fallback.overall);
  });

  it("local preview can show debug names while public display names stay separate", () => {
    const html = renderRatingLabPreviewHtml(summaryFixture({
      cardSnapshots: [
        {
          ...summaryFixture().cardSnapshots[0]!,
          debugRealName: "Diego Maradona",
          publicDisplayName: "ARG-1982-CAM-SAFE01",
          isLocalDebugOnly: true
        }
      ]
    }));

    expect(html).toContain("Diego Maradona");
    expect(html).toContain("ARG-1982-CAM-SAFE01");
  });

  it("resolves older World Cup host labels from host_countries.csv", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rating-lab-hosts-"));
    await writeFixtureCsv(dir, "players.csv", ["player_id,given_name,family_name", "p1,Pele,"]);
    await writeFixtureCsv(dir, "squads.csv", ["player_id,tournament_id,team_id,position", "p1,wc1970,bra,ST"]);
    await writeFixtureCsv(dir, "tournaments.csv", ["tournament_id,year", "wc1970,1970"]);
    await writeFixtureCsv(dir, "teams.csv", ["team_id,team_code,team_name", "bra,BRA,Brazil", "mex,MEX,Mexico"]);
    await writeFixtureCsv(dir, "host_countries.csv", ["tournament_id,team_id", "wc1970,mex"]);

    const cards = await loadFjelstulSample({ sourceDir: dir, sample: "all", seed: "test" });

    expect(cards[0]?.hostCountryLabel).toBe("MEXICO");
    expect(cards[0]?.hostResolutionWarning).toBeNull();
  });

  it("reports elite rating distribution diagnostics", () => {
    const diagnostics = resolveRatingDistributionDiagnostics([
      report({ overall: 99, worldCupYear: 1986, position: "CAM" }),
      report({ overall: 95, worldCupYear: 1986, position: "ST" }),
      report({ overall: 89, worldCupYear: 1982, position: "CM" })
    ]);

    expect(diagnostics.count90Plus).toBe(2);
    expect(diagnostics.count95Plus).toBe(2);
    expect(diagnostics.byWorldCupYear.find((group) => group.key === "1986")?.count90Plus).toBe(2);
  });
});

function cardContext(overrides: Partial<FjelstulCardContext> = {}): FjelstulCardContext {
  const identityKey = "test-player-arg";
  const position = overrides.position ?? "CAM";
  const worldCupYear = overrides.worldCupYear ?? 1986;
  const nation = overrides.nation ?? "ARG";
  return {
    identityKey,
    internalRawName: "Test Player",
    publicPlaceholderName: publicSafePlaceholderName({ nation, worldCupYear, position, identityKey }),
    worldCupYear,
    nation,
    position,
    role: position === "GK" ? "Shot Stopper" : "Creator",
    squadPresence: true,
    appearances: 6,
    minutes: 540,
    goals: 1,
    captain: false,
    awards: [],
    teamResult: "RUNNER_UP",
    host: false,
    tournamentCount: 1,
    samePlayerEditionCount: 1,
    seed: "test",
    ...overrides
  };
}

function report(overrides: Partial<RatingLabCardReport> = {}): RatingLabCardReport {
  return {
    internalRawName: "Test Player",
    publicPlaceholderName: "ARG-1986-CAM-ABC123",
    worldCupYear: 1986,
    nation: "ARG",
    position: "CAM",
    overall: 80,
    estimatedOverallFromStats: 80,
    overallStatDelta: 0,
    tier: "KEY_PLAYER",
    editionKey: "NONE",
    primarySource: "FJELSTUL_GENERATED",
    sourceTypes: "FJELSTUL_GENERATED",
    confidence: "MEDIUM",
    teamResult: "UNKNOWN",
    awards: "",
    appearances: 1,
    goals: 0,
    sevenAZeroRating: null,
    sevenAZeroDelta: null,
    baseRating: 80,
    manualFloorApplied: "false",
    awardFloorApplied: "false",
    teamResultModifier: null,
    appearanceModifier: null,
    goalModifier: null,
    externalReferenceDelta: null,
    finalOverall: 80,
    warnings: "",
    reasons: "",
    ...overrides,
    cardKey: overrides.cardKey ?? "test-player-arg:1986",
    debugRealName: overrides.debugRealName ?? "Test Player",
    publicDisplayName: overrides.publicDisplayName ?? "ARG-1986-CAM-ABC123",
    isLocalDebugOnly: overrides.isLocalDebugOnly ?? true,
    hostCountryLabel: overrides.hostCountryLabel ?? "MEXICO",
    hostCountryCode: overrides.hostCountryCode ?? "MEX",
    hostResolutionSource: overrides.hostResolutionSource ?? "host_countries.csv",
    hostResolutionWarning: overrides.hostResolutionWarning ?? null,
    formulaVersion: overrides.formulaVersion ?? "test-formula",
    formulaConfigPath: overrides.formulaConfigPath ?? "test-config.json",
    selectedDistributionStrategy: overrides.selectedDistributionStrategy ?? "RAW_EVIDENCE",
    rawEvidenceOverall: overrides.rawEvidenceOverall ?? overrides.overall ?? 80,
    selectedOverall: overrides.selectedOverall ?? overrides.overall ?? 80,
    seasonAbilityBaseline: overrides.seasonAbilityBaseline ?? null,
    seasonAbilitySource: overrides.seasonAbilitySource ?? null,
    seasonAbilityConfidence: overrides.seasonAbilityConfidence ?? "NONE",
    sameSeasonScore: overrides.sameSeasonScore ?? null,
    previousSeasonScore: overrides.previousSeasonScore ?? null,
    twoSeasonsBackScore: overrides.twoSeasonsBackScore ?? null,
    threeSeasonsBackScore: overrides.threeSeasonsBackScore ?? null,
    weightedMultiSeasonScore: overrides.weightedMultiSeasonScore ?? null,
    marketValueTrend: overrides.marketValueTrend ?? "UNKNOWN",
    productionTrend: overrides.productionTrend ?? "UNKNOWN",
    minutesTrend: overrides.minutesTrend ?? "UNKNOWN",
    trendAdjustment: overrides.trendAdjustment ?? 0,
    worldCupPerformanceRating: overrides.worldCupPerformanceRating ?? overrides.overall ?? 80,
    worldCupRating: overrides.worldCupRating ?? overrides.worldCupPerformanceRating ?? overrides.overall ?? 80,
    worldCupPerformanceSource: overrides.worldCupPerformanceSource ?? "FJELSTUL_WORLD_CUP",
    worldCupPerformanceConfidence: overrides.worldCupPerformanceConfidence ?? "MEDIUM",
    transfermarktRating: overrides.transfermarktRating ?? null,
    transfermarktIdentityConfidence: overrides.transfermarktIdentityConfidence ?? "NONE",
    transfermarktIdentityCoverage: overrides.transfermarktIdentityCoverage ?? false,
    transfermarktContextCoverage: overrides.transfermarktContextCoverage ?? false,
    transfermarktRatingEvidenceCoverage: overrides.transfermarktRatingEvidenceCoverage ?? false,
    transfermarktAppliedRatingCoverage: overrides.transfermarktAppliedRatingCoverage ?? false,
    transfermarktRatingEvidenceReason: overrides.transfermarktRatingEvidenceReason ?? "no_transfermarkt_identity_or_rating_evidence",
    transfermarktEffectiveWeight: overrides.transfermarktEffectiveWeight ?? 0,
    worldCupEffectiveWeight: overrides.worldCupEffectiveWeight ?? 1,
    finalBlendedRating: overrides.finalBlendedRating ?? overrides.overall ?? 80,
    transfermarktMatchConfidence: overrides.transfermarktMatchConfidence ?? "NONE",
    transfermarktCoverage: overrides.transfermarktCoverage ?? null,
    transfermarktEligibleYears: overrides.transfermarktEligibleYears ?? "",
    transfermarktAvailableYears: overrides.transfermarktAvailableYears ?? "",
    tmOldestYear: overrides.tmOldestYear ?? null,
    tmTwoBackYear: overrides.tmTwoBackYear ?? null,
    tmPreviousYear: overrides.tmPreviousYear ?? null,
    tmWorldCupYear: overrides.tmWorldCupYear ?? null,
    tmOldestRating: overrides.tmOldestRating ?? null,
    tmTwoBackRating: overrides.tmTwoBackRating ?? null,
    tmPreviousRating: overrides.tmPreviousRating ?? null,
    tmWorldCupYearRating: overrides.tmWorldCupYearRating ?? null,
    tmSameSeasonScore: overrides.tmSameSeasonScore ?? null,
    tmPreviousSeasonScore: overrides.tmPreviousSeasonScore ?? null,
    tmTwoSeasonsBackScore: overrides.tmTwoSeasonsBackScore ?? null,
    tmThreeSeasonsBackScore: overrides.tmThreeSeasonsBackScore ?? null,
    tmWeightedMultiSeasonScore: overrides.tmWeightedMultiSeasonScore ?? null,
    tmMarketValuePercentile: overrides.tmMarketValuePercentile ?? null,
    tmAppearanceVolumeScore: overrides.tmAppearanceVolumeScore ?? null,
    tmGoalContributionScore: overrides.tmGoalContributionScore ?? null,
    tmAssistContributionScore: overrides.tmAssistContributionScore ?? null,
    tmLeagueStrengthScore: overrides.tmLeagueStrengthScore ?? null,
    tmClubStrengthScore: overrides.tmClubStrengthScore ?? null,
    tmAgeCurveScore: overrides.tmAgeCurveScore ?? null,
    tmStarterShareScore: overrides.tmStarterShareScore ?? null,
    tmCardsDisciplineScore: overrides.tmCardsDisciplineScore ?? null,
    transfermarktPlayerId: overrides.transfermarktPlayerId ?? "",
    transfermarktRatingConfidence: overrides.transfermarktRatingConfidence ?? "NONE",
    transfermarktMatchFailureReason: overrides.transfermarktMatchFailureReason ?? "",
    transfermarktSignalsAvailable: overrides.transfermarktSignalsAvailable ?? "",
    transfermarktSignalsMissing: overrides.transfermarktSignalsMissing ?? "",
    transfermarktChangedRatingBy: overrides.transfermarktChangedRatingBy ?? null,
    manualTransfermarktOverrideApplied: overrides.manualTransfermarktOverrideApplied ?? false,
    manualTransfermarktOverrideReason: overrides.manualTransfermarktOverrideReason ?? "",
    awardMaxCapApplied: overrides.awardMaxCapApplied ?? false,
    absoluteClampApplied: overrides.absoluteClampApplied ?? false,
    rating99Eligible: overrides.rating99Eligible ?? false,
    rating99EligibilityReason: overrides.rating99EligibilityReason ?? "",
    exceptionalSignals: overrides.exceptionalSignals ?? "",
    tmMarketValueTrend: overrides.tmMarketValueTrend ?? "UNKNOWN",
    tmProductionTrend: overrides.tmProductionTrend ?? "UNKNOWN",
    tmMinutesTrend: overrides.tmMinutesTrend ?? "UNKNOWN",
    tmTrendAdjustment: overrides.tmTrendAdjustment ?? 0,
    leagueStrengthAdjustment: overrides.leagueStrengthAdjustment ?? 0,
    clubStrengthAdjustment: overrides.clubStrengthAdjustment ?? 0,
    ageCurveAdjustment: overrides.ageCurveAdjustment ?? 0,
    awardAdjustment: overrides.awardAdjustment ?? 0,
    manualAnchorAdjustment: overrides.manualAnchorAdjustment ?? 0,
    finalOverallBeforeCaps: overrides.finalOverallBeforeCaps ?? overrides.overall ?? 80,
    capsApplied: overrides.capsApplied ?? "",
    bonusesApplied: overrides.bonusesApplied ?? "",
    warningsApplied: overrides.warningsApplied ?? "",
    evidenceSummary: overrides.evidenceSummary ?? "",
    comparisonSummary: overrides.comparisonSummary ?? ""
  };
}

function tmSeason(
  playerName: string,
  seasonYear: number,
  marketValueEur: number,
  minutes: number,
  overrides: Partial<{
    normalizedName: string;
    nation: string;
    birthYear: number;
    appearances: number;
    goals: number;
    assists: number;
  }> = {}
) {
  return {
    playerId: overrides.normalizedName ?? playerName.toLowerCase(),
    playerName,
    normalizedName: overrides.normalizedName ?? playerName.toLowerCase(),
    nation: overrides.nation ?? "ARG",
    seasonYear,
    birthYear: overrides.birthYear,
    marketValueEur,
    highestMarketValueEur: marketValueEur,
    appearances: overrides.appearances ?? 30,
    goals: overrides.goals ?? 10,
    assists: overrides.assists ?? 8,
    minutes,
    yellowCards: 0,
    redCards: 0,
    starterCount: overrides.appearances ?? 30,
    benchCount: 0,
    captainCount: 0,
    clubName: "Fixture FC",
    leagueName: "Fixture League"
  };
}

function formulaJsonFixture(overrides: Record<string, unknown> = {}): any {
  return {
    version: "pre-phase-1b-raw-evidence-v1",
    selectedStrategy: "RAW_EVIDENCE",
    sourceBlendWeights: {
      highConfidenceTransfermarkt: 0.65,
      mediumConfidenceTransfermarkt: 0,
      lowConfidenceTransfermarkt: 0,
      worldCupWithHighConfidenceTransfermarkt: 0.35,
      worldCupFallbackOnly: 1
    },
    transfermarkt: {
      minimumCoverageToApply: 0.25,
      seasonWindow: {
        enabled: true,
        usePreviousWorldCupCycle: true,
        weights: { oldest: 0.1, twoBack: 0.2, previous: 0.3, worldCupYear: 0.4 }
      },
      annualSignalWeights: {
        marketValuePercentile: 0.38,
        appearanceVolume: 0.2,
        goalContribution: 0.14,
        assistContribution: 0.08,
        starterShare: 0.06,
        clubStrength: 0.05,
        leagueStrength: 0.05,
        ageCurve: 0.02,
        cardsDiscipline: 0.02
      },
      normalizeAnnualWeightsOverAvailableSignals: true,
      minimumSignalsForHighConfidenceRating: 3,
      requiredSignalsForHighConfidenceRating: ["marketValuePercentile", "appearanceVolume"],
      confidenceMultipliers: { HIGH: 1, MEDIUM: 0.65, LOW: 0.35 }
    },
    missingSeasonRules: {
      normalizeWeightsOverAvailableEligibleSeasons: true,
      underAgeSeasonIsNotExpected: true,
      underAgeCutoff: 17,
      youngPlayerAgeMax: 19,
      establishedPlayerAgeMin: 22,
      missingExpectedSeasonAffects: "confidence",
      missingExpectedSeasonRatingPenalty: 0
    },
    availabilityRules: {
      enabled: true,
      useMinutesPlayed: true,
      useAppearancesWhenMinutesMissing: true,
      lowAvailabilityAffects: "seasonScoreAndConfidence",
      minimumStrongSeasonMinutes: 1200,
      minimumEliteSeasonMinutes: 1800,
      lowMinutesScorePenaltyMax: 0.12,
      lowMinutesConfidencePenaltyMax: 0.25
    },
    caps: {
      generatedOnlyNoStrongSignalMax: 88,
      highRatingRequiresStrongSignalMin: 90,
      eliteRatingRequiresExceptionalSignalMin: 95
    },
    distributionDiagnostics: {
      enabled: true,
      warnOnly: true,
      buckets: [99, 98, 97, 96, 95, 94, 93, 92, 91, 90]
    },
    preview: {
      showRealNamesInLocalPreview: true,
      showMaskedNamesInPublicPreview: false
    },
    comparisonOnlySources: {
      sevenAZeroManual: {
        enabled: true,
        affectsRating: false,
        defaultTolerance: 3,
        warningDelta: 6
      }
    },
    ...overrides
  };
}

function benchmarkTarget(overrides: Partial<BenchmarkTarget> = {}): BenchmarkTarget {
  return {
    id: "fixture-target",
    nameSearch: "Test Player",
    worldCupYear: 1986,
    nationCode: "ARG",
    expectedRatingMin: 78,
    expectedRatingMax: 82,
    benchmarkType: "ICON_RANGE",
    reason: "fixture",
    ...overrides
  };
}

function manualReference(overrides: Partial<SevenAZeroManualReference> = {}): SevenAZeroManualReference {
  return {
    id: "fixture-reference",
    playerName: "Test Player",
    nationCode: "ARG",
    worldCupYear: 1986,
    referenceOverall: 80,
    tolerance: 4,
    reason: "fixture",
    ...overrides
  };
}

function benchmarkResult(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    ...benchmarkTarget(),
    status: "PASS",
    actualRating: 80,
    distance: 0,
    candidateCount: 1,
    candidateNames: ["Test Player"],
    ...overrides
  };
}

function sourceReadinessFixture() {
  return {
    playersRowsRead: 1,
    squadRowsRead: 1,
    tournamentRowsRead: 1,
    teamRowsRead: 1,
    standingRowsRead: 1,
    awardRowsRead: 1,
    awardWinnerRowsRead: 1,
    hostRowsRead: 1,
    optionalAppearanceRowsRead: 0,
    optionalGoalRowsRead: 0,
    requiredSourceFilesLoaded: true,
    sourceWarnings: []
  };
}

function summaryFixture(overrides: Partial<RatingLabSummary> = {}): RatingLabSummary {
  const snapshot = {
    key: "Test Player:1986:ARG",
    internalRawName: "Test Player",
    publicPlaceholderName: "ARG-1986-CAM-ABC123",
    worldCupYear: 1986,
    nation: "ARG",
    position: "CAM" as const,
    overall: 80,
    tier: "KEY_PLAYER" as const,
    primarySource: "FJELSTUL_GENERATED" as const,
    confidence: "MEDIUM" as const,
    warnings: "",
    reasons: "fixture"
  };

  return {
    generatedAt: "2026-06-15T00:00:00.000Z",
    sourceDir: "fixture",
    sampleMode: "fixture",
    seed: "42",
    totalCardsSampled: 1,
    cardsResolved: 1,
    cardsGeneratedOnly: 1,
    cardsWithManualCurated: 0,
    cardsWithEaHistorical: 0,
    cardsWithRetroReference: 0,
    cardsWithFiveThirtyEight: 0,
    cardsWithStatsBomb: 0,
    cardsWithSevenAZeroComparison: 0,
    cardsWithHighConfidenceSource: 0,
    cardsWithMediumConfidenceOnly: 1,
    cardsWithLowConfidenceOnly: 0,
    tmIdentityCount: 0,
    tmIdentityPercent: 0,
    tmContextCount: 0,
    tmContextPercent: 0,
    tmRatingEvidenceCount: 0,
    tmRatingEvidencePercent: 0,
    tmAppliedRatingCount: 0,
    tmAppliedRatingPercent: 0,
    ...sourceReadinessFixture(),
    byWorldCupYear: { "1986": 1 },
    byDecade: { "1980s": 1 },
    byNation: { ARG: 1 },
    byPosition: { CAM: 1 },
    byTier: { KEY_PLAYER: 1 },
    bySourceType: { FJELSTUL_GENERATED: 1 },
    byConfidence: { MEDIUM: 1 },
    warningsByCode: {},
    benchmarks: [benchmarkResult()],
    cardSnapshots: [snapshot],
    anomalyDetails: [],
    pairwiseChecks: [],
    pairwisePass: 0,
    pairwiseWarn: 0,
    pairwiseFail: 0,
    pairwiseMissing: 0,
    pairwiseAmbiguous: 0,
    generatedOnlyTop3PerTournament: 0,
    overallStatDeltaP90: 0,
    awardWinnerFloorPct: 100,
    sevenAZeroComparison: null,
    sevenAZeroManualPass: 0,
    sevenAZeroManualWarn: 0,
    sevenAZeroManualFail: 0,
    sevenAZeroManualMissing: 0,
    sevenAZeroManualAmbiguous: 0,
    sevenAZeroManualMatched: 0,
    sevenAZeroManualAverageAbsoluteDelta: null,
    sevenAZeroManualMedianAbsoluteDelta: null,
    sevenAZeroManualDeltaP90: null,
    confidenceGateStatus: "READY_FOR_PHASE_1B",
    confidenceGateReasons: [],
    ...overrides
  };
}

async function writeFixtureCsv(dir: string, filename: string, lines: readonly string[]): Promise<void> {
  await writeFile(join(dir, filename), `${lines.join("\n")}\n`, "utf8");
}

async function listTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listTypeScriptFiles(path)));
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}
