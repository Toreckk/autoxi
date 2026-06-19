export type ProviderPlayerLinkRow = {
  subject_provider: string;
  subject_id: string;
  target_provider: string;
  target_id: string;
  player_name: string;
  nation_code: string;
  world_cup_year: string | number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  link_method: string;
  evidence: string;
  review_status: "auto_approved" | "manual_approved" | "needs_review" | "rejected";
};

export const PROVIDER_LINK_HEADERS = [
  "subject_provider",
  "subject_id",
  "target_provider",
  "target_id",
  "player_name",
  "nation_code",
  "world_cup_year",
  "confidence",
  "link_method",
  "evidence",
  "review_status"
] as const;

export function providerLinkKey(row: Pick<ProviderPlayerLinkRow, "subject_provider" | "subject_id" | "target_provider" | "target_id">): string {
  return `${row.subject_provider}:${row.subject_id}:${row.target_provider}:${row.target_id}`;
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
