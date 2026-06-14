import { createHash } from "node:crypto";
import {
  broadLineForPosition,
  costForTier,
  deriveTier,
  materialForTier,
  type CardRole,
  type VisiblePosition
} from "@autoxi/domain";

export function deterministicUuid(seed: string): string {
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 32).split("");
  hash[12] = "4";
  const variant = Number.parseInt(hash[16] ?? "8", 16);
  hash[16] = ((variant & 0x3) | 0x8).toString(16);
  const hex = hash.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const seedImportId = deterministicUuid("phase-1-seed-import");

export const seedNations = [
  ["arg", "AR", "ARG", "Argentina"],
  ["bra", "BR", "BRA", "Brazil"],
  ["cro", "HR", "CRO", "Croatia"],
  ["eng", "GB", "ENG", "England"],
  ["fra", "FR", "FRA", "France"],
  ["ger", "DE", "GER", "Germany"],
  ["gha", "GH", "GHA", "Ghana"],
  ["jpn", "JP", "JPN", "Japan"],
  ["kor", "KR", "KOR", "Korea Republic"],
  ["mar", "MA", "MAR", "Morocco"],
  ["mex", "MX", "MEX", "Mexico"],
  ["ned", "NL", "NED", "Netherlands"],
  ["por", "PT", "POR", "Portugal"],
  ["sen", "SN", "SEN", "Senegal"],
  ["spa", "ES", "ESP", "Spain"],
  ["uru", "UY", "URU", "Uruguay"],
  ["usa", "US", "USA", "United States"]
] as const;

export const seedEditions = [
  [1986, "Mexico", "MEX"],
  [1994, "United States", "USA"],
  [1998, "France", "FRA"],
  [2002, "Korea/Japan", "KOR"],
  [2006, "Germany", "GER"],
  [2010, "South Africa", "RSA"],
  [2014, "Brazil", "BRA"],
  [2018, "Russia", "RUS"],
  [2022, "Qatar", "QAT"]
] as const;

type SeedCardInput = {
  displayName: string;
  shortName: string;
  nation: (typeof seedNations)[number][0];
  year: (typeof seedEditions)[number][0];
  rating: number;
  position: VisiblePosition;
  role: CardRole;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
    goalkeeping: number;
  };
};

