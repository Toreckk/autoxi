import { normalizeName } from "../../utils.js";
import type { BenchmarkResult, BenchmarkTarget, RatingLabCardReport } from "../types.js";

export const BENCHMARK_RANGES = [
  {
    id: "maradona-1986",
    nameSearch: "Maradona",
    aliases: ["Diego Maradona"],
    worldCupYear: 1986,
    nationCode: "ARG",
    expectedRatingMin: 96,
    expectedRatingMax: 99,
    benchmarkType: "ICON_RANGE",
    reason: "all-time iconic tournament"
  },
  {
    id: "pele-1970",
    nameSearch: "Pele",
    aliases: ["Pelé", "Edson Arantes"],
    worldCupYear: 1970,
    nationCode: "BRA",
    expectedRatingMin: 95,
    expectedRatingMax: 99,
    benchmarkType: "ICON_RANGE",
    reason: "all-time champion team"
  },
  {
    id: "garrincha-1962",
    nameSearch: "Garrincha",
    aliases: ["Manoel Francisco"],
    worldCupYear: 1962,
    nationCode: "BRA",
    expectedRatingMin: 94,
    expectedRatingMax: 98,
    benchmarkType: "ICON_RANGE",
    reason: "historic tournament icon"
  },
  {
    id: "cruyff-1974",
    nameSearch: "Cruyff",
    aliases: ["Johan Cruyff", "Johan Cruijff"],
    worldCupYear: 1974,
    nationCode: "NED",
    expectedRatingMin: 94,
    expectedRatingMax: 98,
    benchmarkType: "ICON_RANGE",
    reason: "tournament-defining playmaker"
  },
  {
    id: "beckenbauer-1974",
    nameSearch: "Beckenbauer",
    aliases: ["Franz Beckenbauer"],
    worldCupYear: 1974,
    nationCode: "FRG",
    expectedRatingMin: 93,
    expectedRatingMax: 97,
    benchmarkType: "ICON_RANGE",
    reason: "champion captain and elite defender/libero"
  },
  {
    id: "eusebio-1966",
    nameSearch: "Eusebio",
    aliases: ["Eusébio"],
    worldCupYear: 1966,
    nationCode: "POR",
    expectedRatingMin: 93,
    expectedRatingMax: 97,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Boot / major tournament star"
  },
  {
    id: "paolo-rossi-1982",
    nameSearch: "Paolo Rossi",
    worldCupYear: 1982,
    nationCode: "ITA",
    expectedRatingMin: 91,
    expectedRatingMax: 96,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Boot / iconic tournament"
  },
  {
    id: "romario-1994",
    nameSearch: "Romario",
    aliases: ["Romário"],
    worldCupYear: 1994,
    nationCode: "BRA",
    expectedRatingMin: 92,
    expectedRatingMax: 97,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Ball / champion"
  },
  {
    id: "ronaldo-2002",
    nameSearch: "Ronaldo",
    aliases: ["Ronaldo Nazario", "Ronaldo Luís", "Ronaldo Luis"],
    worldCupYear: 2002,
    nationCode: "BRA",
    expectedRatingMin: 95,
    expectedRatingMax: 98,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Boot / champion / elite striker"
  },
  {
    id: "zidane-2006",
    nameSearch: "Zidane",
    aliases: ["Zinedine Zidane"],
    worldCupYear: 2006,
    nationCode: "FRA",
    expectedRatingMin: 92,
    expectedRatingMax: 97,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Ball finalist tournament"
  },
  {
    id: "modric-2018",
    nameSearch: "Modric",
    aliases: ["Luka Modric", "Luka Modrić"],
    worldCupYear: 2018,
    nationCode: "CRO",
    expectedRatingMin: 92,
    expectedRatingMax: 96,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Ball / finalist"
  },
  {
    id: "messi-2022",
    nameSearch: "Messi",
    aliases: ["Lionel Messi"],
    worldCupYear: 2022,
    nationCode: "ARG",
    expectedRatingMin: 96,
    expectedRatingMax: 99,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Ball / champion"
  },
  {
    id: "mbappe-2022",
    nameSearch: "Mbappe",
    aliases: ["Kylian Mbappe", "Kylian Mbappé"],
    worldCupYear: 2022,
    nationCode: "FRA",
    expectedRatingMin: 94,
    expectedRatingMax: 98,
    benchmarkType: "AWARD_WINNER_RANGE",
    reason: "Golden Boot / finalist / final hat-trick"
  },
  {
    id: "yashin-1966",
    nameSearch: "Yashin",
    aliases: ["Lev Yashin"],
    worldCupYear: 1966,
    nationCode: "URS",
    expectedRatingMin: 90,
    expectedRatingMax: 95,
    benchmarkType: "GOALKEEPER_RANGE",
    reason: "historic elite goalkeeper"
  },
  {
    id: "zoff-1982",
    nameSearch: "Zoff",
    aliases: ["Dino Zoff"],
    worldCupYear: 1982,
    nationCode: "ITA",
    expectedRatingMin: 90,
    expectedRatingMax: 95,
    benchmarkType: "GOALKEEPER_RANGE",
    reason: "champion goalkeeper and captain"
  },
  {
    id: "buffon-2006",
    nameSearch: "Buffon",
    aliases: ["Gianluigi Buffon"],
    worldCupYear: 2006,
    nationCode: "ITA",
    expectedRatingMin: 91,
    expectedRatingMax: 96,
    benchmarkType: "GOALKEEPER_RANGE",
    reason: "elite champion goalkeeper"
  },
  {
    id: "casillas-2010",
    nameSearch: "Casillas",
    aliases: ["Iker Casillas"],
    worldCupYear: 2010,
    nationCode: "ESP",
    expectedRatingMin: 90,
    expectedRatingMax: 95,
    benchmarkType: "GOALKEEPER_RANGE",
    reason: "champion goalkeeper"
  },
  {
    id: "neuer-2014",
    nameSearch: "Neuer",
    aliases: ["Manuel Neuer"],
    worldCupYear: 2014,
    nationCode: "GER",
    expectedRatingMin: 91,
    expectedRatingMax: 96,
    benchmarkType: "GOALKEEPER_RANGE",
    reason: "Golden Glove / champion"
  },
  {
    id: "matthaus-1990",
    nameSearch: "Matthaus",
    aliases: ["Lothar Matthaus", "Lothar Matthäus"],
    worldCupYear: 1990,
    nationCode: "FRG",
    expectedRatingMin: 93,
    expectedRatingMax: 97,
    benchmarkType: "ICON_RANGE",
    reason: "champion and elite midfielder"
  },
  {
    id: "iniesta-2010",
    nameSearch: "Iniesta",
    aliases: ["Andres Iniesta", "Andrés Iniesta"],
    worldCupYear: 2010,
    nationCode: "ESP",
    expectedRatingMin: 91,
    expectedRatingMax: 95,
    benchmarkType: "ICON_RANGE",
    reason: "champion midfield creator and final scorer"
  },
  {
    id: "xavi-2010",
    nameSearch: "Xavi",
    worldCupYear: 2010,
    nationCode: "ESP",
    expectedRatingMin: 90,
    expectedRatingMax: 95,
    benchmarkType: "ICON_RANGE",
    reason: "champion midfield controller"
  },
  {
    id: "neymar-2014",
    nameSearch: "Neymar",
    worldCupYear: 2014,
    nationCode: "BRA",
    expectedRatingMin: 88,
    expectedRatingMax: 94,
    benchmarkType: "MODERN_REFERENCE_RANGE",
    reason: "modern elite attacker, likely EA-style overlay candidate"
  },
  {
    id: "klose-2014",
    nameSearch: "Klose",
    aliases: ["Miroslav Klose"],
    worldCupYear: 2014,
    nationCode: "GER",
    expectedRatingMin: 84,
    expectedRatingMax: 91,
    benchmarkType: "ROLE_PLAYER_RANGE",
    reason: "record scorer but older role player in champion squad"
  }
] as const satisfies readonly BenchmarkTarget[];

