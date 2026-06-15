import { createHash } from "node:crypto";
import {
  broadLineForPosition,
  costForTier,
  deriveTier,
  materialForTier,
  statProfileForPosition,
  type CardEditionKey,
  type CardRole,
  type PlayerCardStatsDto,
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

export const seedImportId = deterministicUuid("curated-fictional-seed-v1");

export const seedNations = [
  ["arg", "AR", "ARG", "Argentina"],
  ["bra", "BR", "BRA", "Brazil"],
  ["cro", "HR", "CRO", "Croatia"],
  ["eng", "GB", "ENG", "England"],
  ["fra", "FR", "FRA", "France"],
  ["ger", "DE", "GER", "Germany"],
  ["gha", "GH", "GHA", "Ghana"],
  ["ita", "IT", "ITA", "Italy"],
  ["jpn", "JP", "JPN", "Japan"],
  ["kor", "KR", "KOR", "Korea Republic"],
  ["mar", "MA", "MAR", "Morocco"],
  ["mex", "MX", "MEX", "Mexico"],
  ["ned", "NL", "NED", "Netherlands"],
  ["nor", "NO", "NOR", "Norway"],
  ["por", "PT", "POR", "Portugal"],
  ["sen", "SN", "SEN", "Senegal"],
  ["spa", "ES", "ESP", "Spain"],
  ["uru", "UY", "URU", "Uruguay"],
  ["usa", "US", "USA", "United States"]
] as const;

export const seedEditions = [
  [1986, "Mexico", "MEX"],
  [1990, "Italy", "ITA"],
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
  editionKey?: CardEditionKey;
  stats: PlayerCardStatsDto;
};

const cards: SeedCardInput[] = [
  { displayName: "Renzo Auric", shortName: "Auric", nation: "bra", year: 1986, rating: 99, position: "CAM", role: "Creator", stats: { profile: "OUTFIELD", pace: 93, shooting: 96, passing: 97, dribbling: 99, defending: 54, physical: 82 } },
  { displayName: "Aurel Voss", shortName: "Voss", nation: "ger", year: 2006, rating: 94, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 78, shooting: 86, passing: 96, dribbling: 91, defending: 82, physical: 84 } },
  { displayName: "Mateo Ardan", shortName: "Ardan", nation: "arg", year: 1986, rating: 93, position: "CAM", role: "Creator", stats: { profile: "OUTFIELD", pace: 88, shooting: 91, passing: 92, dribbling: 97, defending: 42, physical: 76 } },
  { displayName: "Thiago Bravon", shortName: "Bravon", nation: "bra", year: 2002, rating: 92, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 91, shooting: 94, passing: 84, dribbling: 93, defending: 35, physical: 82 } },
  { displayName: "Julien Marceau", shortName: "Marceau", nation: "fra", year: 1998, rating: 91, position: "CB", role: "Anchor", stats: { profile: "OUTFIELD", pace: 77, shooting: 61, passing: 78, dribbling: 73, defending: 94, physical: 91 } },
  { displayName: "Santiago Valez", shortName: "Valez", nation: "uru", year: 2010, rating: 90, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 84, shooting: 93, passing: 78, dribbling: 87, defending: 47, physical: 88 } },
  { displayName: "Rafael Solari", shortName: "Solari", nation: "spa", year: 2010, rating: 89, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 74, shooting: 79, passing: 95, dribbling: 91, defending: 76, physical: 72 } },
  { displayName: "Kenji Morita", shortName: "Morita", nation: "jpn", year: 2022, rating: 88, position: "RW", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 92, shooting: 83, passing: 84, dribbling: 90, defending: 48, physical: 68 } },
  { displayName: "Dario Kova", shortName: "Kova", nation: "cro", year: 2018, rating: 88, position: "CM", role: "Creator", stats: { profile: "OUTFIELD", pace: 76, shooting: 82, passing: 92, dribbling: 89, defending: 73, physical: 75 } },
  { displayName: "Omar El Hadi", shortName: "El Hadi", nation: "mar", year: 2022, rating: 87, position: "RB", role: "Wingback", stats: { profile: "OUTFIELD", pace: 88, shooting: 62, passing: 79, dribbling: 82, defending: 86, physical: 83 } },
  { displayName: "Niko Van Daal", shortName: "Van Daal", nation: "ned", year: 2014, rating: 87, position: "CB", role: "Anchor", stats: { profile: "OUTFIELD", pace: 79, shooting: 58, passing: 77, dribbling: 72, defending: 90, physical: 88 } },
  { displayName: "Luca Ferreira", shortName: "Ferreira", nation: "por", year: 2006, rating: 86, position: "LW", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 91, shooting: 84, passing: 81, dribbling: 92, defending: 39, physical: 71 } },
  { displayName: "Elias Mensah", shortName: "Mensah", nation: "gha", year: 2010, rating: 85, position: "CDM", role: "Ball Winner", stats: { profile: "OUTFIELD", pace: 78, shooting: 73, passing: 80, dribbling: 79, defending: 88, physical: 90 } },
  { displayName: "Noah Sterling", shortName: "Sterling", nation: "eng", year: 2018, rating: 85, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 86, shooting: 87, passing: 75, dribbling: 82, defending: 42, physical: 84 } },
  { displayName: "Hugo Santoro", shortName: "Santoro", nation: "arg", year: 2014, rating: 84, position: "LW", role: "Creator", stats: { profile: "OUTFIELD", pace: 87, shooting: 82, passing: 84, dribbling: 89, defending: 44, physical: 70 } },
  { displayName: "Marcos Ibarra", shortName: "Ibarra", nation: "mex", year: 1994, rating: 84, position: "GK", role: "Shot Stopper", stats: { profile: "GOALKEEPER", diving: 89, handling: 82, kicking: 64, reflexes: 91, speed: 52, positioning: 85 } },
  { displayName: "Tariq Sane", shortName: "Sane", nation: "sen", year: 2022, rating: 83, position: "LW", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 93, shooting: 82, passing: 76, dribbling: 86, defending: 41, physical: 78 } },
  { displayName: "Min-jae Park", shortName: "Park", nation: "kor", year: 2002, rating: 83, position: "CB", role: "Anchor", stats: { profile: "OUTFIELD", pace: 76, shooting: 55, passing: 70, dribbling: 69, defending: 86, physical: 85 } },
  { displayName: "Cole Mercer", shortName: "Mercer", nation: "usa", year: 1994, rating: 82, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 78, shooting: 77, passing: 84, dribbling: 80, defending: 74, physical: 79 } },
  { displayName: "Bastien Roche", shortName: "Roche", nation: "fra", year: 2018, rating: 82, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 82, shooting: 85, passing: 72, dribbling: 78, defending: 38, physical: 86 } },
  { displayName: "Joao Mirel", shortName: "Mirel", nation: "bra", year: 2014, rating: 81, position: "RB", role: "Wingback", stats: { profile: "OUTFIELD", pace: 86, shooting: 68, passing: 79, dribbling: 82, defending: 80, physical: 77 } },
  { displayName: "Emil Hartmann", shortName: "Hartmann", nation: "ger", year: 2014, rating: 81, position: "GK", role: "Shot Stopper", stats: { profile: "GOALKEEPER", diving: 86, handling: 81, kicking: 71, reflexes: 88, speed: 47, positioning: 84 } },
  { displayName: "Ivan Rados", shortName: "Rados", nation: "cro", year: 1998, rating: 80, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 79, shooting: 84, passing: 74, dribbling: 78, defending: 40, physical: 82 } },
  { displayName: "Moussa Faye", shortName: "Faye", nation: "sen", year: 2018, rating: 80, position: "CDM", role: "Ball Winner", stats: { profile: "OUTFIELD", pace: 77, shooting: 65, passing: 75, dribbling: 74, defending: 83, physical: 87 } },
  { displayName: "Diego Rivas", shortName: "Rivas", nation: "mex", year: 2006, rating: 79, position: "CAM", role: "Creator", stats: { profile: "OUTFIELD", pace: 78, shooting: 76, passing: 82, dribbling: 84, defending: 50, physical: 70 } },
  { displayName: "Kazuo Hayashi", shortName: "Hayashi", nation: "jpn", year: 2010, rating: 79, position: "LM", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 85, shooting: 74, passing: 80, dribbling: 82, defending: 58, physical: 67 } },
  { displayName: "Andre Beaumont", shortName: "Beaumont", nation: "eng", year: 1998, rating: 78, position: "CB", role: "Anchor", stats: { profile: "OUTFIELD", pace: 70, shooting: 54, passing: 69, dribbling: 65, defending: 82, physical: 84 } },
  { displayName: "Luis Caldero", shortName: "Caldero", nation: "spa", year: 2002, rating: 78, position: "LB", role: "Wingback", stats: { profile: "OUTFIELD", pace: 82, shooting: 59, passing: 76, dribbling: 78, defending: 78, physical: 75 } },
  { displayName: "Samir Haddou", shortName: "Haddou", nation: "mar", year: 1998, rating: 77, position: "CAM", role: "Creator", stats: { profile: "OUTFIELD", pace: 76, shooting: 73, passing: 80, dribbling: 82, defending: 48, physical: 68 } },
  { displayName: "Dylan Brooks", shortName: "Brooks", nation: "usa", year: 2022, rating: 77, position: "RW", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 87, shooting: 73, passing: 74, dribbling: 81, defending: 45, physical: 72 } },
  { displayName: "Yuri Noval", shortName: "Noval", nation: "por", year: 2018, rating: 76, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 72, shooting: 72, passing: 80, dribbling: 78, defending: 70, physical: 73 } },
  { displayName: "Tomas Keller", shortName: "Keller", nation: "ger", year: 1994, rating: 75, position: "RB", role: "Wingback", stats: { profile: "OUTFIELD", pace: 79, shooting: 55, passing: 70, dribbling: 72, defending: 77, physical: 76 } },
  { displayName: "Facundo Lira", shortName: "Lira", nation: "uru", year: 2022, rating: 75, position: "CDM", role: "Ball Winner", stats: { profile: "OUTFIELD", pace: 70, shooting: 64, passing: 72, dribbling: 71, defending: 79, physical: 83 } },
  { displayName: "Kwame Adjei", shortName: "Adjei", nation: "gha", year: 2006, rating: 74, position: "RM", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 84, shooting: 71, passing: 72, dribbling: 76, defending: 54, physical: 74 } },
  { displayName: "Pieter Loman", shortName: "Loman", nation: "ned", year: 2006, rating: 74, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 68, shooting: 68, passing: 78, dribbling: 76, defending: 69, physical: 70 } },
  { displayName: "Seung-ho Han", shortName: "Han", nation: "kor", year: 2018, rating: 73, position: "GK", role: "Shot Stopper", stats: { profile: "GOALKEEPER", diving: 80, handling: 75, kicking: 58, reflexes: 82, speed: 50, positioning: 83 } },
  { displayName: "Bruno Canto", shortName: "Canto", nation: "bra", year: 1994, rating: 72, position: "LB", role: "Wingback", stats: { profile: "OUTFIELD", pace: 80, shooting: 58, passing: 69, dribbling: 73, defending: 74, physical: 70 } },
  { displayName: "Luc Renard", shortName: "Renard", nation: "fra", year: 2006, rating: 71, position: "CDM", role: "Ball Winner", stats: { profile: "OUTFIELD", pace: 66, shooting: 61, passing: 70, dribbling: 68, defending: 76, physical: 79 } },
  { displayName: "Adrian Bexley", shortName: "Bexley", nation: "eng", year: 2010, rating: 70, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 74, shooting: 75, passing: 61, dribbling: 68, defending: 36, physical: 76 } },
  { displayName: "Iker Moreno", shortName: "Moreno", nation: "spa", year: 1994, rating: 69, position: "GK", role: "Shot Stopper", stats: { profile: "GOALKEEPER", diving: 76, handling: 73, kicking: 56, reflexes: 78, speed: 46, positioning: 79 } },
  { displayName: "Riku Tanabe", shortName: "Tanabe", nation: "jpn", year: 1998, rating: 68, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 70, shooting: 62, passing: 72, dribbling: 70, defending: 62, physical: 64 } },
  { displayName: "Milo Hart", shortName: "Hart", nation: "usa", year: 1994, rating: 62, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 64, shooting: 63, passing: 51, dribbling: 58, defending: 30, physical: 66 } },
  { displayName: "Timo Van Daal", shortName: "T. Van Daal", nation: "ned", year: 2014, rating: 61, position: "CM", role: "Tempo Setter", stats: { profile: "OUTFIELD", pace: 60, shooting: 57, passing: 66, dribbling: 62, defending: 58, physical: 64 } },
  { displayName: "Rafa Linho", shortName: "Linho", nation: "bra", year: 2022, rating: 71, position: "RW", role: "Wide Threat", stats: { profile: "OUTFIELD", pace: 79, shooting: 70, passing: 68, dribbling: 77, defending: 42, physical: 61 } },
  { displayName: "Wes Salin", shortName: "Salin", nation: "fra", year: 2018, rating: 78, position: "CB", role: "Anchor", stats: { profile: "OUTFIELD", pace: 72, shooting: 45, passing: 66, dribbling: 64, defending: 80, physical: 81 } },
  { displayName: "Jules Alvar", shortName: "Alvar", nation: "arg", year: 2010, rating: 83, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 84, shooting: 85, passing: 73, dribbling: 82, defending: 38, physical: 77 } },
  { displayName: "Bruno Feran", shortName: "Feran", nation: "por", year: 1986, rating: 88, position: "CAM", role: "Creator", stats: { profile: "OUTFIELD", pace: 77, shooting: 86, passing: 90, dribbling: 87, defending: 61, physical: 75 } },
  { displayName: "Marek Neuer", shortName: "Neuer", nation: "ger", year: 1990, rating: 92, position: "GK", role: "Shot Stopper", stats: { profile: "GOALKEEPER", diving: 94, handling: 90, kicking: 82, reflexes: 95, speed: 58, positioning: 93 } },
  { displayName: "Elias Haland", shortName: "Haland", nation: "nor", year: 1998, rating: 97, position: "ST", role: "Finisher", stats: { profile: "OUTFIELD", pace: 91, shooting: 97, passing: 80, dribbling: 88, defending: 43, physical: 96 } },
  { displayName: "Nico Serrat", shortName: "Serrat", nation: "fra", year: 2022, rating: 97, position: "LW", role: "Finisher", editionKey: "GOLDEN_BOOT", stats: { profile: "OUTFIELD", pace: 96, shooting: 97, passing: 86, dribbling: 94, defending: 39, physical: 83 } },
  { displayName: "Leo Aranda", shortName: "Aranda", nation: "arg", year: 2022, rating: 98, position: "CAM", role: "Creator", editionKey: "GOLDEN_BALL", stats: { profile: "OUTFIELD", pace: 87, shooting: 95, passing: 98, dribbling: 99, defending: 48, physical: 78 } },
  { displayName: "Jude Bellan", shortName: "Bellan", nation: "eng", year: 2022, rating: 91, position: "CM", role: "Ball Winner", editionKey: "BEST_YOUNG_PLAYER", stats: { profile: "OUTFIELD", pace: 84, shooting: 83, passing: 91, dribbling: 90, defending: 86, physical: 88 } },
  { displayName: "Emilio Duarte", shortName: "Duarte", nation: "arg", year: 2022, rating: 94, position: "GK", role: "Shot Stopper", editionKey: "GOLDEN_GLOVE", stats: { profile: "GOALKEEPER", diving: 95, handling: 91, kicking: 84, reflexes: 96, speed: 56, positioning: 93 } }
];

