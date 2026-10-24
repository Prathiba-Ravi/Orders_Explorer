/**
 * Small, pure parsers for the messy fields. No Date-from-local-time anywhere:
 * every date is interpreted as UTC, as data-notes.md requires.
 */

/** Parses a number, or a numeric string such as "4599.5". Returns null for anything else. */
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;
const EPOCH_STRING = /^\d{9,13}$/;

/** Builds a UTC timestamp and rejects impossible dates such as 31/02/2025. */
function utc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number | null {
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
  const t = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return t;
}

function epochToMs(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  // Seconds today are ~1.7e9; milliseconds are ~1.7e12. Be forgiving if a ms value sneaks in.
  return Math.abs(n) >= 1e11 ? Math.round(n) : Math.round(n * 1000);
}

/**
 * Reads any of the four documented `createdAt` / `updatedAt` formats
 * (ISO with zone, ISO without zone = UTC, epoch seconds, DD/MM/YYYY = midnight UTC).
 * Returns epoch milliseconds, or null if the value cannot be read.
 */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number') return epochToMs(value);
  if (typeof value !== 'string') return null;
  const str = value.trim();
  if (str === '') return null;

  if (EPOCH_STRING.test(str)) return epochToMs(Number(str));

  const dmy = DMY.exec(str);
  if (dmy) return utc(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  const iso = ISO.exec(str);
  if (iso) {
    const [, y, mo, d, h, mi, s, frac, zone] = iso;
    const ms = frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0;
    const local = utc(Number(y), Number(mo), Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0), ms);
    if (local === null) return null;
    if (!zone || zone.toUpperCase() === 'Z') return local; // no zone means UTC
    const sign = zone.startsWith('-') ? -1 : 1;
    const digits = zone.slice(1).replace(':', '');
    const offsetMin = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || 0);
    return local - sign * offsetMin * 60_000;
  }
  return null;
}

/** Pulls the number out of `ORD-0001234`. Returns null if the id has another shape. */
export function parseOrderIdNumber(id: string): number | null {
  const m = /^ORD-(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the source value carries a calendar date but no time of day
 * (the DD/MM/YYYY format). Such values are parsed as midnight UTC, but the time is not real.
 */
export function isDateOnly(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const str = value.trim();
  return DMY.test(str) || ISO_DATE_ONLY.test(str);
}
