import { isDateOnly, parseNumber, parseOrderIdNumber, parseTimestamp } from './parse';
import {
  CHANNELS,
  PAYMENT_METHODS,
  REGIONS,
  STATUSES,
  type Channel,
  type NormalizeResult,
  type NormalizeStats,
  type Order,
  type PaymentMethod,
  type Priority,
  type Region,
  type Status,
} from './types';

/**
 * The single place where messy export data becomes clean `Order`s.
 * Every rule below maps to a numbered problem in data-notes.md.
 */

const MAX_REASONS = 20;

type Raw = Record<string, unknown>;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], upper = false): T | null {
  if (typeof value !== 'string') return null;
  const v = upper ? value.trim().toUpperCase() : value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parsePriority(value: unknown): Priority | null {
  const n = parseNumber(value);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** Amount unit depends on schemaVersion: v1 = paise, v2 = rupees. Strings are parsed first (rules 2 + 3). */
function parseAmountInRupees(raw: unknown, schemaVersion: number): number | null {
  const n = parseNumber(raw);
  if (n === null || n < 0) return null;
  const rupees = schemaVersion === 1 ? n / 100 : n;
  return Math.round(rupees * 100) / 100;
}

/** Converts one raw record. Returns a reason string if it cannot be used. */
export function normalizeOrder(raw: unknown): Order | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'record is not an object';
  const r = raw as Raw;

  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const idNum = parseOrderIdNumber(id);
  if (idNum === null) return `bad id ${JSON.stringify(r.id)}`;

  const schemaVersion = parseNumber(r.schemaVersion);
  if (schemaVersion !== 1 && schemaVersion !== 2) return `${id}: unknown schemaVersion`;

  const status = oneOf<Status>(r.status, STATUSES);
  if (!status) return `${id}: bad status ${JSON.stringify(r.status)}`;
  const region = oneOf<Region>(r.region, REGIONS, true);
  if (!region) return `${id}: bad region ${JSON.stringify(r.region)}`;
  const channel = oneOf<Channel>(r.channel, CHANNELS);
  if (!channel) return `${id}: bad channel ${JSON.stringify(r.channel)}`;
  const paymentMethod = oneOf<PaymentMethod>(r.paymentMethod, PAYMENT_METHODS);
  if (!paymentMethod) return `${id}: bad paymentMethod ${JSON.stringify(r.paymentMethod)}`;

  const amount = parseAmountInRupees(r.amount, schemaVersion);
  if (amount === null) return `${id}: bad amount ${JSON.stringify(r.amount)}`;
  const createdAt = parseTimestamp(r.createdAt);
  if (createdAt === null) return `${id}: bad createdAt ${JSON.stringify(r.createdAt)}`;
  const itemCount = parseNumber(r.itemCount);
  if (itemCount === null) return `${id}: bad itemCount ${JSON.stringify(r.itemCount)}`;

  // Rule 1: two names for the same field. Prefer the one that matches the version, fall back to the other.
  const customer = (text(r.customerName) || text(r.customer_name)).trim();
  const email = text(r.customerEmail).trim();
  const notes = text(r.notes); // null / missing / '' are all "no notes"
  // Rule 10: trailing space in currency.
  const currency = text(r.currency).trim().toUpperCase() || 'INR';

  return {
    id,
    idNum,
    customer,
    email,
    status,
    amount,
    currency,
    createdAt,
    createdAtDateOnly: isDateOnly(r.createdAt),
    // Rule 5: null, missing and unreadable are all "unknown".
    updatedAt: parseTimestamp(r.updatedAt),
    region,
    channel,
    priority: parsePriority(r.priority), // Rule 8: missing -> null, shown as "None"
    paymentMethod,
    itemCount,
    notes,
    customerKey: customer.toLowerCase(),
    emailKey: email.toLowerCase(),
    notesKey: notes.toLowerCase(),
  };
}

/**
 * Rule 7. `earlier` appeared before `later` in the file. Returns the one to keep:
 *  - both have updatedAt: the later updatedAt wins (a tie goes to the later record in the file)
 *  - only one has updatedAt: that one wins
 *  - neither: the later record in the file wins
 */
export function pickDuplicateWinner(earlier: Order, later: Order): Order {
  const a = earlier.updatedAt;
  const b = later.updatedAt;
  if (a !== null && b !== null) return a > b ? earlier : later;
  if (a !== null) return earlier;
  if (b !== null) return later;
  return later;
}

export function normalizeOrders(records: readonly unknown[]): NormalizeResult {
  const stats: NormalizeStats = {
    totalRecords: records.length,
    skipped: 0,
    skippedReasons: [],
    duplicatesRemoved: 0,
  };

  const byId = new Map<string, { order: Order; fileIndex: number }>();

  for (let i = 0; i < records.length; i++) {
    const result = normalizeOrder(records[i]);
    if (typeof result === 'string') {
      stats.skipped++;
      if (stats.skippedReasons.length < MAX_REASONS) stats.skippedReasons.push(`#${i}: ${result}`);
      continue;
    }
    const existing = byId.get(result.id);
    if (!existing) {
      byId.set(result.id, { order: result, fileIndex: i });
      continue;
    }
    stats.duplicatesRemoved++;
    const winner = pickDuplicateWinner(existing.order, result);
    byId.set(result.id, {
      order: winner,
      fileIndex: winner === result ? i : existing.fileIndex,
    });
  }

  // Keep file order so "no sort" is predictable.
  const orders = [...byId.values()].sort((x, y) => x.fileIndex - y.fileIndex).map((e) => e.order);
  return { orders, stats };
}
