import { STATUSES, type Order } from '../data/types';
import type { SortState } from '../grid/types';

/** A sortable value. `null` means "no value": those rows always go last, in either direction. */
export type SortKey = number | string | null;

const STATUS_ORDER: Record<string, number> = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

/**
 * What each column sorts by, with the right type:
 * numbers as numbers, dates as epoch time (never the text), text case-insensitively,
 * status in workflow order (pending -> cancelled) rather than alphabetically.
 */
export const SORT_VALUES: Record<string, (o: Order) => SortKey> = {
  id: (o) => o.idNum,
  customer: (o) => o.customerKey,
  status: (o) => STATUS_ORDER[o.status] ?? null,
  amount: (o) => o.amount,
  createdAt: (o) => o.createdAt,
  updatedAt: (o) => o.updatedAt,
  region: (o) => o.region,
  channel: (o) => o.channel,
  paymentMethod: (o) => o.paymentMethod,
  priority: (o) => o.priority,
  itemCount: (o) => o.itemCount,
  email: (o) => o.emailKey,
  notes: (o) => (o.notes === '' ? null : o.notesKey),
};

export interface Sorter {
  /** Row indices (into the orders array) in the requested order. Cached per column + direction. */
  sort(state: SortState | null): Int32Array;
}

/**
 * Sorting 50,000 rows is cheap, but not free, so each result is cached:
 * toggling back and forth between two sorts costs nothing after the first time.
 * Ties are always broken by order id (ascending) so the order is stable and predictable.
 */
export function createSorter(orders: readonly Order[]): Sorter {
  const n = orders.length;
  const ids = new Int32Array(n);
  for (let i = 0; i < n; i++) ids[i] = orders[i]!.idNum;

  const keyCache = new Map<string, SortKey[]>();
  const resultCache = new Map<string, Int32Array>();

  const keysFor = (columnId: string): SortKey[] | null => {
    const cached = keyCache.get(columnId);
    if (cached) return cached;
    const read = SORT_VALUES[columnId];
    if (!read) return null;
    const keys = new Array<SortKey>(n);
    for (let i = 0; i < n; i++) keys[i] = read(orders[i]!);
    keyCache.set(columnId, keys);
    return keys;
  };

  const fileOrder = () => {
    const out = new Int32Array(n);
    for (let i = 0; i < n; i++) out[i] = i;
    return out;
  };

  return {
    sort(state) {
      if (!state) return fileOrder();
      const keys = keysFor(state.columnId);
      if (!keys) return fileOrder(); // unknown column id (e.g. from a bad URL): keep file order

      const cacheKey = `${state.columnId}:${state.dir}`;
      const cached = resultCache.get(cacheKey);
      if (cached) return cached;

      const sign = state.dir === 'asc' ? 1 : -1;
      const out = fileOrder();
      out.sort((a, b) => {
        const ka = keys[a]!;
        const kb = keys[b]!;
        if (ka === null) return kb === null ? ids[a]! - ids[b]! : 1;
        if (kb === null) return -1;
        if (ka < kb) return -sign;
        if (ka > kb) return sign;
        return ids[a]! - ids[b]!;
      });
      resultCache.set(cacheKey, out);
      return out;
    },
  };
}

/** Next sort when a header is clicked: new column starts ascending, same column reverses. */
export function nextSort(current: SortState | null, columnId: string): SortState {
  if (current && current.columnId === columnId) {
    return { columnId, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { columnId, dir: 'asc' };
}

/** Newest orders first. */
export const DEFAULT_SORT: SortState = { columnId: 'createdAt', dir: 'desc' };
