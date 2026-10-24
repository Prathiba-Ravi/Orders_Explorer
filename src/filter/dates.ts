/** UTC day bounds for `<input type="date">` values (YYYY-MM-DD). Between is inclusive on both ends. */

export function parseDateInput(value: string): { start: number; end: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const start = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
  const end = Date.UTC(y, mo - 1, d, 23, 59, 59, 999);
  const check = new Date(start);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { start, end };
}

/** `before` uses start of that calendar day; `after` uses end of that day. */
export function dateOpValue(op: 'before' | 'after', input: string): number | null {
  const day = parseDateInput(input);
  if (!day) return null;
  return op === 'before' ? day.start : day.end;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function msToDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function dateBetweenValue(from: string, to: string): { min: number; max: number } | null {
  const a = parseDateInput(from);
  const b = parseDateInput(to);
  if (!a || !b) return null;
  return { min: Math.min(a.start, b.start), max: Math.max(a.end, b.end) };
}
