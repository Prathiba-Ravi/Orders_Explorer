export const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export const REGIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NORTHEAST'] as const;
export const CHANNELS = ['web', 'app', 'phone', 'store'] as const;
export const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'cod', 'wallet'] as const;
export const PRIORITIES = [1, 2, 3] as const;

export type Status = (typeof STATUSES)[number];
export type Region = (typeof REGIONS)[number];
export type Channel = (typeof CHANNELS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Priority = (typeof PRIORITIES)[number];

/**
 * A clean order, as the rest of the app sees it.
 * Everything messy about the export (two name fields, paise vs rupees,
 * four date formats, mixed casing, ...) is resolved in normalize.ts.
 */
export interface Order {
  id: string;
  /** Numeric part of the id (ORD-0001234 -> 1234). Used to encode selections compactly in the URL. */
  idNum: number;
  customer: string;
  email: string;
  status: Status;
  /** Always rupees. */
  amount: number;
  currency: string;
  /** Epoch milliseconds (UTC). */
  createdAt: number;
  /** True when the source had only a date (DD/MM/YYYY), so the 00:00 time of day was never recorded. */
  createdAtDateOnly: boolean;
  /** Epoch milliseconds (UTC), or null when unknown. */
  updatedAt: number | null;
  region: Region;
  channel: Channel;
  priority: Priority | null;
  paymentMethod: PaymentMethod;
  itemCount: number;
  /** Plain text, never HTML. Empty string when there are no notes. */
  notes: string;

  /** Lower-cased copies used by text filters so a keystroke does not allocate 50k strings. */
  customerKey: string;
  emailKey: string;
  notesKey: string;
}

export interface NormalizeStats {
  /** Records in the file. */
  totalRecords: number;
  /** Records dropped because an essential field was missing or unreadable. */
  skipped: number;
  /** Short reasons for the skipped records (capped), for debugging. */
  skippedReasons: string[];
  /** Records removed because their id appeared more than once. */
  duplicatesRemoved: number;
}

export interface NormalizeResult {
  orders: Order[];
  stats: NormalizeStats;
}
