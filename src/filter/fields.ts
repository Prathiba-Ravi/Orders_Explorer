import { CHANNELS, PAYMENT_METHODS, PRIORITIES, REGIONS, STATUSES } from '../data/types';
import { CHANNEL_LABEL, PAYMENT_LABEL, REGION_LABEL, STATUS_LABEL } from '../orders/labels';
import type { DateField, EnumField, NumberField, TextField } from './types';

export interface FieldMeta {
  id: TextField | NumberField | DateField | EnumField;
  label: string;
  kind: 'text' | 'number' | 'date' | 'enum';
}

export const FILTER_FIELDS: readonly FieldMeta[] = [
  { id: 'id', label: 'Order ID', kind: 'text' },
  { id: 'customer', label: 'Customer', kind: 'text' },
  { id: 'email', label: 'Email', kind: 'text' },
  { id: 'notes', label: 'Notes', kind: 'text' },
  { id: 'status', label: 'Status', kind: 'enum' },
  { id: 'amount', label: 'Amount', kind: 'number' },
  { id: 'createdAt', label: 'Created At', kind: 'date' },
  { id: 'updatedAt', label: 'Updated At', kind: 'date' },
  { id: 'region', label: 'Region', kind: 'enum' },
  { id: 'channel', label: 'Channel', kind: 'enum' },
  { id: 'paymentMethod', label: 'Payment', kind: 'enum' },
  { id: 'priority', label: 'Priority', kind: 'enum' },
  { id: 'itemCount', label: 'Items', kind: 'number' },
];

/** Priority filter uses numeric 1–3 plus the sentinel `none` for a null priority. */
export const PRIORITY_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  ...PRIORITIES.map((p) => ({ value: String(p), label: String(p) })),
  { value: 'none', label: 'None' },
];

/** Same sentence-case labels the grid shows, so the filter and the grid read alike. */
export const ENUM_OPTIONS: Record<EnumField, readonly { value: string; label: string }[]> = {
  status: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  region: REGIONS.map((r) => ({ value: r, label: REGION_LABEL[r] })),
  channel: CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] })),
  paymentMethod: PAYMENT_METHODS.map((p) => ({ value: p, label: PAYMENT_LABEL[p] })),
  priority: PRIORITY_FILTER_OPTIONS,
};

export function fieldMeta(id: string): FieldMeta | undefined {
  return FILTER_FIELDS.find((f) => f.id === id);
}
