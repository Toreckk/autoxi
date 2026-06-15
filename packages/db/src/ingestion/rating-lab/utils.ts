import { createHash } from "node:crypto";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundClamp(value: number, min: number, max: number): number {
  return clamp(Math.round(value), min, max);
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function deterministicUnit(seed: string): number {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) / 0xffffffff;
}

export function deterministicInt(seed: string, min: number, max: number): number {
  return Math.floor(deterministicUnit(seed) * (max - min + 1)) + min;
}

export function deterministicPick<T>(values: readonly T[], seed: string): T {
  return values[deterministicInt(seed, 0, values.length - 1)]!;
}

export function publicSafePlaceholderName(context: {
  nation: string;
  worldCupYear: number;
  position: string;
  identityKey: string;
}): string {
  const digest = createHash("sha1").update(context.identityKey).digest("hex").slice(0, 6).toUpperCase();
  return `${context.nation}-${context.worldCupYear}-${context.position}-${digest}`;
}

export function countBy<T>(items: readonly T[], key: (item: T) => string | number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = String(key(item));
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
