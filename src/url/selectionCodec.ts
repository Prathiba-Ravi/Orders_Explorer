/**
 * Selected rows as a short URL string. Order ids are numbers, so a selection is
 * stored as sorted runs: `<gap>` for one id, `<gap>-<extra>` for a run of consecutive ids,
 * both in base 36, joined with dots. `gap` is the distance from the end of the previous run.
 * Selecting all 50,000 orders is just "1-xtd"; 5,000 scattered rows take about 3 characters each.
 */

/** Refuse absurd input instead of building a huge Set. */
export const MAX_SELECTION = 200_000;

const TOKEN = /^([0-9a-z]+)(?:-([0-9a-z]+))?$/;

export function encodeSelection(keys: Iterable<number>): string {
  const sorted = [...new Set(keys)].filter((k) => Number.isSafeInteger(k) && k >= 0).sort((a, b) => a - b);
  const parts: string[] = [];
  let prevEnd = 0;
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i]!;
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    const end = sorted[j]!;
    const gap = start - prevEnd;
    parts.push(j > i ? `${gap.toString(36)}-${(end - start).toString(36)}` : gap.toString(36));
    prevEnd = end;
    i = j + 1;
  }
  return parts.join('.');
}

const parseBase36 = (s: string): number | null => {
  const n = parseInt(s, 36);
  return Number.isSafeInteger(n) && n >= 0 && n.toString(36) === s.replace(/^0+(?=.)/, '') ? n : null;
};

/** Returns the ids, or null if the text is not a valid selection. An empty string is an empty selection. */
export function decodeSelection(text: string): number[] | null {
  if (text === '') return [];
  const out: number[] = [];
  let prevEnd = 0;
  for (const token of text.split('.')) {
    const m = TOKEN.exec(token);
    if (!m) return null;
    const gap = parseBase36(m[1]!);
    const extra = m[2] === undefined ? 0 : parseBase36(m[2]);
    if (gap === null || extra === null) return null;
    // After the first run, ids must keep increasing, otherwise the text was not made by encodeSelection.
    if (out.length > 0 && gap < 1) return null;
    const start = prevEnd + gap;
    const end = start + extra;
    if (!Number.isSafeInteger(end) || out.length + extra + 1 > MAX_SELECTION) return null;
    for (let id = start; id <= end; id++) out.push(id);
    prevEnd = end;
  }
  return out;
}