const cards: SeedCardInput[] = [
  { displayName: "Renzo Auric", shortName: "Auric", nation: "bra", year: 1986, rating: 99, position: "CAM", role: "Creator", stats: { pace: 93, shooting: 96, passing: 97, dribbling: 99, defending: 54, physical: 82, goalkeeping: 7 } },
  { displayName: "Aurel Voss", shortName: "Voss", nation: "ger", year: 2006, rating: 94, position: "CM", role: "Tempo Setter", stats: { pace: 78, shooting: 86, passing: 96, dribbling: 91, defending: 82, physical: 84, goalkeeping: 8 } },
  { displayName: "Mateo Ardan", shortName: "Ardan", nation: "arg", year: 1986, rating: 93, position: "CAM", role: "Creator", stats: { pace: 88, shooting: 91, passing: 92, dribbling: 97, defending: 42, physical: 76, goalkeeping: 6 } },
  { displayName: "Thiago Bravon", shortName: "Bravon", nation: "bra", year: 2002, rating: 92, position: "ST", role: "Finisher", stats: { pace: 91, shooting: 94, passing: 84, dribbling: 93, defending: 35, physical: 82, goalkeeping: 5 } },
  { displayName: "Julien Marceau", shortName: "Marceau", nation: "fra", year: 1998, rating: 91, position: "CB", role: "Anchor", stats: { pace: 77, shooting: 61, passing: 78, dribbling: 73, defending: 94, physical: 91, goalkeeping: 7 } },
  { displayName: "Santiago Valez", shortName: "Valez", nation: "uru", year: 2010, rating: 90, position: "ST", role: "Finisher", stats: { pace: 84, shooting: 93, passing: 78, dribbling: 87, defending: 47, physical: 88, goalkeeping: 9 } },
  { displayName: "Rafael Solari", shortName: "Solari", nation: "spa", year: 2010, rating: 89, position: "CM", role: "Tempo Setter", stats: { pace: 74, shooting: 79, passing: 95, dribbling: 91, defending: 76, physical: 72, goalkeeping: 5 } },
  { displayName: "Kenji Morita", shortName: "Morita", nation: "jpn", year: 2022, rating: 88, position: "RW", role: "Wide Threat", stats: { pace: 92, shooting: 83, passing: 84, dribbling: 90, defending: 48, physical: 68, goalkeeping: 6 } },
  { displayName: "Dario Kova", shortName: "Kova", nation: "cro", year: 2018, rating: 88, position: "CM", role: "Creator", stats: { pace: 76, shooting: 82, passing: 92, dribbling: 89, defending: 73, physical: 75, goalkeeping: 6 } },
  { displayName: "Omar El Hadi", shortName: "El Hadi", nation: "mar", year: 2022, rating: 87, position: "RB", role: "Wingback", stats: { pace: 88, shooting: 62, passing: 79, dribbling: 82, defending: 86, physical: 83, goalkeeping: 7 } },
  { displayName: "Niko Van Daal", shortName: "Van Daal", nation: "ned", year: 2014, rating: 87, position: "CB", role: "Anchor", stats: { pace: 79, shooting: 58, passing: 77, dribbling: 72, defending: 90, physical: 88, goalkeeping: 6 } },
  { displayName: "Luca Ferreira", shortName: "Ferreira", nation: "por", year: 2006, rating: 86, position: "LW", role: "Wide Threat", stats: { pace: 91, shooting: 84, passing: 81, dribbling: 92, defending: 39, physical: 71, goalkeeping: 5 } },
  { displayName: "Elias Mensah", shortName: "Mensah", nation: "gha", year: 2010, rating: 85, position: "CDM", role: "Ball Winner", stats: { pace: 78, shooting: 73, passing: 80, dribbling: 79, defending: 88, physical: 90, goalkeeping: 8 } },
  { displayName: "Noah Sterling", shortName: "Sterling", nation: "eng", year: 2018, rating: 85, position: "ST", role: "Finisher", stats: { pace: 86, shooting: 87, passing: 75, dribbling: 82, defending: 42, physical: 84, goalkeeping: 6 } },
  { displayName: "Hugo Santoro", shortName: "Santoro", nation: "arg", year: 2014, rating: 84, position: "LW", role: "Creator", stats: { pace: 87, shooting: 82, passing: 84, dribbling: 89, defending: 44, physical: 70, goalkeeping: 6 } },
  { displayName: "Marcos Ibarra", shortName: "Ibarra", nation: "mex", year: 1994, rating: 84, position: "GK", role: "Shot Stopper", stats: { pace: 52, shooting: 26, passing: 64, dribbling: 48, defending: 40, physical: 82, goalkeeping: 89 } },
  { displayName: "Tariq Sane", shortName: "Sane", nation: "sen", year: 2022, rating: 83, position: "LW", role: "Wide Threat", stats: { pace: 93, shooting: 82, passing: 76, dribbling: 86, defending: 41, physical: 78, goalkeeping: 5 } },
  { displayName: "Min-jae Park", shortName: "Park", nation: "kor", year: 2002, rating: 83, position: "CB", role: "Anchor", stats: { pace: 76, shooting: 55, passing: 70, dribbling: 69, defending: 86, physical: 85, goalkeeping: 8 } },
  { displayName: "Cole Mercer", shortName: "Mercer", nation: "usa", year: 1994, rating: 82, position: "CM", role: "Tempo Setter", stats: { pace: 78, shooting: 77, passing: 84, dribbling: 80, defending: 74, physical: 79, goalkeeping: 7 } },
  { displayName: "Bastien Roche", shortName: "Roche", nation: "fra", year: 2018, rating: 82, position: "ST", role: "Finisher", stats: { pace: 82, shooting: 85, passing: 72, dribbling: 78, defending: 38, physical: 86, goalkeeping: 6 } },
  { displayName: "Joao Mirel", shortName: "Mirel", nation: "bra", year: 2014, rating: 81, position: "RB", role: "Wingback", stats: { pace: 86, shooting: 68, passing: 79, dribbling: 82, defending: 80, physical: 77, goalkeeping: 5 } },
  { displayName: "Emil Hartmann", shortName: "Hartmann", nation: "ger", year: 2014, rating: 81, position: "GK", role: "Shot Stopper", stats: { pace: 47, shooting: 22, passing: 71, dribbling: 43, defending: 39, physical: 81, goalkeeping: 86 } },
  { displayName: "Ivan Rados", shortName: "Rados", nation: "cro", year: 1998, rating: 80, position: "ST", role: "Finisher", stats: { pace: 79, shooting: 84, passing: 74, dribbling: 78, defending: 40, physical: 82, goalkeeping: 6 } },
  { displayName: "Moussa Faye", shortName: "Faye", nation: "sen", year: 2018, rating: 80, position: "CDM", role: "Ball Winner", stats: { pace: 77, shooting: 65, passing: 75, dribbling: 74, defending: 83, physical: 87, goalkeeping: 6 } },
  { displayName: "Diego Rivas", shortName: "Rivas", nation: "mex", year: 2006, rating: 79, position: "CAM", role: "Creator", stats: { pace: 78, shooting: 76, passing: 82, dribbling: 84, defending: 50, physical: 70, goalkeeping: 5 } },
  { displayName: "Kazuo Hayashi", shortName: "Hayashi", nation: "jpn", year: 2010, rating: 79, position: "LM", role: "Wide Threat", stats: { pace: 85, shooting: 74, passing: 80, dribbling: 82, defending: 58, physical: 67, goalkeeping: 6 } },
  { displayName: "Andre Beaumont", shortName: "Beaumont", nation: "eng", year: 1998, rating: 78, position: "CB", role: "Anchor", stats: { pace: 70, shooting: 54, passing: 69, dribbling: 65, defending: 82, physical: 84, goalkeeping: 7 } },
  { displayName: "Luis Caldero", shortName: "Caldero", nation: "spa", year: 2002, rating: 78, position: "LB", role: "Wingback", stats: { pace: 82, shooting: 59, passing: 76, dribbling: 78, defending: 78, physical: 75, goalkeeping: 6 } },
  { displayName: "Samir Haddou", shortName: "Haddou", nation: "mar", year: 1998, rating: 77, position: "CAM", role: "Creator", stats: { pace: 76, shooting: 73, passing: 80, dribbling: 82, defending: 48, physical: 68, goalkeeping: 6 } },
  { displayName: "Dylan Brooks", shortName: "Brooks", nation: "usa", year: 2022, rating: 77, position: "RW", role: "Wide Threat", stats: { pace: 87, shooting: 73, passing: 74, dribbling: 81, defending: 45, physical: 72, goalkeeping: 5 } },
  { displayName: "Yuri Noval", shortName: "Noval", nation: "por", year: 2018, rating: 76, position: "CM", role: "Tempo Setter", stats: { pace: 72, shooting: 72, passing: 80, dribbling: 78, defending: 70, physical: 73, goalkeeping: 6 } },
  { displayName: "Tomas Keller", shortName: "Keller", nation: "ger", year: 1994, rating: 75, position: "RB", role: "Wingback", stats: { pace: 79, shooting: 55, passing: 70, dribbling: 72, defending: 77, physical: 76, goalkeeping: 6 } },
  { displayName: "Facundo Lira", shortName: "Lira", nation: "uru", year: 2022, rating: 75, position: "CDM", role: "Ball Winner", stats: { pace: 70, shooting: 64, passing: 72, dribbling: 71, defending: 79, physical: 83, goalkeeping: 5 } },
  { displayName: "Kwame Adjei", shortName: "Adjei", nation: "gha", year: 2006, rating: 74, position: "RM", role: "Wide Threat", stats: { pace: 84, shooting: 71, passing: 72, dribbling: 76, defending: 54, physical: 74, goalkeeping: 5 } },
  { displayName: "Pieter Loman", shortName: "Loman", nation: "ned", year: 2006, rating: 74, position: "CM", role: "Tempo Setter", stats: { pace: 68, shooting: 68, passing: 78, dribbling: 76, defending: 69, physical: 70, goalkeeping: 6 } },
  { displayName: "Seung-ho Han", shortName: "Han", nation: "kor", year: 2018, rating: 73, position: "GK", role: "Shot Stopper", stats: { pace: 50, shooting: 20, passing: 58, dribbling: 41, defending: 38, physical: 75, goalkeeping: 80 } },
  { displayName: "Bruno Canto", shortName: "Canto", nation: "bra", year: 1994, rating: 72, position: "LB", role: "Wingback", stats: { pace: 80, shooting: 58, passing: 69, dribbling: 73, defending: 74, physical: 70, goalkeeping: 5 } },
  { displayName: "Luc Renard", shortName: "Renard", nation: "fra", year: 2006, rating: 71, position: "CDM", role: "Ball Winner", stats: { pace: 66, shooting: 61, passing: 70, dribbling: 68, defending: 76, physical: 79, goalkeeping: 7 } },
  { displayName: "Adrian Bexley", shortName: "Bexley", nation: "eng", year: 2010, rating: 70, position: "ST", role: "Finisher", stats: { pace: 74, shooting: 75, passing: 61, dribbling: 68, defending: 36, physical: 76, goalkeeping: 5 } },
  { displayName: "Iker Moreno", shortName: "Moreno", nation: "spa", year: 1994, rating: 69, position: "GK", role: "Shot Stopper", stats: { pace: 46, shooting: 18, passing: 56, dribbling: 38, defending: 34, physical: 73, goalkeeping: 76 } },
  { displayName: "Riku Tanabe", shortName: "Tanabe", nation: "jpn", year: 1998, rating: 68, position: "CM", role: "Tempo Setter", stats: { pace: 70, shooting: 62, passing: 72, dribbling: 70, defending: 62, physical: 64, goalkeeping: 5 } },
  { displayName: "Milo Hart", shortName: "Hart", nation: "usa", year: 1994, rating: 62, position: "ST", role: "Finisher", stats: { pace: 64, shooting: 63, passing: 51, dribbling: 58, defending: 30, physical: 66, goalkeeping: 4 } }
];

export const seedCards = cards.map((card, index) => {
  const tier = deriveTier(card.rating);
  return {
    ...card,
    ordinal: index + 1,
    identityKey: `phase1-${card.shortName.toLowerCase().replaceAll(" ", "-")}-${card.year}`,
    broadLine: broadLineForPosition(card.position),
    tier,
    materialKey: materialForTier(tier),
    cost: costForTier(tier)
  };
});
