import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeOrders } from '../data/normalize';
import { ORDER_COLUMNS } from './columns';
import { createSorter, nextSort, SORT_VALUES } from './sort';

const raw = JSON.parse(readFileSync('public/orders.json', 'utf8')) as unknown[];
const { orders } = normalizeOrders(raw);
const sorter = createSorter(orders);

function values(columnId: string, dir: 'asc' | 'desc') {
  const read = SORT_VALUES[columnId]!;
  return Array.from(sorter.sort({ columnId, dir }), (i) => read(orders[i]!));
}

describe('sorter on the real data', () => {
  it('every sortable column has a sort value', () => {
    for (const col of ORDER_COLUMNS) if (col.sortable) expect(SORT_VALUES[col.id]).toBeTypeOf('function');
  });

  it('returns every row exactly once', () => {
    for (const col of ORDER_COLUMNS) {
      const out = sorter.sort({ columnId: col.id, dir: 'desc' });
      expect(out.length).toBe(orders.length);
      expect(new Set(out).size).toBe(orders.length);
    }
  });

  it.each(ORDER_COLUMNS.map((c) => c.id))('%s: ascending and descending are ordered, nulls last', (id) => {
    for (const dir of ['asc', 'desc'] as const) {
      const v = values(id, dir);
      let seenNull = false;
      let bad = 0;
      for (let i = 0; i < v.length; i++) {
        const cur = v[i]!;
        if (cur === null) {
          seenNull = true;
          continue;
        }
        if (seenNull) bad++; // a value after a null
        const prev = v[i - 1];
        if (prev !== undefined && prev !== null && (dir === 'asc' ? prev > cur : prev < cur)) bad++;
      }
      expect(bad).toBe(0);
    }
  });

  it('amounts sort as numbers, not text (₹148 comes before ₹1,000)', () => {
    const v = values('amount', 'asc') as number[];
    expect(v[0]).toBeLessThan(150);
    expect(v[v.length - 1]).toBeGreaterThan(3600);
  });

  it('dates sort by real time across all four source formats', () => {
    const v = values('createdAt', 'asc') as number[];
    expect(v[0]).toBeGreaterThanOrEqual(Date.UTC(2023, 9, 1));
    for (let i = 1; i < v.length; i++) expect(v[i]! >= v[i - 1]!).toBe(true);
  });

  it('rows with no updatedAt go last both ways', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const v = values('updatedAt', dir);
      const nulls = orders.filter((o) => o.updatedAt === null).length;
      expect(v.slice(v.length - nulls).every((x) => x === null)).toBe(true);
      expect(v.slice(0, v.length - nulls).every((x) => x !== null)).toBe(true);
    }
  });

  it('missing priority goes last; 1 is highest priority and comes first', () => {
    const v = values('priority', 'asc');
    expect(v[0]).toBe(1);
    expect(v[v.length - 1]).toBeNull();
  });

  it('status sorts in workflow order', () => {
    const asc = Array.from(sorter.sort({ columnId: 'status', dir: 'asc' }), (i) => orders[i]!.status);
    expect(asc[0]).toBe('pending');
    expect(asc[asc.length - 1]).toBe('cancelled');
  });

  it('breaks ties by order id ascending, in both directions', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const out = sorter.sort({ columnId: 'region', dir });
      for (let i = 1; i < out.length; i++) {
        const a = orders[out[i - 1]!]!;
        const b = orders[out[i]!]!;
        if (a.region === b.region) expect(a.idNum).toBeLessThan(b.idNum);
      }
    }
  });

  it('caches results and falls back to file order for unknown columns', () => {
    const s = { columnId: 'amount', dir: 'asc' } as const;
    expect(sorter.sort(s)).toBe(sorter.sort(s));
    expect(Array.from(sorter.sort({ columnId: 'nope', dir: 'asc' }).slice(0, 3))).toEqual([0, 1, 2]);
    expect(Array.from(sorter.sort(null).slice(0, 3))).toEqual([0, 1, 2]);
  });

  it('first sort of 50,000 rows is fast enough to feel instant', () => {
    const fresh = createSorter(orders);
    const t = performance.now();
    fresh.sort({ columnId: 'customer', dir: 'asc' }); // text sort is the slowest kind
    expect(performance.now() - t).toBeLessThan(750);
  });
});

describe('nextSort', () => {
  it('starts a new column ascending and reverses the same column', () => {
    expect(nextSort(null, 'amount')).toEqual({ columnId: 'amount', dir: 'asc' });
    expect(nextSort({ columnId: 'amount', dir: 'asc' }, 'amount')).toEqual({ columnId: 'amount', dir: 'desc' });
    expect(nextSort({ columnId: 'amount', dir: 'desc' }, 'amount')).toEqual({ columnId: 'amount', dir: 'asc' });
    expect(nextSort({ columnId: 'amount', dir: 'desc' }, 'region')).toEqual({ columnId: 'region', dir: 'asc' });
  });
});

