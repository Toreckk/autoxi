import type { TransfermarktSquadPlayer } from "./TransfermarktCandidateMatcher.js";
import { RateLimiter } from "../shared/RateLimiter.js";

export type TransfermarktSquadProvider = {
  listSquadPlayers(leagueId: string, season: number): Promise<TransfermarktSquadPlayer[]>;
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

export class TransfermarktWebScraper implements TransfermarktSquadProvider {
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

export function parseTransfermarktSquadPlayers(html: string, context: { leagueId: string; season: number }): TransfermarktSquadPlayer[] {
  return html
    .split(/<tr[^>]*class="(?:odd|even)"[^>]*>/iu)
    .slice(1)
    .flatMap((row) => {
      const id = /\/profil\/spieler\/(\d+)/iu.exec(row)?.[1];
      const name = htmlDecode(/<a[^>]+href="[^"]*\/profil\/spieler\/\d+"[^>]*>(.*?)<\/a>/isu.exec(row)?.[1] ?? "").trim();
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
