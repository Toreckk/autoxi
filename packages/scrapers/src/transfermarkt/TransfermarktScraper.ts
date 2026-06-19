import type { TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { RateLimiter } from "../shared/RateLimiter.js";
import type { TransfermarktProfileIdentityRow } from "./TransfermarktProfileIdentity.js";

export type TransfermarktSquadProvider = {
  listSquadPlayers(leagueId: string, season: number): Promise<TransfermarktSquadPlayer[]>;
};

export type TransfermarktProfileIdentityProvider = {
  getProfileIdentity(playerId: string, profileSlug?: string): Promise<TransfermarktProfileIdentityRow>;
};

export type TransfermarktFetch = (url: string, init: { headers: Record<string, string> }) => Promise<{
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

export type TransfermarktWebScraperOptions = {
  userAgent: string;
  rateLimitMs?: number;
  fetch?: TransfermarktFetch;
  maxClubsPerLeague?: number;
};

export type TransfermarktParserSpikeResult = {
  dependencyAdded: false;
  usable: "not_verified";
  reason: string;
};

export function transfermarktParserSpikeResult(): TransfermarktParserSpikeResult {
  return {
    dependencyAdded: false,
    usable: "not_verified",
    reason: "transfermarkt-parser was not added in this offline pass; package must be validated with a small live spike before use"
  };
}

export class NoopTransfermarktScraper implements TransfermarktSquadProvider {
  async listSquadPlayers(): Promise<TransfermarktSquadPlayer[]> {
    return [];
  }
}

export class TransfermarktWebScraper implements TransfermarktSquadProvider, TransfermarktProfileIdentityProvider {
  private readonly limiter: RateLimiter;
  private readonly fetchPage: TransfermarktFetch;

  constructor(private readonly options: TransfermarktWebScraperOptions) {
    if (!options.userAgent.trim()) throw new Error("Transfermarkt USER_AGENT is required for live enrichment.");
    this.limiter = new RateLimiter(options.rateLimitMs ?? 2500);
    this.fetchPage = options.fetch ?? globalThis.fetch;
  }

  async listSquadPlayers(leagueId: string, season: number): Promise<TransfermarktSquadPlayer[]> {
    const competitionHtml = await this.get(competitionUrl(leagueId, season));
    const clubUrls = parseTransfermarktClubUrls(competitionHtml, season).slice(0, this.options.maxClubsPerLeague);
    const players: TransfermarktSquadPlayer[] = [];
    for (const clubUrl of clubUrls) {
      const squadHtml = await this.get(clubUrl);
      players.push(...parseTransfermarktSquadPlayers(squadHtml, { leagueId, season }));
    }
    return uniquePlayers(players);
  }

  async getProfileIdentity(playerId: string, profileSlug = "-"): Promise<TransfermarktProfileIdentityRow> {
    const profileUrl = profileUrlFor(playerId, profileSlug);
    const html = await this.get(profileUrl);
    return parseTransfermarktProfileIdentity(html, { playerId, profileUrl, profileSlug });
  }

  private async get(url: string): Promise<string> {
    await this.limiter.wait();
    const response = await this.fetchPage(url, {
      headers: {
        "User-Agent": this.options.userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (response.status === 403 || response.status === 429) {
      throw new Error(`Transfermarkt enrichment stopped on HTTP ${response.status} ${response.statusText}. No bypass will be attempted.`);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Transfermarkt request failed with HTTP ${response.status} ${response.statusText}.`);
    }
    return response.text();
  }
}

export function competitionUrl(leagueId: string, season: number): string {
  return `https://www.transfermarkt.com/-/startseite/wettbewerb/${encodeURIComponent(leagueId)}/plus/?saison_id=${season}`;
}

export function profileUrlFor(playerId: string, profileSlug = "-"): string {
  return `https://www.transfermarkt.com/${encodeURIComponent(profileSlug || "-")}/profil/spieler/${encodeURIComponent(playerId)}`;
}

export function parseTransfermarktClubUrls(html: string, season: number): string[] {
  const urls = new Set<string>();
  const regex = /href="([^"]*\/startseite\/verein\/\d+[^"]*)"/giu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const raw = htmlDecode(match[1] ?? "");
    const squadPath = raw
      .replace(/^https?:\/\/www\.transfermarkt\.[^/]+/iu, "")
      .replace(/\/startseite\/verein\//iu, "/kader/verein/")
      .replace(/([?#].*)$/u, "");
    const withSeason = squadPath.includes("/saison_id/") ? squadPath : `${squadPath}/saison_id/${season}`;
    urls.add(`https://www.transfermarkt.com${withSeason}/plus/1`.replace(/\/+/gu, "/").replace("https:/", "https://"));
  }
  return [...urls];
}

export function parseTransfermarktProfileIdentity(
  html: string,
  context: { playerId: string; profileUrl: string; profileSlug?: string; extractedAt?: string }
): TransfermarktProfileIdentityRow {
  const canonicalName = htmlDecode(
    /<h1[^>]*>\s*(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?\s*<\/h1>/isu.exec(html)?.[1] ??
      /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/iu.exec(html)?.[1] ??
      ""
  ).replace(/\s+-\s+.*$/u, "");
  const profileSlug = context.profileSlug && context.profileSlug !== "-" ? context.profileSlug : slugFromProfileUrl(context.profileUrl);
  const dateOfBirth = profileValue(html, ["Date of birth/Age", "Date of birth"]);
  const citizenships = profileValue(html, ["Citizenship"]);
  const countryOfBirth = profileValue(html, ["Place of birth"]).split(/\s{2,}|\|/u).at(-1)?.trim() ?? "";
  const mainPosition = profileValue(html, ["Position"]);
  const foot = profileValue(html, ["Foot"]);
  const heightCm = heightToCm(profileValue(html, ["Height"]));
  const currentClub = profileValue(html, ["Current club"]);
  return {
    transfermarkt_player_id: context.playerId,
    canonical_name: canonicalName,
    profile_slug: profileSlug,
    profile_url: context.profileUrl,
    date_of_birth: dateOfBirth,
    birth_year: yearFromText(dateOfBirth),
    country_of_birth: countryOfBirth,
    citizenships,
    nationalities: citizenships,
    main_position: mainPosition,
    alternate_positions: "",
    foot,
    height_cm: heightCm,
    current_club: currentClub,
    source: "transfermarkt_profile",
    extracted_at: context.extractedAt ?? new Date().toISOString(),
    cache_status: "fetched",
    failure_reason: ""
  };
}

export function parseTransfermarktSquadPlayers(html: string, context: { leagueId: string; season: number }): TransfermarktSquadPlayer[] {
  return html
    .split(/<tr[^>]*class="(?:odd|even)"[^>]*>/iu)
    .slice(1)
    .flatMap((row) => {
      const profileHref = /<a[^>]+href="([^"]*\/profil\/spieler\/\d+[^"]*)"[^>]*>/isu.exec(row)?.[1] ?? "";
      const id = /\/profil\/spieler\/(\d+)/iu.exec(row)?.[1];
      const name = htmlDecode(/<a[^>]+href="[^"]*\/profil\/spieler\/\d+[^"]*"[^>]*>(.*?)<\/a>/isu.exec(row)?.[1] ?? "").trim();
      if (!id || !name) return [];
      const nationalities = [...row.matchAll(/<img[^>]*class="flaggenrahmen"[^>]*>/giu)]
        .flatMap((match) => imageLabel(match[0] ?? ""))
        .filter(Boolean);
      const birthText = htmlDecode(/<td[^>]*class="zentriert"[^>]*>([^<]*(?:\(\d+\))?[^<]*)<\/td>/iu.exec(row)?.[1] ?? "");
      const birthYear = /(\d{4})/u.exec(birthText)?.[1];
      const position = htmlDecode(/<td[^>]*class="posrela"[^>]*>.*?<td>(.*?)<\/td>/isu.exec(row)?.[1] ?? /<td[^>]*>(Goalkeeper|Defender|midfield|Attack|Centre-Forward|Left Winger|Right Winger|Second Striker|Central Midfield|Defensive Midfield|Attacking Midfield|Centre-Back|Left-Back|Right-Back)<\/td>/iu.exec(row)?.[1] ?? "");
      return [{
        playerId: id,
        name,
        nationalities,
        birthYear: birthYear ? Number(birthYear) : undefined,
        position,
        profileUrl: profileHref ? absoluteTransfermarktUrl(htmlDecode(profileHref)) : undefined,
        profileSlug: profileHref ? slugFromProfileUrl(`https://www.transfermarkt.com${htmlDecode(profileHref)}`) : undefined,
        leagueId: context.leagueId,
        season: context.season
      }];
    });
}

function uniquePlayers(players: readonly TransfermarktSquadPlayer[]): TransfermarktSquadPlayer[] {
  const seen = new Set<string>();
  return players.filter((player) => {
    const key = `${player.leagueId}:${player.season}:${player.playerId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function imageLabel(img: string): string[] {
  const title = /\btitle="([^"]+)"/iu.exec(img)?.[1];
  const alt = /\balt="([^"]+)"/iu.exec(img)?.[1];
  return [title, alt].filter((value): value is string => Boolean(value)).map(htmlDecode);
}

function profileValue(html: string, labels: readonly string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const definitionMatch = new RegExp(`<span[^>]*class="data-header__label"[^>]*>\\s*${escaped}:?\\s*<\\/span>\\s*<span[^>]*class="data-header__content"[^>]*>(.*?)<\\/span>`, "isu").exec(html);
    if (definitionMatch?.[1]) return htmlDecode(definitionMatch[1]);
    const infoMatch = new RegExp(`<span[^>]*class="info-table__content--regular"[^>]*>\\s*${escaped}:?\\s*<\\/span>\\s*<span[^>]*class="info-table__content--bold"[^>]*>(.*?)<\\/span>`, "isu").exec(html);
    if (infoMatch?.[1]) return htmlDecode(infoMatch[1]);
  }
  return "";
}

function slugFromProfileUrl(value: string): string {
  return /transfermarkt\.com\/([^/]+)\/profil\/spieler\//iu.exec(value)?.[1] ?? "";
}

function absoluteTransfermarktUrl(value: string): string {
  if (/^https?:\/\//iu.test(value)) return value;
  return `https://www.transfermarkt.com/${value.replace(/^\/+/u, "")}`;
}

function yearFromText(value: string): string {
  return /\b(18|19|20)\d{2}\b/u.exec(value)?.[0] ?? "";
}

function heightToCm(value: string): string {
  const metric = /(\d+(?:[,.]\d+)?)\s*m\b/iu.exec(value)?.[1];
  if (metric) return String(Math.round(Number(metric.replace(",", ".")) * 100));
  const cm = /(\d+)\s*cm\b/iu.exec(value)?.[1];
  return cm ?? "";
}

function htmlDecode(value: string): string {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/gu, " ")
    .trim();
}
