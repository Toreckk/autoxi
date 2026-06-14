import {
  cardFilterQuerySchema,
  publicPlayerCardSchema,
  type CardFilterMetadataDto,
  type CardFilterQuery,
  type PaginatedCardsDto,
  type PublicPlayerCardDto
} from "@autoxi/domain";
import { analytics } from "./observability.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function buildUrl(path: string, params?: Record<string, unknown>) {
  const url = new URL(path, apiBaseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url;
}

async function fetchJson<T>(url: URL, schema: { parse: (value: unknown) => T }): Promise<T> {
  const started = performance.now();
  const response = await fetch(url);
  const duration = performance.now() - started;

  if (duration > 800) {
    analytics.track("api_request_slow", { path: url.pathname, durationMs: Math.round(duration) });
  }

  if (!response.ok) {
    analytics.track("api_request_failed", { path: url.pathname, status: response.status });
    throw new Error(`API request failed with ${response.status}`);
  }

  return schema.parse(await response.json());
}

export function getCards(query: CardFilterQuery): Promise<PaginatedCardsDto> {
  const normalized = cardFilterQuerySchema.parse(query);
  return fetchJson(buildUrl("/cards", normalized), {
    parse: (value) => {
      const page = value as PaginatedCardsDto;
      return {
        ...page,
        items: page.items.map((item) => publicPlayerCardSchema.parse(item))
      };
    }
  });
}

export function getCard(id: string): Promise<PublicPlayerCardDto> {
  return fetchJson(buildUrl(`/cards/${id}`), publicPlayerCardSchema);
}

export function getFilterMetadata(): Promise<CardFilterMetadataDto> {
  return fetchJson(buildUrl("/cards/meta/filters"), {
    parse: (value) => value as CardFilterMetadataDto
  });
}
