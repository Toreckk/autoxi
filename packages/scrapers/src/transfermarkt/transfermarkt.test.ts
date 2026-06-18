import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { fbrefSkeletonStatus } from "../fbref/FbrefSkeleton.js";
import { sofascoreSkeletonStatus } from "../sofascore/SofascoreSkeleton.js";
import { ScraperCache } from "../shared/ScraperCache.js";
import { buildCoverageSummary } from "../shared/EnrichmentReports.js";
import { matchTransfermarktCandidates, type TransfermarktMissingPlayer, type TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { DEFAULT_ROUND_1, loadLeagueExpansionPlan } from "./TransfermarktCompetitionConfig.js";
import { runTransfermarktCoverageExpansion } from "./TransfermarktCoverageExpansion.js";
import { buildTransfermarktIdentityCandidateIndex, identityCandidateRowsToSquadPlayers } from "./TransfermarktIdentityCandidateIndex.js";
import { writeTransfermarktOverlays } from "./TransfermarktOverlayWriter.js";
import { parseTransfermarktClubUrls, parseTransfermarktSquadPlayers } from "./TransfermarktScraper.js";
import { applyReviewedTransfermarktApprovals } from "./TransfermarktReviewedApprovals.js";
import { resolveWorldCupTransfermarktSeasonPlan } from "./WorldCupTransfermarktSeasonResolver.js";

describe("transfermarkt scraper tooling", () => {
  it("falls back to the round-1 league expansion plan", async () => {
    const plan = await loadLeagueExpansionPlan();
    expect(plan.rounds[0]).toEqual(DEFAULT_ROUND_1);
  });

  it("selects World Cup year only and skips cached league seasons on dry run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autoxi-scrapers-"));
    const reportDir = join(dir, "reports");
    const sourceDir = join(dir, "sources");
    await mkdir(reportDir, { recursive: true });
    await writeFile(
      join(reportDir, "candidates.csv"),
      [
        "ratingSubjectId,fjelstulPlayerId,sourceName,debugRealName,nationCode,worldCupYear,position,currentRating,currentRatingSource,transfermarktMatchConfidence,transfermarktPlayerId,fbrefPlayerId,candidateCategory,priority,reason,localTransfermarktIdEvidence,needsTransfermarktProfile,needsTransfermarktValuations,needsFbrefLink,needsFbrefStats",
        "BRA-2002-ronaldo,fjelstul:P1,Ronaldo,Ronaldo,BRA,2002,ST,99,MANUAL,NONE,146660,,TRANSFERMARKT_PROFILE_MISSING,100,missing,tm:146660:players.csv,true,true,false,false"
      ].join("\n") + "\n",
      "utf8"
    );
    const cache = new ScraperCache(join(sourceDir, "transfermarkt-overlay/cache"));
    await cache.writeSquadCache(
      { leagueId: "GB1", season: 2001, worldCupYear: 2002 },
      ["player_id", "name", "country_of_citizenship", "birth_year", "position", "season", "league"],
      [{ player_id: "146660", name: "Ronaldo", country_of_citizenship: "BRA", birth_year: "1976", position: "Centre-Forward", season: "2001", league: "GB1" }]
    );

    const result = await runTransfermarktCoverageExpansion({
      repoRoot: dir,
      candidatesPath: join(reportDir, "candidates.csv"),
      sourceDir: join(sourceDir, "transfermarkt"),
      outputDir: sourceDir,
      dryRun: true
    });

    expect(result.yearsScanned).toEqual([2002]);
    expect(result.transfermarktSeasonsScanned).toEqual([2001, 2002]);
    expect(result.cacheHits).toBe(1);
    expect(result.cacheMisses).toBe(13);
    expect(result.playersApproved).toBe(1);
  });

  it("maps World Cup years to Transfermarkt season plans", () => {
    expect(resolveWorldCupTransfermarktSeasonPlan(2002)).toMatchObject({
      worldCupYear: 2002,
      primarySeasonId: 2001,
      secondarySeasonIds: [2002]
    });
    expect(resolveWorldCupTransfermarktSeasonPlan(1998)).toMatchObject({ primarySeasonId: 1997, secondarySeasonIds: [1998] });
    expect(resolveWorldCupTransfermarktSeasonPlan(2022)).toMatchObject({ primarySeasonId: 2022, secondarySeasonIds: [2021] });
  });

  it("fetches cache misses on non-dry runs through an injected squad provider", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autoxi-scrapers-live-"));
    const reportDir = join(dir, "reports");
    const sourceDir = join(dir, "sources");
    await mkdir(reportDir, { recursive: true });
    await writeFile(
      join(reportDir, "candidates.csv"),
      [
        "ratingSubjectId,fjelstulPlayerId,sourceName,debugRealName,nationCode,worldCupYear,position,currentRating,currentRatingSource,transfermarktMatchConfidence,transfermarktPlayerId,candidateCategory,priorityScore,localTransfermarktIdEvidence,needsTransfermarktProfile,needsTransfermarktValuations",
        "DEU-2006-klose,fjelstul:P2,Miroslav Klose,Miroslav Klose,DEU,2006,ST,91,GENERATED,NONE,10,TRANSFERMARKT_PROFILE_MISSING,95,tm:10:events.csv,true,false"
      ].join("\n") + "\n",
      "utf8"
    );

    const result = await runTransfermarktCoverageExpansion({
      repoRoot: dir,
      candidatesPath: join(reportDir, "candidates.csv"),
      sourceDir: join(sourceDir, "transfermarkt"),
      outputDir: sourceDir,
      dryRun: false,
      maxLeagues: 1,
      squadProvider: {
        async listSquadPlayers(leagueId, season) {
          return [{ playerId: "10", name: "Miroslav Klose", nationalities: ["DEU"], birthYear: 1978, position: "Centre-Forward", leagueId, season }];
        }
      }
    });

    expect(result.cacheMisses).toBe(2);
    expect(result.playersApproved).toBe(1);
    expect(await readFile(join(sourceDir, "transfermarkt-overlay/cache/squads_GB1_wc2006_tm2005.csv"), "utf8")).toContain("Miroslav Klose");
  });

  it("parses Transfermarkt competition and squad HTML fixtures", () => {
    const clubUrls = parseTransfermarktClubUrls(
      '<a href="/fc-barcelona/startseite/verein/131/saison_id/2002">FC Barcelona</a><a href="/real-madrid/startseite/verein/418">Real Madrid</a>',
      2002
    );
    const players = parseTransfermarktSquadPlayers(
      '<tr class="odd"><td class="posrela"><a href="/ronaldo/profil/spieler/3140">Ronaldo</a><td>Centre-Forward</td></td><td class="zentriert">Sep 18, 1976 (26)</td><td><img title="Brazil" alt="Brazil" class="flaggenrahmen"></td></tr>',
      { leagueId: "ES1", season: 2002 }
    );

    expect(clubUrls[0]).toContain("/kader/verein/131/saison_id/2002/plus/1");
    expect(clubUrls[1]).toContain("/kader/verein/418/saison_id/2002/plus/1");
    expect(players[0]).toMatchObject({ playerId: "3140", name: "Ronaldo", nationalities: ["Brazil", "Brazil"], birthYear: 1976, leagueId: "ES1" });
  });

  it("auto-approves unique high-confidence matches and rejects name-only matches", () => {
    const request: TransfermarktMissingPlayer = {
      requestKey: "transfermarkt:146660",
      ratingSubjectId: "BRA-2002-ronaldo",
      canonicalPlayerId: "tm:146660",
      name: "Ronaldo",
      aliases: [],
      nation: "BRA",
      worldCupYear: 2002,
      position: "ST",
      birthYear: 1976,
      transfermarktId: "146660"
    };
    const candidates: TransfermarktSquadPlayer[] = [
      { playerId: "146660", name: "Ronaldo", nationalities: ["BRA"], birthYear: 1976, position: "Centre-Forward", leagueId: "ES1", season: 2002 },
      { playerId: "999", name: "Ronaldo", nationalities: [], position: "", leagueId: "ES1", season: 2002 }
    ];

    const matches = matchTransfermarktCandidates([request], candidates);

    expect(matches.find((match) => match.candidate.playerId === "146660")?.status).toBe("auto_approved");
    expect(matches.find((match) => match.candidate.playerId === "999")?.status).not.toBe("auto_approved");
  });

  it("auto-approves supported full-name and strong one-token matches", () => {
    const fullNameRequest: TransfermarktMissingPlayer = {
      requestKey: "transfermarkt:search:baggio",
      ratingSubjectId: "ITA-1994-roberto-baggio",
      canonicalPlayerId: "fjelstul:P1",
      name: "Roberto Baggio",
      aliases: [],
      nation: "ITA",
      worldCupYear: 1994,
      position: "ST"
    };
    const oneTokenRequest: TransfermarktMissingPlayer = {
      ...fullNameRequest,
      requestKey: "transfermarkt:search:ronaldo",
      ratingSubjectId: "BRA-2002-ronaldo",
      name: "Ronaldo",
      nation: "BRA",
      worldCupYear: 2002
    };
    const missingNationFullNameRequest: TransfermarktMissingPlayer = {
      ...fullNameRequest,
      requestKey: "transfermarkt:search:klose",
      ratingSubjectId: "DEU-2002-miroslav-klose",
      name: "Miroslav Klose",
      nation: "DEU",
      worldCupYear: 2002,
      localIdEvidence: true
    };
    const matches = matchTransfermarktCandidates(
      [fullNameRequest, oneTokenRequest, missingNationFullNameRequest],
      [
        { playerId: "1773", name: "Roberto Baggio", nationalities: ["Italy"], birthYear: 1967, position: "Second Striker", leagueId: "IT1", season: 1994 },
        { playerId: "3140", name: "Ronaldo", nationalities: ["Brazil"], birthYear: 1976, position: "Centre-Forward", leagueId: "ES1", season: 2002 },
        { playerId: "10", name: "Miroslav Klose", nationalities: [], birthYear: 1978, position: "Centre-Forward", leagueId: "L1", season: 2002 }
      ]
    );

    expect(matches.find((match) => match.candidate.playerId === "1773")?.status).toBe("auto_approved");
    expect(matches.find((match) => match.candidate.playerId === "3140")?.status).toBe("auto_approved");
    expect(matches.find((match) => match.candidate.playerId === "10")?.status).toBe("auto_approved");
  });

  it("keeps one-token matches in review when birth year or nationality support is missing", () => {
    const request: TransfermarktMissingPlayer = {
      requestKey: "transfermarkt:search:ronaldo",
      ratingSubjectId: "BRA-2002-ronaldo",
      canonicalPlayerId: "fjelstul:P1",
      name: "Ronaldo",
      aliases: [],
      nation: "BRA",
      worldCupYear: 2002,
      position: "ST"
    };

    const matches = matchTransfermarktCandidates(
      [request],
      [{ playerId: "3140", name: "Ronaldo", nationalities: ["Brazil"], position: "Centre-Forward", leagueId: "ES1", season: 2001 }]
    );

    expect(matches[0]?.status).toBe("needs_review");
  });

  it("writes overlay players and provider links without mutating base files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autoxi-overlays-"));
    const request: TransfermarktMissingPlayer = {
      requestKey: "transfermarkt:10",
      ratingSubjectId: "DEU-2006-klose",
      canonicalPlayerId: "tm:10",
      name: "Miroslav Klose",
      aliases: [],
      nation: "DEU",
      worldCupYear: 2006,
      position: "ST",
      birthYear: 1978,
      transfermarktId: "10"
    };
    const [match] = matchTransfermarktCandidates(
      [request],
      [{ playerId: "10", name: "Miroslav Klose", nationalities: ["DEU"], birthYear: 1978, position: "Centre-Forward", leagueId: "L1", season: 2006 }]
    );

    await writeTransfermarktOverlays({
      playersOverlayPath: join(dir, "transfermarkt-overlay/players_overlay.csv"),
      squadPresenceOverlayPath: join(dir, "transfermarkt-overlay/squad_presence_overlay.csv"),
      providerLinksPath: join(dir, "identity/provider_player_links.csv"),
      needsReviewPath: join(dir, "enrichment/enrichment_needs_review.csv"),
      roundId: "round-1-core",
      matches: [match!]
    });

    expect(await readFile(join(dir, "transfermarkt-overlay/players_overlay.csv"), "utf8")).toContain("Miroslav Klose");
    expect(await readFile(join(dir, "transfermarkt-overlay/squad_presence_overlay.csv"), "utf8")).toContain("transfermarkt_squad_presence");
    await expect(readFile(join(dir, "transfermarkt-overlay/appearances_overlay.csv"), "utf8")).rejects.toThrow();
    expect(await readFile(join(dir, "identity/provider_player_links.csv"), "utf8")).toContain("auto_approved");
  });

  it("builds an identity candidate index from squad context and uses it for matching", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autoxi-identity-index-"));
    const rows = await buildTransfermarktIdentityCandidateIndex({
      sourceDir: join(dir, "transfermarkt"),
      outputDir: dir,
      squadRows: [
        {
          playerId: "3140",
          name: "Ronaldo",
          nationalities: ["Brazil"],
          birthYear: 1976,
          position: "Centre-Forward",
          leagueId: "ES1",
          season: 2001,
          worldCupYear: 2002
        }
      ]
    });
    const matches = matchTransfermarktCandidates(
      [
        {
          requestKey: "transfermarkt:search:ronaldo",
          ratingSubjectId: "BRA-2002-ronaldo",
          canonicalPlayerId: "fjelstul:P1",
          name: "Ronaldo",
          aliases: [],
          nation: "BRA",
          worldCupYear: 2002,
          position: "ST"
        }
      ],
      identityCandidateRowsToSquadPlayers(rows)
    );

    expect(await readFile(join(dir, "transfermarkt-overlay/identity_candidate_index.csv"), "utf8")).toContain("3140");
    expect(matches[0]?.status).toBe("auto_approved");
  });

  it("applies manually approved review rows into overlays", async () => {
    const dir = await mkdtemp(join(tmpdir(), "autoxi-reviewed-"));
    await mkdir(join(dir, "enrichment"), { recursive: true });
    await writeFile(
      join(dir, "enrichment/enrichment_needs_review.csv"),
      [
        "request_key,provider,request_type,canonical_player_id,player_name,nation_code,world_cup_year,candidate_provider_id,candidate_name,candidate_nation,candidate_birth_year,candidate_team,candidate_competition,candidate_season,match_score,match_method,reason,evidence,review_status",
        "transfermarkt:search:BRA-2002-ronaldo,transfermarkt,TRANSFERMARKT_SEARCH,fjelstul:P-62722,Ronaldo,BRA,2002,3140,Ronaldo,Brazil,1976,Real Madrid,ES1,2002,85,name_exact|nationality_match,candidate_requires_review,[],manual_approved"
      ].join("\n") + "\n",
      "utf8"
    );

    const result = await applyReviewedTransfermarktApprovals({ outputDir: dir });

    expect(result.approvedRowsRead).toBe(1);
    expect(await readFile(join(dir, "transfermarkt-overlay/players_overlay.csv"), "utf8")).toContain("3140");
    expect(await readFile(join(dir, "transfermarkt-overlay/squad_presence_overlay.csv"), "utf8")).toContain("transfermarkt_squad_presence_manual_review");
    expect(await readFile(join(dir, "identity/provider_player_links.csv"), "utf8")).toContain("manual_approved");
  });

  it("calculates coverage summaries and keeps optional sources as skeletons", () => {
    expect(buildCoverageSummary(10, 7).transfermarktCoveragePercent).toBe(70);
    expect(fbrefSkeletonStatus()).toMatchObject({ status: "skeleton", affectsRating: false });
    expect(sofascoreSkeletonStatus()).toMatchObject({ status: "skeleton", affectsRating: false });
  });
});
