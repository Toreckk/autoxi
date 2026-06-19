import type { ManualCuratedRating } from "../../domain/types.js";

export const ICONIC_TARGET_SEARCH_TERMS = [
  "Messi",
  "Lionel Messi",
  "Pele",
  "Pelé",
  "Maradona",
  "Garrincha",
  "Johan Cruyff",
  "Cruyff",
  "Franz Beckenbauer",
  "Beckenbauer",
  "Eusebio",
  "Eusébio",
  "Gerd Muller",
  "Gerd Müller",
  "Ronaldo",
  "Ronaldo Nazario",
  "Ronaldo Luís",
  "Zinedine Zidane",
  "Zidane",
  "Romario",
  "Romário",
  "Paolo Rossi",
  "Roberto Baggio",
  "Zico",
  "Socrates",
  "Sócrates",
  "Lothar Matthaus",
  "Lothar Matthäus",
  "Andres Iniesta",
  "Andrés Iniesta",
  "Xavi",
  "Luka Modric",
  "Luka Modrić",
  "Kylian Mbappe",
  "Kylian Mbappé",
  "Miroslav Klose",
  "Lev Yashin",
  "Dino Zoff",
  "Gianluigi Buffon",
  "Iker Casillas",
  "Manuel Neuer"
] as const;

export const MANUAL_RATING_FLOORS = [
  {
    id: "manual-messi-2022",
    nameSearch: "Messi",
    aliases: ["Lionel Messi"],
    nationCode: "ARG",
    worldCupYear: 2022,
    floor: 96,
    reason: "Manual floor for 2022 Golden Ball champion."
  },
  {
    id: "manual-pele-1970",
    nameSearch: "Pele",
    aliases: ["Pelé", "Edson Arantes"],
    nationCode: "BRA",
    worldCupYear: 1970,
    floor: 95,
    reason: "Manual floor for all-time champion tournament."
  },
  {
    id: "manual-maradona-1986",
    nameSearch: "Maradona",
    aliases: ["Diego Maradona"],
    nationCode: "ARG",
    worldCupYear: 1986,
    floor: 97,
    reason: "Manual floor for all-time iconic tournament."
  },
  {
    id: "manual-garrincha-1962",
    nameSearch: "Garrincha",
    aliases: ["Manoel Francisco"],
    nationCode: "BRA",
    worldCupYear: 1962,
    floor: 94,
    reason: "Manual floor for historic tournament icon."
  },
  {
    id: "manual-cruyff-1974",
    nameSearch: "Cruyff",
    aliases: ["Johan Cruyff", "Johan Cruijff"],
    nationCode: "NED",
    worldCupYear: 1974,
    floor: 94,
    reason: "Manual floor for tournament-defining playmaker."
  },
  {
    id: "manual-beckenbauer-1974",
    nameSearch: "Beckenbauer",
    aliases: ["Franz Beckenbauer"],
    nationCode: "FRG",
    worldCupYear: 1974,
    floor: 94,
    reason: "Manual floor for champion captain and elite defender/libero."
  },
  {
    id: "manual-ronaldo-1998",
    nameSearch: "Ronaldo",
    aliases: ["Ronaldo Nazario", "Ronaldo Luís", "Ronaldo Luis"],
    nationCode: "BRA",
    worldCupYear: 1998,
    floor: 93,
    reason: "Manual floor for elite tournament forward."
  },
  {
    id: "manual-ronaldo-2002",
    nameSearch: "Ronaldo",
    aliases: ["Ronaldo Nazario", "Ronaldo Luís", "Ronaldo Luis"],
    nationCode: "BRA",
    worldCupYear: 2002,
    floor: 95,
    reason: "Manual floor for Golden Boot champion tournament."
  },
  {
    id: "manual-zidane-1998",
    nameSearch: "Zidane",
    aliases: ["Zinedine Zidane"],
    nationCode: "FRA",
    worldCupYear: 1998,
    floor: 92,
    reason: "Manual floor for champion final performance."
  },
  {
    id: "manual-zidane-2006",
    nameSearch: "Zidane",
    aliases: ["Zinedine Zidane"],
    nationCode: "FRA",
    worldCupYear: 2006,
    floor: 92,
    reason: "Manual floor for Golden Ball finalist tournament."
  },
  {
    id: "manual-romario-1994",
    nameSearch: "Romario",
    aliases: ["Romário"],
    nationCode: "BRA",
    worldCupYear: 1994,
    floor: 93,
    reason: "Manual floor for Golden Ball champion."
  },
  {
    id: "manual-paolo-rossi-1982",
    nameSearch: "Paolo Rossi",
    nationCode: "ITA",
    worldCupYear: 1982,
    floor: 92,
    reason: "Manual floor for Golden Boot champion."
  },
  {
    id: "manual-zico-1982",
    nameSearch: "Zico",
    nationCode: "BRA",
    worldCupYear: 1982,
    floor: 90,
    reason: "Manual floor for known icon edge case."
  },
  {
    id: "manual-socrates-1982",
    nameSearch: "Socrates",
    aliases: ["Sócrates"],
    nationCode: "BRA",
    worldCupYear: 1982,
    floor: 88,
    reason: "Manual floor for Brazil 1982 midfield icon."
  },
  {
    id: "manual-yashin-1966",
    nameSearch: "Yashin",
    aliases: ["Lev Yashin"],
    nationCode: "URS",
    worldCupYear: 1966,
    floor: 92,
    reason: "Manual goalkeeper icon floor."
  },
  {
    id: "manual-buffon-2006",
    nameSearch: "Buffon",
    aliases: ["Gianluigi Buffon"],
    nationCode: "ITA",
    worldCupYear: 2006,
    floor: 91,
    reason: "Manual goalkeeper floor for champion tournament."
  },
  {
    id: "manual-casillas-2010",
    nameSearch: "Casillas",
    aliases: ["Iker Casillas"],
    nationCode: "ESP",
    worldCupYear: 2010,
    floor: 91,
    reason: "Manual goalkeeper floor for champion tournament."
  },
  {
    id: "manual-neuer-2014",
    nameSearch: "Neuer",
    aliases: ["Manuel Neuer"],
    nationCode: "GER",
    worldCupYear: 2014,
    floor: 92,
    reason: "Manual goalkeeper floor for Golden Glove champion tournament."
  }
] as const satisfies readonly ManualCuratedRating[];

export const MANUAL_CURATED_RATINGS = MANUAL_RATING_FLOORS;
