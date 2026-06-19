import { normalizeName } from "../../utils.js";

export type NationAliasIndex = ReadonlyMap<string, string>;

export const STATIC_NATION_ALIASES: Record<string, string> = {
  Argentina: "ARG",
  Brazil: "BRA",
  Germany: "DEU",
  "West Germany": "DEU",
  FRG: "DEU",
  France: "FRA",
  Italy: "ITA",
  Spain: "ESP",
  Portugal: "PRT",
  Netherlands: "NLD",
  Holland: "NLD",
  Croatia: "HRV",
  Sweden: "SWE",
  "United States": "USA",
  USA: "USA",
  "South Korea": "KOR",
  "Korea Republic": "KOR",
  "Ivory Coast": "CIV",
  "Cote d'Ivoire": "CIV",
  "Côte d'Ivoire": "CIV",
  "Soviet Union": "URS",
  USSR: "URS",
  Czechoslovakia: "CSK",
  Yugoslavia: "YUG",
  England: "ENG",
  Scotland: "SCO",
  Wales: "WAL",
  "Northern Ireland": "NIR",
  Ireland: "IRL",
  "Republic of Ireland": "IRL",
  Uruguay: "URY",
  Mexico: "MEX",
  Poland: "POL",
  Belgium: "BEL",
  Cameroon: "CMR",
  Chile: "CHL",
  Colombia: "COL",
  Ecuador: "ECU",
  Ghana: "GHA",
  Japan: "JPN",
  Morocco: "MAR",
  Nigeria: "NGA",
  Senegal: "SEN",
  Tunisia: "TUN"
};

export function createStaticNationAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const [alias, code] of Object.entries(STATIC_NATION_ALIASES)) {
    addNationAlias(index, alias, code);
    addNationAlias(index, code, code);
  }
  return index;
}

export function addNationAlias(index: Map<string, string>, alias: string | undefined, code: string | undefined): void {
  if (!alias || !code) return;
  const normalizedAlias = normalizeName(alias);
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedAlias || !normalizedCode) return;
  index.set(normalizedAlias, normalizedCode);
}

export function normalizeNationToCode(value: string | undefined, index: NationAliasIndex = createStaticNationAliasIndex()): string | null {
  const normalized = normalizeName(value ?? "");
  if (!normalized) return null;
  const direct = index.get(normalized);
  if (direct) return direct;
  if (/^[a-z]{3}$/.test(normalized)) return normalized.toUpperCase();
  return null;
}
