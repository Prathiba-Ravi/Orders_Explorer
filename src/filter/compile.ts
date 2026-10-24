import type { Order } from '../data/types';
import type { FilterCondition, FilterGroup, FilterRoot } from './types';

export type OrderPredicate = (order: Order) => boolean;

function matchText(order: Order, c: Extract<FilterCondition, { kind: 'text' }>): boolean {
  const raw =
    c.field === 'id'
      ? order.id.toLowerCase()
      : c.field === 'customer'
        ? order.customerKey
        : c.field === 'email'
          ? order.emailKey
          : order.notesKey;
  const q = c.value.trim().toLowerCase();
  if (c.op === 'equals') return raw === q;
  if (q === '') return c.op === 'notContains';
  if (c.op === 'contains') return raw.includes(q);
  return !raw.includes(q);
}

function matchNumber(order: Order, c: Extract<FilterCondition, { kind: 'number' }>): boolean {
  const n = c.field === 'amount' ? order.amount : order.itemCount;
  if (c.op === 'eq') return typeof c.value === 'number' && n === c.value;
  if (c.op === 'gt') return typeof c.value === 'number' && n > c.value;
  if (c.op === 'lt') return typeof c.value === 'number' && n < c.value;
  if (typeof c.value === 'object') return n >= c.value.min && n <= c.value.max;
  return false;
}

function matchDate(order: Order, c: Extract<FilterCondition, { kind: 'date' }>): boolean {
  const ms = c.field === 'createdAt' ? order.createdAt : order.updatedAt;
  if (ms === null) return false;
  if (c.op === 'before' && typeof c.value === 'number') return ms < c.value;
  if (c.op === 'after' && typeof c.value === 'number') return ms > c.value;
  if (c.op === 'between' && typeof c.value === 'object') return ms >= c.value.min && ms <= c.value.max;
  return false;
}

function matchEnum(order: Order, c: Extract<FilterCondition, { kind: 'enum' }>): boolean {
  if (c.values.length === 0) return true;
  const set = new Set(c.values);
  if (c.field === 'priority') {
    if (order.priority === null) return set.has('none');
    return set.has(String(order.priority));
  }
  const v =
    c.field === 'status'
      ? order.status
      : c.field === 'region'
        ? order.region
        : c.field === 'channel'
          ? order.channel
          : order.paymentMethod;
  return set.has(v);
}

export function compileCondition(c: FilterCondition): OrderPredicate {
  switch (c.kind) {
    case 'text':
      return (o) => matchText(o, c);
    case 'number':
      return (o) => matchNumber(o, c);
    case 'date':
      return (o) => matchDate(o, c);
    case 'enum':
      return (o) => matchEnum(o, c);
  }
}

/** OR within a group. Empty group matches everything. */
export function compileGroup(group: FilterGroup): OrderPredicate {
  const parts = group.conditions.map(compileCondition);
  if (parts.length === 0) return () => true;
  return (o) => parts.some((p) => p(o));
}

/** AND across groups. No groups matches everything. */
export function compileFilter(root: FilterRoot): OrderPredicate {
  if (root.groups.length === 0) return () => true;
  const groups = root.groups.map(compileGroup);
  return (o) => groups.every((g) => g(o));
}
