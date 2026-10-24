import { parseDateInput } from './dates';
import type { FilterCondition } from './types';

/**
 * Is a condition ready to filter?
 *  - ok:         it filters
 *  - incomplete: a value is still missing, so it is ignored (and shown as such)
 *  - invalid:    values contradict each other (min > max), so it is ignored and an error is shown
 */
export type ConditionStatus = { state: 'ok' } | { state: 'incomplete' } | { state: 'invalid'; message: string };

const OK: ConditionStatus = { state: 'ok' };
const INCOMPLETE: ConditionStatus = { state: 'incomplete' };

/** Reads a typed number. Empty or unreadable text is null. */
export function parseFilterNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function conditionStatus(c: FilterCondition): ConditionStatus {
  switch (c.kind) {
    case 'text':
      return c.value.trim() === '' ? INCOMPLETE : OK;

    case 'enum':
      return c.values.length === 0 ? INCOMPLETE : OK;

    case 'number': {
      if (c.op !== 'between') return parseFilterNumber(c.value) === null ? INCOMPLETE : OK;
      const min = parseFilterNumber(c.min);
      const max = parseFilterNumber(c.max);
      if (min === null || max === null) return INCOMPLETE;
      return min > max ? { state: 'invalid', message: 'Minimum is greater than maximum.' } : OK;
    }

    case 'date': {
      if (c.op !== 'between') return parseDateInput(c.value) === null ? INCOMPLETE : OK;
      const from = parseDateInput(c.from);
      const to = parseDateInput(c.to);
      if (!from || !to) return INCOMPLETE;
      return from.start > to.start ? { state: 'invalid', message: 'Start date is after the end date.' } : OK;
    }
  }
}
