import type { Order } from '../data/types';
import { parseDateInput } from './dates';
import { conditionStatus, parseFilterNumber } from './status';
import type { DateCondition, FilterCondition, FilterGroup, FilterRoot, NumberCondition, TextCondition } from './types';

export type OrderPredicate = (order: Order) => boolean;

function compileText(c: TextCondition): OrderPredicate {
  const q = c.value.trim();
  // Order ids are stored upper-case, the other text keys are pre-lowered by normalize().
  const read: (o: Order) => string =
    c.field === 'id'
      ? (o) => o.id
      : c.field === 'customer'
        ? (o) => o.customerKey
        : c.field === 'email'
          ? (o) => o.emailKey
          : (o) => o.notesKey;
  const needle = c.field === 'id' ? q.toUpperCase() : q.toLowerCase();
  if (c.op === 'equals') return (o) => read(o) === needle;
  if (c.op === 'contains') return (o) => read(o).includes(needle);
  return (o) => !read(o).includes(needle); // notContains: empty notes pass
}

function compileNumber(c: NumberCondition): OrderPredicate {
  const read: (o: Order) => number = c.field === 'amount' ? (o) => o.amount : (o) => o.itemCount;
  if (c.op === 'between') {
    const min = parseFilterNumber(c.min)!;
    const max = parseFilterNumber(c.max)!;
    return (o) => {
      const n = read(o);
      return n >= min && n <= max;
    };
  }
  const v = parseFilterNumber(c.value)!;
  if (c.op === 'eq') return (o) => Math.abs(read(o) - v) < 0.005; // amounts are whole paise
  if (c.op === 'gt') return (o) => read(o) > v;
  return (o) => read(o) < v;
}

function compileDate(c: DateCondition): OrderPredicate {
  const read: (o: Order) => number | null = c.field === 'createdAt' ? (o) => o.createdAt : (o) => o.updatedAt;
  if (c.op === 'between') {
    const from = parseDateInput(c.from)!;
    const to = parseDateInput(c.to)!;
    return (o) => {
      const ms = read(o);
      return ms !== null && ms >= from.start && ms <= to.end; // both days included in full
    };
  }
  const day = parseDateInput(c.value)!;
  // "before" = before that day starts, "after" = after that day ends. Orders with no date never match.
  if (c.op === 'before') {
    return (o) => {
      const ms = read(o);
      return ms !== null && ms < day.start;
    };
  }
  return (o) => {
    const ms = read(o);
    return ms !== null && ms > day.end;
  };
}

/** A predicate for a ready condition, or null when it is incomplete/invalid (and so ignored). */
export function compileCondition(c: FilterCondition): OrderPredicate | null {
  if (conditionStatus(c).state !== 'ok') return null;
  switch (c.kind) {
    case 'text':
      return compileText(c);
    case 'number':
      return compileNumber(c);
    case 'date':
      return compileDate(c);
    case 'enum': {
      const wanted = new Set(c.values);
      if (c.field === 'priority') {
        return (o) => wanted.has(o.priority === null ? 'none' : String(o.priority));
      }
      const read: (o: Order) => string =
        c.field === 'status'
          ? (o) => o.status
          : c.field === 'region'
            ? (o) => o.region
            : c.field === 'channel'
              ? (o) => o.channel
              : (o) => o.paymentMethod;
      return (o) => wanted.has(read(o));
    }
  }
}

/** OR inside a group. A group with no ready condition is skipped (null). */
export function compileGroup(group: FilterGroup): OrderPredicate | null {
  const parts = group.conditions.map(compileCondition).filter((p): p is OrderPredicate => p !== null);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return (o) => parts.some((p) => p(o));
}

/** AND across groups. null means nothing to filter by: every row passes. */
export function compileFilter(root: FilterRoot): OrderPredicate | null {
  const groups = root.groups.map(compileGroup).filter((p): p is OrderPredicate => p !== null);
  if (groups.length === 0) return null;
  if (groups.length === 1) return groups[0]!;
  return (o) => groups.every((g) => g(o));
}
