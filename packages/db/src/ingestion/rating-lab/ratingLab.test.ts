import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  evaluateBenchmark,
  evaluateBenchmarkDistance,
  findBenchmarkCandidates,
  getBenchmarkSearchTerms
} from "./benchmarkRanges.js";
import { compareRatingLabReports } from "./compareRatingLabReports.js";
import {
  findSevenAZeroComparison,
  isValidOverallRating,
  loadSevenAZeroLocalJsonComparisons
} from "./compareWithSevenAZero.js";
import { estimateOverallFromStats } from "./estimateOverallFromStats.js";
import { evaluateRatingGates } from "./evaluateRatingGates.js";
import { generateOverallFromFjelstulContext } from "./generateOverallFromFjelstulContext.js";
import { generateStatsFromOverall } from "./generateStatsFromOverall.js";
import { MANUAL_RATING_FLOORS } from "./iconicTargets.js";
import { loadFjelstulSample, loadFjelstulSampleWithReadiness, mapFjelstulPosition } from "./loadFjelstulSample.js";
import { detectAnomalyDetails } from "./anomalyDetection.js";
import { evaluatePairwiseCheck } from "./pairwiseChecks.js";
import { buildReports, detectAnomalies, toCardReport, writeRatingLabReports } from "./reportWriter.js";
import { resolveCardRating } from "./resolveCardRating.js";
import { resolveRatingLabPresetOptions } from "./runRatingLab.js";
import {
  evaluateSevenAZeroReference,
  evaluateSevenAZeroManualReferences,
  findManualReferenceCandidates
} from "./sevenAZeroManualReferences.js";
import type {
  BenchmarkResult,
  BenchmarkTarget,
  FjelstulCardContext,
  RatingLabCardReport,
  RatingLabSummary,
  SevenAZeroManualReference
} from "./types.js";
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

  it("detects generated-only tournament top-three outliers", () => {
    const anomalies = detectAnomalyDetails([
      report({ internalRawName: "Generated Star", worldCupYear: 1970, nation: "BRA", overall: 91, primarySource: "FJELSTUL_GENERATED" }),
      report({ internalRawName: "Curated Star", worldCupYear: 1970, nation: "BRA", overall: 90, primarySource: "MANUAL_CURATED" }),
      report({ internalRawName: "Known Star", worldCupYear: 1970, nation: "ITA", overall: 89, primarySource: "MANUAL_CURATED" })
    ]);

    expect(anomalies.some((anomaly) => anomaly.code === "generated_only_top3_tournament")).toBe(true);
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
    expect(row.manualFloorApplied).toBe("true");
    expect(row.finalOverall).toBe(row.overall);
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
