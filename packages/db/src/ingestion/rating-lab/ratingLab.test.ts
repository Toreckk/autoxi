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
import { loadRatingFormulaConfig, mergeRatingFormulaConfig } from "./domain/rating/ratingFormulaConfig.js";
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
import { resolveTransfermarktSeasonBaseline } from "./sources/transfermarkt/transfermarktSeasonBaseline.js";
import { resolveTransfermarktMultiSeasonBaseline } from "./sources/transfermarkt/transfermarktMultiSeasonBaseline.js";
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

  it("caps generated Golden Boot ratings below all-time icon range without manual evidence", () => {
    const result = generateOverallFromFjelstulContext(
      cardContext({ awards: ["GOLDEN_BOOT"], goals: 8, teamResult: "CHAMPION", appearances: 7, minutes: 630 })
    );

    expect(result.overall).toBeLessThanOrEqual(94);
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

  it("matches Transfermarkt candidates at high, medium, and low confidence", () => {
    const context = cardContext({ internalRawName: "Diego Armando Maradona", nation: "ARG", worldCupYear: 1982 });
    const candidates = matchTransfermarktPlayer(context, [
      { playerName: "Diego Armando Maradona", normalizedName: "diego armando maradona", nation: "ARG", seasonYear: 1982, marketValueEur: 1, appearances: 1, goals: 1, assists: 1, minutes: 90 },
      { playerName: "Diego Maradona", normalizedName: "diego maradona", nation: "ARG", seasonYear: 1984, marketValueEur: 1, appearances: 1, goals: 1, assists: 1, minutes: 90 },
      { playerName: "Maradona", normalizedName: "maradona", nation: "BRA", seasonYear: 1978, marketValueEur: 1, appearances: 1, goals: 1, assists: 1, minutes: 90 }
    ]);

    expect(candidates.map((candidate) => candidate.confidence)).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("turns Transfermarkt raw values into percentiles and multi-season trends", () => {
    const peerGroup = [
      { playerName: "A", normalizedName: "a", seasonYear: 1982, marketValueEur: 1, appearances: 1, goals: 0, assists: 0, minutes: 90 },
      { playerName: "B", normalizedName: "b", seasonYear: 1982, marketValueEur: 10, appearances: 10, goals: 3, assists: 2, minutes: 900 }
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
    formulaVersion: overrides.formulaVersion ?? "test-formula",
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
    worldCupPerformanceSource: overrides.worldCupPerformanceSource ?? "FJELSTUL_WORLD_CUP",
    worldCupPerformanceConfidence: overrides.worldCupPerformanceConfidence ?? "MEDIUM",
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
