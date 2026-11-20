/**
 * Format an annual amount in rupees using Indian units.
 *   85000    -> "₹85,000"
 *   1200000  -> "₹12 L"
 *   1250000  -> "₹12.5 L"
 *   12000000 -> "₹1.2 Cr"
 * Returns "—" (or the given fallback) for null/undefined/empty/non-numeric input.
 */
export function formatINR(
  amount: number | string | null | undefined,
  fallback = "—",
): string {
  if (amount === null || amount === undefined || amount === "") return fallback;
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(/[,\s₹]/g, ""));
  if (!Number.isFinite(n)) return fallback;

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const trim = (v: number) => (Math.round(v * 100) / 100).toString();

  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/**
 * Extract a user-facing message from an unknown error: RTK Query errors
 * ({ data: { message } } / { error }), ApiError / Error (.message), or a fallback.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as { data?: { message?: unknown }; error?: unknown; message?: unknown };
    if (typeof e.data?.message === "string" && e.data.message) return e.data.message;
    if (typeof e.error === "string" && e.error) return e.error;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}

/** HTTP status of an RTK Query / ApiError error, if any. */
export function getErrorStatus(err: unknown): number | string | undefined {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status?: number | string }).status;
  }
  return undefined;
}
