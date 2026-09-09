/**
 * Shared coercion helpers for AI agent outputs.
 *
 * Model output is untrusted: every field is length-capped and type-checked here
 * so a malformed or hostile completion can never widen past the schema the
 * caller declared. Previously duplicated per-service; centralised so the caps
 * stay consistent across agents.
 */

export const asString = (v: unknown, maxLen: number): string =>
  typeof v === "string" ? v.trim().slice(0, maxLen) : "";

export const asStringArray = (
  v: unknown,
  maxItems: number,
  maxLen: number,
): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLen));
};

export const clampNumber = (
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)));
};

/** 0-100 fit score. Non-numeric output scores 0 rather than throwing. */
export const clampScore = (v: unknown): number => clampNumber(v, 0, 100, 0);

/** Narrows model output to one of `allowed`, falling back when it matches none. */
export const asEnum = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
