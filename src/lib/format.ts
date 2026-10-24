/**
 * Display helpers. Written by hand (no Intl) so output is identical in every
 * browser and in tests, and so Indian digit grouping is guaranteed.
 */

/** Shown wherever a value is missing. */
export const EMPTY = '—';

/** Groups an unsigned integer string the Indian way: 1234567 -> 12,34,567. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

/** 50000 -> "50,000", 123456 -> "1,23,456". Non-finite values show EMPTY. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return EMPTY;
  const sign = n < 0 ? '-' : '';
  return sign + groupIndian(String(Math.round(Math.abs(n))));
}

/** Always two decimals, Indian grouping: 1962.4 -> "₹1,962.40", 123456.5 -> "₹1,23,456.50". */
export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return EMPTY;
  const [whole = '0', frac = '00'] = Math.abs(n).toFixed(2).split('.');
  const sign = n < 0 && Number(`${whole}.${frac}`) !== 0 ? '-' : '';
  return `${sign}₹${groupIndian(whole)}.${frac}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "14 Mar 2025" (UTC). */
export function formatDateUTC(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return EMPTY;
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "14 Mar 2025, 09:30" (UTC). The column header says UTC; pass withZone for stand-alone use. */
export function formatDateTimeUTC(ms: number | null, withZone = false): string {
  if (ms === null || !Number.isFinite(ms)) return EMPTY;
  const d = new Date(ms);
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  return `${formatDateUTC(ms)}, ${time}${withZone ? ' UTC' : ''}`;
}

/** Cuts text to at most `max` characters, ending with an ellipsis. Never splits a surrogate pair. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = Math.max(0, max - 1);
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end--; // do not leave half an emoji
  return `${text.slice(0, end).trimEnd()}…`;
}