export function evaluateBenchmarks(cards: readonly RatingLabCardReport[]): BenchmarkResult[] {
  return BENCHMARK_RANGES.map((target) => evaluateBenchmark(target, cards));
}

export function evaluateBenchmark(target: BenchmarkTarget, cards: readonly RatingLabCardReport[]): BenchmarkResult {
  const candidates = findBenchmarkCandidates(target, cards);
  if (candidates.length === 0) {
    return {
      ...target,
      status: "MISSING",
      actualRating: null,
      candidateCount: 0,
      candidateNames: []
    };
  }

  const best = selectBestCandidate(target, candidates);
  if (!best) {
    return {
      ...target,
      status: "AMBIGUOUS",
      actualRating: null,
      candidateCount: candidates.length,
      candidateNames: candidates.map((candidate) => candidate.internalRawName)
    };
  }

  const distance = evaluateBenchmarkDistance(best.overall, target.expectedRatingMin, target.expectedRatingMax);
  const status = distance === 0 ? "PASS" : distance <= 2 ? "WARN" : "FAIL";

  return {
    ...target,
    status,
    actualRating: best.overall,
    matchedInternalRawName: best.internalRawName,
    matchedPublicName: best.publicPlaceholderName,
    matchedNation: best.nation,
    matchedPosition: best.position,
    distance,
    candidateCount: candidates.length,
    candidateNames: candidates.map((candidate) => candidate.internalRawName)
  };
}

