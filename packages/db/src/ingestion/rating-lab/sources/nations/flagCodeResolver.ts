import { normalizeNationToCode } from "./normalizeNation.js";

const FIFA_TO_FLAG_CODE: Record<string, string> = {
  ARG: "ar",
  BRA: "br",
  FRA: "fr",
  DEU: "de",
  FRG: "de",
  HRV: "hr",
  SWE: "se",
  ITA: "it",
  ESP: "es",
  PRT: "pt",
  NLD: "nl",
  KOR: "kr",
  JPN: "jp",
  USA: "us",
  MEX: "mx",
  POL: "pl",
  BEL: "be",
  CMR: "cm",
  CIV: "ci",
  DZA: "dz",
  IRN: "ir",
  TUN: "tn",
  HUN: "hu",
  MAR: "ma",
  URY: "uy",
  URU: "uy",
  CHL: "cl",
  COL: "co",
  PER: "pe",
  PRY: "py",
  PAR: "py",
  ECU: "ec",
  SEN: "sn",
  GHA: "gh",
  NGA: "ng",
  ENG: "eng",
  SCO: "sco",
  WAL: "wal",
  NIR: "nir"
};

export function resolveFlagCode(value: string | undefined): string {
  const code = normalizeNationToCode(value) ?? value?.trim().toUpperCase();
  if (!code) return "unknown";
  return (FIFA_TO_FLAG_CODE[code] ?? code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)) || "unknown";
}