export const seedWorldCupAwards = [
  ["GOLDEN_BOOT", "Golden Boot", "Top scorer award."],
  ["GOLDEN_BALL", "Golden Ball", "Best player award."],
  ["BEST_YOUNG_PLAYER", "Best Young Player", "Best young player award."],
  ["GOLDEN_GLOVE", "Golden Glove", "Best goalkeeper award."]
] as const;

export const seedTeamResults = [
  [1998, "fra", "HOST", null],
  [1998, "fra", "CHAMPION", 1],
  [1998, "bra", "RUNNER_UP", 2],
  [2014, "bra", "HOST", null],
  [2014, "ger", "CHAMPION", 1],
  [2014, "arg", "RUNNER_UP", 2],
  [2022, "arg", "CHAMPION", 1],
  [2022, "fra", "RUNNER_UP", 2]
] as const;

export const seedCards = cards.map((card, index) => {
  const tier = deriveTier(card.rating);
  const statProfile = statProfileForPosition(card.position);
  if (card.stats.profile !== statProfile) {
    throw new Error(`Seed card ${card.displayName} uses ${card.stats.profile} stats for ${card.position}`);
  }
  const editionKey = card.editionKey ?? "NONE";

  return {
    ...card,
    editionKey,
    ordinal: index + 1,
    identityKey: `curated-${card.shortName.toLowerCase().replaceAll(" ", "-")}-${card.year}`,
    broadLine: broadLineForPosition(card.position),
    statProfile,
    tier,
    baseMaterialKey: materialForTier(tier),
    // Persist the base tier material; special edition visuals are derived from editionKey in the public API.
    materialKey: materialForTier(tier),
    cost: costForTier(tier)
  };
});
