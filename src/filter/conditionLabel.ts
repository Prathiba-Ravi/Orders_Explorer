import { formatCount, formatDateUTC, formatINR } from '../lib/format';
import { parseDateInput } from './dates';
import { ENUM_OPTIONS, fieldMeta } from './fields';
import { parseFilterNumber } from './status';
import type { FilterCondition, NumberField } from './types';

/** Shown in place of a value that has not been entered yet. */
const BLANK = '…';

function numberText(field: NumberField, text: string): string {
  const n = parseFilterNumber(text);
  if (n === null) return BLANK;
  return field === 'amount' ? formatINR(n) : formatCount(n);
}

function dateText(text: string): string {
  const day = parseDateInput(text);
  return day ? formatDateUTC(day.start) : BLANK;
}

/** The chip text for a condition, e.g. `Amount between ₹1,000.00 and ₹2,500.00`. */
export function conditionLabel(c: FilterCondition): string {
  const name = fieldMeta(c.field)?.label ?? c.field;
  switch (c.kind) {
    case 'text': {
      const v = c.value.trim() === '' ? BLANK : `“${c.value.trim()}”`;
      if (c.op === 'contains') return `${name} contains ${v}`;
      if (c.op === 'notContains') return `${name} does not contain ${v}`;
      return `${name} is ${v}`;
    }
    case 'number': {
      if (c.op === 'between') return `${name} between ${numberText(c.field, c.min)} and ${numberText(c.field, c.max)}`;
      const v = numberText(c.field, c.value);
      return c.op === 'eq' ? `${name} = ${v}` : c.op === 'gt' ? `${name} > ${v}` : `${name} < ${v}`;
    }
    case 'date': {
      if (c.op === 'between') return `${name} between ${dateText(c.from)} and ${dateText(c.to)}`;
      return `${name} ${c.op} ${dateText(c.value)}`;
    }
    case 'enum': {
      const options = ENUM_OPTIONS[c.field];
      const labels = c.values.map((v) => options.find((o) => o.value === v)?.label ?? v);
      return `${name} is ${labels.length === 0 ? BLANK : labels.join(' or ')}`;
    }
  }
}
