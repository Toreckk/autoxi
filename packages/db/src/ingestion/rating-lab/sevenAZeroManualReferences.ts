import { nationMatches } from "./benchmarkRanges.js";
import type { SevenAZeroManualReference, SevenAZeroManualReferenceResult, RatingLabCardReport } from "./types.js";
import { normalizeName } from "./utils.js";

export const SEVEN_A_ZERO_MANUAL_REFERENCES = [
  { id: "7a0-bra-1974-rivelino", source: "SEVEN_A_ZERO_MANUAL", playerName: "Rivelino", nationCode: "BRA", worldCupYear: 1974, referenceOverall: 92, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1974-leivinha", source: "SEVEN_A_ZERO_MANUAL", playerName: "Leivinha", nationCode: "BRA", worldCupYear: 1974, referenceOverall: 78, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1974-edu", source: "SEVEN_A_ZERO_MANUAL", playerName: "Edu", nationCode: "BRA", worldCupYear: 1974, referenceOverall: 80, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1974-marinho-chagas", source: "SEVEN_A_ZERO_MANUAL", playerName: "Marinho Chagas", nationCode: "BRA", worldCupYear: 1974, referenceOverall: 86, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-esp-2002-raul", source: "SEVEN_A_ZERO_MANUAL", playerName: "Raul", aliases: ["Raúl"], nationCode: "ESP", worldCupYear: 2002, referenceOverall: 89, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-esp-2002-curro-torres", source: "SEVEN_A_ZERO_MANUAL", playerName: "Curro Torres", nationCode: "ESP", worldCupYear: 2002, referenceOverall: 72, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-esp-2002-casillas", source: "SEVEN_A_ZERO_MANUAL", playerName: "Casillas", aliases: ["Iker Casillas"], nationCode: "ESP", worldCupYear: 2002, referenceOverall: 85, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-esp-2002-morientes", source: "SEVEN_A_ZERO_MANUAL", playerName: "Morientes", aliases: ["Fernando Morientes"], nationCode: "ESP", worldCupYear: 2002, referenceOverall: 84, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-uru-1954-maspoli", source: "SEVEN_A_ZERO_MANUAL", playerName: "Maspoli", aliases: ["Máspoli"], nationCode: "URU", worldCupYear: 1954, referenceOverall: 84, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-uru-1954-santamaria", source: "SEVEN_A_ZERO_MANUAL", playerName: "Santamaria", aliases: ["Santamaría"], nationCode: "URU", worldCupYear: 1954, referenceOverall: 82, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-uru-1954-schiaffino", source: "SEVEN_A_ZERO_MANUAL", playerName: "Schiaffino", nationCode: "URU", worldCupYear: 1954, referenceOverall: 91, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-urs-1966-yashin", source: "SEVEN_A_ZERO_MANUAL", playerName: "Yashin", aliases: ["Lev Yashin"], nationCode: "URS", worldCupYear: 1966, referenceOverall: 94, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-urs-1966-bannikov", source: "SEVEN_A_ZERO_MANUAL", playerName: "Bannikov", nationCode: "URS", worldCupYear: 1966, referenceOverall: 72, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-urs-1966-danilov", source: "SEVEN_A_ZERO_MANUAL", playerName: "Danilov", nationCode: "URS", worldCupYear: 1966, referenceOverall: 76, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-urs-1966-shesternyov", source: "SEVEN_A_ZERO_MANUAL", playerName: "Shesternyov", aliases: ["Shesternyev"], nationCode: "URS", worldCupYear: 1966, referenceOverall: 83, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1966-pele", source: "SEVEN_A_ZERO_MANUAL", playerName: "Pele", aliases: ["Pelé"], nationCode: "BRA", worldCupYear: 1966, referenceOverall: 93, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1966-garrincha", source: "SEVEN_A_ZERO_MANUAL", playerName: "Garrincha", nationCode: "BRA", worldCupYear: 1966, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1966-jairzinho", source: "SEVEN_A_ZERO_MANUAL", playerName: "Jairzinho", nationCode: "BRA", worldCupYear: 1966, referenceOverall: 82, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1966-djalma-santos", source: "SEVEN_A_ZERO_MANUAL", playerName: "Djalma Santos", aliases: ["Djalma Satos"], nationCode: "BRA", worldCupYear: 1966, referenceOverall: 85, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-kaka", source: "SEVEN_A_ZERO_MANUAL", playerName: "Kaka", aliases: ["Kaká"], nationCode: "BRA", worldCupYear: 2006, referenceOverall: 92, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-ronaldinho", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ronaldinho", nationCode: "BRA", worldCupYear: 2006, referenceOverall: 95, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-robinho", source: "SEVEN_A_ZERO_MANUAL", playerName: "Robinho", nationCode: "BRA", worldCupYear: 2006, referenceOverall: 84, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-adriano", source: "SEVEN_A_ZERO_MANUAL", playerName: "Adriano", nationCode: "BRA", worldCupYear: 2006, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-ronaldo", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ronaldo", nationCode: "BRA", worldCupYear: 2006, referenceOverall: 93, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-dida", source: "SEVEN_A_ZERO_MANUAL", playerName: "Dida", nationCode: "BRA", worldCupYear: 2006, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-cafu", source: "SEVEN_A_ZERO_MANUAL", playerName: "Cafu", aliases: ["Cafú"], nationCode: "BRA", worldCupYear: 2006, referenceOverall: 87, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-roberto-carlos", source: "SEVEN_A_ZERO_MANUAL", playerName: "Roberto Carlos", nationCode: "BRA", worldCupYear: 2006, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-2006-lucio", source: "SEVEN_A_ZERO_MANUAL", playerName: "Lucio", aliases: ["Lúcio"], nationCode: "BRA", worldCupYear: 2006, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1994-romario", source: "SEVEN_A_ZERO_MANUAL", playerName: "Romario", aliases: ["Romário"], nationCode: "BRA", worldCupYear: 1994, referenceOverall: 96, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1994-bebeto", source: "SEVEN_A_ZERO_MANUAL", playerName: "Bebeto", nationCode: "BRA", worldCupYear: 1994, referenceOverall: 90, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1994-ronaldo", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ronaldo", nationCode: "BRA", worldCupYear: 1994, referenceOverall: 80, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1994-rai", source: "SEVEN_A_ZERO_MANUAL", playerName: "Rai", aliases: ["Raí"], nationCode: "BRA", worldCupYear: 1994, referenceOverall: 80, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1994-muller", source: "SEVEN_A_ZERO_MANUAL", playerName: "Muller", aliases: ["Müller"], nationCode: "BRA", worldCupYear: 1994, referenceOverall: 76, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-eng-2010-gerrard", source: "SEVEN_A_ZERO_MANUAL", playerName: "Gerrard", nationCode: "ENG", worldCupYear: 2010, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-eng-2010-lampard", source: "SEVEN_A_ZERO_MANUAL", playerName: "Lampard", nationCode: "ENG", worldCupYear: 2010, referenceOverall: 87, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-eng-2010-carragher", source: "SEVEN_A_ZERO_MANUAL", playerName: "Carragher", nationCode: "ENG", worldCupYear: 2010, referenceOverall: 82, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-eng-2010-milner", source: "SEVEN_A_ZERO_MANUAL", playerName: "Milner", nationCode: "ENG", worldCupYear: 2010, referenceOverall: 79, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-eng-2010-lennon", source: "SEVEN_A_ZERO_MANUAL", playerName: "Lennon", nationCode: "ENG", worldCupYear: 2010, referenceOverall: 78, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2002-batistuta", source: "SEVEN_A_ZERO_MANUAL", playerName: "Batistuta", nationCode: "ARG", worldCupYear: 2002, referenceOverall: 93, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2002-crespo", source: "SEVEN_A_ZERO_MANUAL", playerName: "Crespo", nationCode: "ARG", worldCupYear: 2002, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2002-aimar", source: "SEVEN_A_ZERO_MANUAL", playerName: "Aimar", nationCode: "ARG", worldCupYear: 2002, referenceOverall: 86, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2002-ortega", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ortega", nationCode: "ARG", worldCupYear: 2002, referenceOverall: 84, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2002-caniggia", source: "SEVEN_A_ZERO_MANUAL", playerName: "Caniggia", nationCode: "ARG", worldCupYear: 2002, referenceOverall: 85, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-1998-zidane", source: "SEVEN_A_ZERO_MANUAL", playerName: "Zidane", aliases: ["Zinedine Zidane"], nationCode: "FRA", worldCupYear: 1998, referenceOverall: 95, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-1998-deschamps", source: "SEVEN_A_ZERO_MANUAL", playerName: "Deschamps", nationCode: "FRA", worldCupYear: 1998, referenceOverall: 85, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-1998-petit", source: "SEVEN_A_ZERO_MANUAL", playerName: "Petit", nationCode: "FRA", worldCupYear: 1998, referenceOverall: 85, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-1998-vieira", source: "SEVEN_A_ZERO_MANUAL", playerName: "Vieira", nationCode: "FRA", worldCupYear: 1998, referenceOverall: 84, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-1998-henry", source: "SEVEN_A_ZERO_MANUAL", playerName: "Henry", nationCode: "FRA", worldCupYear: 1998, referenceOverall: 83, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-1998-djorkaeff", source: "SEVEN_A_ZERO_MANUAL", playerName: "Djorkaeff", nationCode: "FRA", worldCupYear: 1998, referenceOverall: 84, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2022-mbappe", source: "SEVEN_A_ZERO_MANUAL", playerName: "Mbappe", aliases: ["Kylian Mbappe", "Kylian Mbappé"], nationCode: "FRA", worldCupYear: 2022, referenceOverall: 94, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2022-griezmann", source: "SEVEN_A_ZERO_MANUAL", playerName: "Griezmann", nationCode: "FRA", worldCupYear: 2022, referenceOverall: 89, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2022-benzema", source: "SEVEN_A_ZERO_MANUAL", playerName: "Benzema", nationCode: "FRA", worldCupYear: 2022, referenceOverall: 89, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2022-dembele", source: "SEVEN_A_ZERO_MANUAL", playerName: "Dembele", aliases: ["Dembélé"], nationCode: "FRA", worldCupYear: 2022, referenceOverall: 83, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2022-giroud", source: "SEVEN_A_ZERO_MANUAL", playerName: "Giroud", nationCode: "FRA", worldCupYear: 2022, referenceOverall: 82, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2006-zidane", source: "SEVEN_A_ZERO_MANUAL", playerName: "Zidane", aliases: ["Zinedine Zidane"], nationCode: "FRA", worldCupYear: 2006, referenceOverall: 94, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2006-henry", source: "SEVEN_A_ZERO_MANUAL", playerName: "Henry", nationCode: "FRA", worldCupYear: 2006, referenceOverall: 90, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2006-makelele", source: "SEVEN_A_ZERO_MANUAL", playerName: "Makelele", aliases: ["Makélélé"], nationCode: "FRA", worldCupYear: 2006, referenceOverall: 85, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-fra-2006-ribery", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ribery", aliases: ["Ribéry"], nationCode: "FRA", worldCupYear: 2006, referenceOverall: 80, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-1982-maradona", source: "SEVEN_A_ZERO_MANUAL", playerName: "Maradona", aliases: ["Diego Maradona"], nationCode: "ARG", worldCupYear: 1982, referenceOverall: 95, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-1982-kempes", source: "SEVEN_A_ZERO_MANUAL", playerName: "Kempes", nationCode: "ARG", worldCupYear: 1982, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-1982-ardiles", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ardiles", nationCode: "ARG", worldCupYear: 1982, referenceOverall: 87, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2010-messi", source: "SEVEN_A_ZERO_MANUAL", playerName: "Messi", aliases: ["Lionel Messi"], nationCode: "ARG", worldCupYear: 2010, referenceOverall: 93, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2010-di-maria", source: "SEVEN_A_ZERO_MANUAL", playerName: "Di Maria", aliases: ["Di María"], nationCode: "ARG", worldCupYear: 2010, referenceOverall: 86, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2010-higuain", source: "SEVEN_A_ZERO_MANUAL", playerName: "Higuain", aliases: ["Higuaín"], nationCode: "ARG", worldCupYear: 2010, referenceOverall: 87, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2010-tevez", source: "SEVEN_A_ZERO_MANUAL", playerName: "Tevez", aliases: ["Tévez"], nationCode: "ARG", worldCupYear: 2010, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-arg-2010-mascherano", source: "SEVEN_A_ZERO_MANUAL", playerName: "Mascherano", nationCode: "ARG", worldCupYear: 2010, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-frg-1974-beckenbauer", source: "SEVEN_A_ZERO_MANUAL", playerName: "Beckenbauer", aliases: ["Franz Beckenbauer"], nationCode: "FRG", worldCupYear: 1974, referenceOverall: 97, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-frg-1974-breitner", source: "SEVEN_A_ZERO_MANUAL", playerName: "Breitner", nationCode: "FRG", worldCupYear: 1974, referenceOverall: 88, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-frg-1974-vogts", source: "SEVEN_A_ZERO_MANUAL", playerName: "Vogts", nationCode: "FRG", worldCupYear: 1974, referenceOverall: 86, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-frg-1974-schwarzenbeck", source: "SEVEN_A_ZERO_MANUAL", playerName: "Schwarzenbeck", nationCode: "FRG", worldCupYear: 1974, referenceOverall: 82, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1998-ronaldo", source: "SEVEN_A_ZERO_MANUAL", playerName: "Ronaldo", nationCode: "BRA", worldCupYear: 1998, referenceOverall: 95, tolerance: 3, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1998-rivaldo", source: "SEVEN_A_ZERO_MANUAL", playerName: "Rivaldo", nationCode: "BRA", worldCupYear: 1998, referenceOverall: 90, tolerance: 4, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1998-bebeto", source: "SEVEN_A_ZERO_MANUAL", playerName: "Bebeto", nationCode: "BRA", worldCupYear: 1998, referenceOverall: 80, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1998-edmundo", source: "SEVEN_A_ZERO_MANUAL", playerName: "Edmundo", nationCode: "BRA", worldCupYear: 1998, referenceOverall: 79, tolerance: 5, reason: "manual 7a0 screenshot/reference" },
  { id: "7a0-bra-1998-denilson", source: "SEVEN_A_ZERO_MANUAL", playerName: "Denilson", nationCode: "BRA", worldCupYear: 1998, referenceOverall: 77, tolerance: 5, reason: "manual 7a0 screenshot/reference" }
] as const satisfies readonly SevenAZeroManualReference[];

export function evaluateSevenAZeroManualReferences(
  cards: readonly RatingLabCardReport[]
): SevenAZeroManualReferenceResult[] {
  return SEVEN_A_ZERO_MANUAL_REFERENCES.map((reference) => evaluateSevenAZeroReference(reference, cards));
}

export const evaluateSevenAZeroReferences = evaluateSevenAZeroManualReferences;

export function evaluateSevenAZeroReference(
  reference: SevenAZeroManualReference,
  cards: readonly RatingLabCardReport[]
): SevenAZeroManualReferenceResult {
  const candidates = findManualReferenceCandidates(reference, cards);
  if (candidates.length === 0) {
    return { ...reference, status: "MISSING", actualRating: null, delta: null, candidateNames: [] };
  }

  const best = selectBestReferenceCandidate(reference, candidates);
  if (!best) {
    return {
      ...reference,
      status: "AMBIGUOUS",
      actualRating: null,
      delta: null,
      candidateNames: candidates.map((candidate) => candidate.internalRawName)
    };
  }

  const delta = best.overall - reference.referenceOverall;
  const absDelta = Math.abs(delta);
  const status = absDelta <= reference.tolerance ? "PASS" : absDelta <= reference.tolerance + 2 ? "WARN" : "FAIL";

  return {
    ...reference,
    status,
    actualRating: best.overall,
    delta,
    matchedInternalRawName: best.internalRawName,
    matchedPublicName: best.publicPlaceholderName,
    candidateNames: candidates.map((candidate) => candidate.internalRawName)
  };
}

export function findManualReferenceCandidates(
  reference: SevenAZeroManualReference,
  cards: readonly RatingLabCardReport[]
): RatingLabCardReport[] {
  const terms = referenceSearchTerms(reference).map(normalizeName);
  return cards.filter(
    (card) =>
      card.worldCupYear === reference.worldCupYear &&
      nationMatches(card.nation, reference.nationCode) &&
      terms.some((term) => referenceNameScore(normalizeName(card.internalRawName), term) > 0)
  );
}

function selectBestReferenceCandidate(
  reference: SevenAZeroManualReference,
  candidates: readonly RatingLabCardReport[]
): RatingLabCardReport | null {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: Math.max(
        ...referenceSearchTerms(reference).map((term) => referenceNameScore(normalizeName(candidate.internalRawName), normalizeName(term)))
      )
    }))
    .sort((left, right) => right.score - left.score || right.candidate.overall - left.candidate.overall);
  const [best, second] = scored;
  if (!best) return null;
  if (second && best.score === second.score) return null;
  return best.candidate;
}

function referenceSearchTerms(reference: SevenAZeroManualReference): string[] {
  return [reference.playerName, ...(reference.aliases ?? [])];
}

function referenceNameScore(name: string, term: string): number {
  if (name === term) return 4;
  if (name.endsWith(` ${term}`) || name.startsWith(`${term} `)) return 3;
  if (name.includes(term)) return 2;
  return 0;
}
