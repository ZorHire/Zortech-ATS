/**
 * Minimal low-confidence field indicator, driven by the `low_confidence_fields`
 * array AI parse endpoints return. Backend field names don't always match
 * frontend form keys 1:1 (e.g. resume `name` splits into `first_name`/`last_name`),
 * so each caller supplies its own alias list per form field.
 */
export const isLowConfidence = (
  lowConfidenceFields: string[],
  ...backendFieldNames: string[]
): boolean => backendFieldNames.some((name) => lowConfidenceFields.includes(name));

export const confidenceInputClass = (flagged: boolean): string =>
  flagged ? "border-amber-400 bg-amber-50 focus:ring-amber-400" : "border-gray-100";

export const ConfidenceBadge = "text-amber-600 text-[10px] font-semibold ml-1.5";
