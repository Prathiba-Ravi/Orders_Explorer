import { parseDateInput } from '../filter/dates';
import { ENUM_OPTIONS, fieldMeta } from '../filter/fields';
import { newFilterId } from '../filter/newId';
import type {
  DateField,
  EnumField,
  FilterCondition,
  FilterGroup,
  FilterRoot,
  NumberField,
  TextField,
  TextOp,
} from '../filter/types';

/**
 * The filter as compact JSON in the URL. Each condition is a short array:
 *   ["t", field, "c"|"n"|"e", text]            text: contains / does not contain / equals
 *   ["n", field, "eq"|"gt"|"lt", text]         number
 *   ["n", field, "bt", min, max]               number between
 *   ["d", field, "bf"|"af", yyyy-mm-dd]        date before / after
 *   ["d", field, "bt", from, to]               date between
 *   ["e", field, ...values]                    one or more of a fixed set
 * Values stay as typed (possibly empty), so an unfinished filter survives a refresh.
 * Decoding checks everything; anything unexpected rejects the whole filter.
 */

const MAX_JSON_LENGTH = 8000;
const MAX_GROUPS = 10;
const MAX_CONDITIONS = 20;
const MAX_TEXT = 200;
const MAX_NUMBER_TEXT = 40;

const TEXT_OP_CODE: Record<TextOp, string> = { contains: 'c', notContains: 'n', equals: 'e' };
const TEXT_OP_FROM_CODE: Record<string, TextOp> = { c: 'contains', n: 'notContains', e: 'equals' };

function encodeCondition(c: FilterCondition): unknown[] {
  switch (c.kind) {
    case 'text':
      return ['t', c.field, TEXT_OP_CODE[c.op], c.value];
    case 'number':
      return c.op === 'between' ? ['n', c.field, 'bt', c.min, c.max] : ['n', c.field, c.op, c.value];
    case 'date':
      return c.op === 'between'
        ? ['d', c.field, 'bt', c.from, c.to]
        : ['d', c.field, c.op === 'before' ? 'bf' : 'af', c.value];
    case 'enum':
      return ['e', c.field, ...c.values];
  }
}

/** Returns '' when there is nothing to store. */
export function encodeFilter(root: FilterRoot): string {
  const groups = root.groups.filter((g) => g.conditions.length > 0).map((g) => g.conditions.map(encodeCondition));
  return groups.length === 0 ? '' : JSON.stringify(groups);
}

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isNumberText = (v: unknown): v is string => isString(v, MAX_NUMBER_TEXT) && /^[-+0-9.eE]*$/.test(v);
const isDateText = (v: unknown): v is string => v === '' || (isString(v, 10) && parseDateInput(v) !== null);

function decodeCondition(raw: unknown): FilterCondition | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const [kind, field, op, ...rest] = raw as unknown[];
  if (typeof field !== 'string') return null;
  const meta = fieldMeta(field);
  const id = newFilterId('c');

  if (kind === 't' && meta?.kind === 'text') {
    const textOp = typeof op === 'string' ? TEXT_OP_FROM_CODE[op] : undefined;
    if (!textOp || rest.length !== 1 || !isString(rest[0], MAX_TEXT)) return null;
    return { id, kind: 'text', field: field as TextField, op: textOp, value: rest[0] };
  }

  if (kind === 'n' && meta?.kind === 'number') {
    if (op === 'bt') {
      if (rest.length !== 2 || !isNumberText(rest[0]) || !isNumberText(rest[1])) return null;
      return { id, kind: 'number', field: field as NumberField, op: 'between', min: rest[0], max: rest[1] };
    }
    if ((op === 'eq' || op === 'gt' || op === 'lt') && rest.length === 1 && isNumberText(rest[0])) {
      return { id, kind: 'number', field: field as NumberField, op, value: rest[0] };
    }
    return null;
  }

  if (kind === 'd' && meta?.kind === 'date') {
    if (op === 'bt') {
      if (rest.length !== 2 || !isDateText(rest[0]) || !isDateText(rest[1])) return null;
      return { id, kind: 'date', field: field as DateField, op: 'between', from: rest[0], to: rest[1] };
    }
    if ((op === 'bf' || op === 'af') && rest.length === 1 && isDateText(rest[0])) {
      return { id, kind: 'date', field: field as DateField, op: op === 'bf' ? 'before' : 'after', value: rest[0] };
    }
    return null;
  }

  if (kind === 'e' && meta?.kind === 'enum') {
    // For enums the third element is already the first value.
    const values = [op, ...rest];
    const allowed = new Set(ENUM_OPTIONS[field as EnumField].map((o) => o.value));
    const unique = new Set(values);
    if (values.length > ENUM_OPTIONS[field as EnumField].length || unique.size !== values.length) return null;
    if (!values.every((v): v is string => typeof v === 'string' && allowed.has(v))) return null;
    return { id, kind: 'enum', field: field as EnumField, op: 'isOneOf', values };
  }

  return null;
}

/** Returns the filter, or null if the text is not a valid filter. */
export function decodeFilter(text: string): FilterRoot | null {
  if (text.length === 0 || text.length > MAX_JSON_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_GROUPS) return null;

  const groups: FilterGroup[] = [];
  for (const rawGroup of parsed) {
    if (!Array.isArray(rawGroup) || rawGroup.length === 0 || rawGroup.length > MAX_CONDITIONS) return null;
    const conditions: FilterCondition[] = [];
    for (const rawCondition of rawGroup) {
      const c = decodeCondition(rawCondition);
      if (!c) return null;
      conditions.push(c);
    }
    groups.push({ id: newFilterId('g'), conditions });
  }
  return { groups };
}
