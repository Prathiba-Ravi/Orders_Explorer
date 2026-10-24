import type { Order } from '../data/types';
import { compileFilter } from './compile';
import type { FilterRoot } from './types';
import { isEmptyFilter } from './types';

/** Returns row indices into `orders` that pass the filter. */
export function applyFilter(orders: readonly Order[], filter: FilterRoot): Int32Array {
  if (isEmptyFilter(filter)) {
    const all = new Int32Array(orders.length);
    for (let i = 0; i < orders.length; i++) all[i] = i;
    return all;
  }
  const pred = compileFilter(filter);
  const out: number[] = [];
  for (let i = 0; i < orders.length; i++) {
    if (pred(orders[i]!)) out.push(i);
  }
  return Int32Array.from(out);
}