export function getBenchmarkSearchTerms(target: BenchmarkTarget): string[] {
  return [target.nameSearch, ...(target.aliases ?? [])];
}

export function findBenchmarkCandidates(
  target: BenchmarkTarget,
  cards: readonly RatingLabCardReport[]
): RatingLabCardReport[] {
  const terms = getBenchmarkSearchTerms(target).map(normalizeName);
  return cards.filter(
    (card) =>
      card.worldCupYear === target.worldCupYear &&
      (!target.nationCode || nationMatches(card.nation, target.nationCode)) &&
      terms.some((term) => nameMatches(normalizeName(card.internalRawName), term))
  );
}

export function evaluateBenchmarkDistance(actual: number, min: number, max: number): number {
  if (actual < min) return min - actual;
  if (actual > max) return actual - max;
  return 0;
}

export function nationMatches(actual: string, expected: string): boolean {
  const actualAliases = nationAliases(actual);
  const expectedAliases = nationAliases(expected);
  return actualAliases.some((alias) => expectedAliases.includes(alias));
}

function selectBestCandidate(
  target: BenchmarkTarget,
  candidates: readonly RatingLabCardReport[]
): RatingLabCardReport | null {
  const scored = candidates
    .map((candidate) => ({ candidate, score: candidateScore(target, candidate) }))
    .sort((left, right) => right.score - left.score || right.candidate.overall - left.candidate.overall);

  const [best, second] = scored;
  if (!best) return null;
  if (second && best.score === second.score) return null;
  return best.candidate;
}

function candidateScore(target: BenchmarkTarget, card: RatingLabCardReport): number {
  const name = normalizeName(card.internalRawName);
  const terms = getBenchmarkSearchTerms(target).map(normalizeName);
  return Math.max(...terms.map((term) => termScore(name, term)));
}

function termScore(name: string, term: string): number {
  if (name === term) return 4;
  if (name.endsWith(` ${term}`) || name.startsWith(`${term} `)) return 3;
  if (name.includes(term)) return 2;
  return 0;
}

function nameMatches(name: string, term: string): boolean {
  return termScore(name, term) > 0;
}

function nationAliases(value: string): string[] {
  const normalized = normalizeName(value);
  const aliases: Record<string, readonly string[]> = {
    arg: ["arg", "argentina"],
    bra: ["bra", "brazil"],
    cro: ["cro", "croatia"],
    esp: ["esp", "spa", "spain"],
    fra: ["fra", "france"],
    frg: ["frg", "ger", "deu", "west germany", "germany"],
    ger: ["ger", "deu", "frg", "germany", "west germany"],
    deu: ["deu", "ger", "frg", "germany", "west germany"],
    ita: ["ita", "italy"],
    ned: ["ned", "netherlands", "holland"],
    por: ["por", "portugal"],
    urs: ["urs", "ussr", "soviet union"],
    uru: ["uru", "uruguay"]
  };
  return [...(aliases[normalized] ?? [normalized])];
}
