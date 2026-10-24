import type { Order } from '../data/types';
import { compileFilter } from './compile';
import type { FilterRoot } from './types';

/** Returns the indices (into `orders`, in file order) of the rows that pass the filter. */
export function applyFilter(orders: readonly Order[], filter: FilterRoot): Int32Array {
  const pred = compileFilter(filter);
  const out = new Int32Array(orders.length);
  if (!pred) {
    for (let i = 0; i < out.length; i++) out[i] = i;
    return out;
  }
  let n = 0;
  for (let i = 0; i < orders.length; i++) {
    if (pred(orders[i]!)) out[n++] = i;
  }
  return out.slice(0, n);
}
