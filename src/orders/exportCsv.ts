import type { Order } from '../data/types';
import { CHANNEL_LABEL, PAYMENT_LABEL, REGION_LABEL, STATUS_LABEL } from './labels';

/**
 * CSV export of the selected orders. RFC 4180 quoting, CRLF line ends, and a UTF-8
 * byte-order mark so Excel reads ₹ and accents correctly.
 */

export const CSV_HEADERS = [
  'Order ID',
  'Customer',
  'Email',
  'Status',
  'Amount (INR)',
  'Currency',
  'Created At',
  'Updated At',
  'Region',
  'Channel',
  'Payment method',
  'Priority',
  'Items',
  'Notes',
] as const;

/**
 * A text cell. Cells starting with = + - @ (or a tab/CR) are run as formulas by Excel and
 * Sheets, so they get a leading apostrophe. Quotes, commas and line breaks are escaped.
 */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function isoDate(ms: number, dateOnly: boolean): string {
  const iso = new Date(ms).toISOString();
  // Orders that came with only a date have no real time of day, so do not invent one.
  return dateOnly ? iso.slice(0, 10) : iso;
}

export function orderToCsvRow(o: Order): string {
  return [
    csvText(o.id),
    csvText(o.customer),
    csvText(o.email),
    STATUS_LABEL[o.status],
    o.amount.toFixed(2),
    csvText(o.currency),
    isoDate(o.createdAt, o.createdAtDateOnly),
    o.updatedAt === null ? '' : new Date(o.updatedAt).toISOString(),
    REGION_LABEL[o.region],
    CHANNEL_LABEL[o.channel],
    PAYMENT_LABEL[o.paymentMethod],
    o.priority === null ? 'None' : String(o.priority),
    String(o.itemCount),
    csvText(o.notes),
  ].join(',');
}

export function ordersToCsv(rows: readonly Order[]): string {
  return [CSV_HEADERS.join(','), ...rows.map(orderToCsvRow)].join('\r\n') + '\r\n';
}

/**
 * The selected orders, in the order the grid shows them (`sortedIndices` is the full,
 * unfiltered sort order). Selected orders hidden by a filter are included: the export
 * always has exactly as many rows as the "N selected" count says.
 */
export function selectedOrdersInOrder(
  orders: readonly Order[],
  sortedIndices: ArrayLike<number>,
  selected: ReadonlySet<number>,
): Order[] {
  const out: Order[] = [];
  for (let i = 0; i < sortedIndices.length; i++) {
    const order = orders[sortedIndices[i]!]!;
    if (selected.has(order.idNum)) out.push(order);
  }
  return out;
}

export function csvFilename(now: Date = new Date()): string {
  return `orders-selected-${now.toISOString().slice(0, 10)}.csv`;
}

/** Starts a browser download. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
