/** UTC day bounds for `<input type="date">` values (YYYY-MM-DD). */

export interface DayBounds {
  /** 00:00:00.000 UTC of that day. */
  start: number;
  /** 23:59:59.999 UTC of that day. */
  end: number;
}

export function parseDateInput(value: string): DayBounds | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const start = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
  const check = new Date(start);
  // Rejects 2025-02-30 and years below 100 (Date.UTC would map those to 19xx).
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { start, end: Date.UTC(y, mo - 1, d, 23, 59, 59, 999) };
}
