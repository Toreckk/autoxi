import { stat } from "node:fs/promises";
import { normalizeName } from "../../utils.js";
import type { FjelstulCardContext } from "../../domain/types.js";
import { readCsvRows } from "../csvUtils.js";

export type ProviderPlayerLink = {
  subjectProvider: string;
  subjectId: string;
  targetProvider: string;
  targetId: string;
  playerName: string;
  nationCode: string;
  worldCupYear: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  linkMethod: string;
  evidence: string;
  reviewStatus: "auto_approved" | "manual_approved" | "needs_review" | "rejected" | "";
};

export async function loadProviderPlayerLinks(path = "data/sources/identity/provider_player_links.csv"): Promise<ProviderPlayerLink[]> {
  if (!(await isFile(path))) return [];
  const rows = await readCsvRows(path);
  return rows
    .map((row) => ({
      subjectProvider: row.subject_provider ?? "",
      subjectId: row.subject_id ?? "",
      targetProvider: row.target_provider ?? "",
      targetId: row.target_id ?? "",
      playerName: row.player_name ?? "",
      nationCode: row.nation_code ?? "",
      worldCupYear: row.world_cup_year ? Number(row.world_cup_year) : null,
      confidence: confidence(row.confidence),
      linkMethod: row.link_method ?? "",
      evidence: row.evidence ?? "",
      reviewStatus: reviewStatus(row.review_status)
    }))
    .filter((row) => row.subjectProvider && row.subjectId && row.targetProvider && row.targetId);
}

export function approvedProviderLinks(links: readonly ProviderPlayerLink[]): ProviderPlayerLink[] {
  return links.filter((link) => link.reviewStatus === "auto_approved" || link.reviewStatus === "manual_approved");
}

export function findApprovedTransfermarktLink(
  context: FjelstulCardContext,
  links: readonly ProviderPlayerLink[]
): ProviderPlayerLink | undefined {
  const approved = approvedProviderLinks(links);
  const contextId = context.identityKey.startsWith("fjelstul:") ? context.identityKey.slice("fjelstul:".length) : context.identityKey;
  return approved.find(
    (link) =>
      link.subjectProvider === "fjelstul" &&
      link.targetProvider === "transfermarkt" &&
      link.confidence === "HIGH" &&
      (link.subjectId === context.identityKey || link.subjectId === contextId || link.subjectId === ratingSubjectId(context)) &&
      (!link.worldCupYear || link.worldCupYear === context.worldCupYear)
  );
}

export function ratingSubjectId(context: Pick<FjelstulCardContext, "nation" | "worldCupYear" | "internalRawName">): string {
  return `${context.nation}-${context.worldCupYear}-${normalizeName(context.internalRawName).replaceAll(" ", "-")}`;
}

function confidence(value: string | undefined): ProviderPlayerLink["confidence"] {
  return value === "MEDIUM" || value === "LOW" ? value : "HIGH";
}

function reviewStatus(value: string | undefined): ProviderPlayerLink["reviewStatus"] {
  if (value === "auto_approved" || value === "manual_approved" || value === "needs_review" || value === "rejected") return value;
  return "";
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
