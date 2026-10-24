import { CHANNEL_LABEL, PAYMENT_LABEL, REGION_LABEL, STATUS_LABEL } from '../orders/labels';
import { fieldMeta } from './fields';
import type { FilterCondition } from './types';

function enumLabel(field: string, value: string): string {
  if (field === 'status') return STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? value;
  if (field === 'region') return REGION_LABEL[value as keyof typeof REGION_LABEL] ?? value;
  if (field === 'channel') return CHANNEL_LABEL[value as keyof typeof CHANNEL_LABEL] ?? value;
  if (field === 'paymentMethod') return PAYMENT_LABEL[value as keyof typeof PAYMENT_LABEL] ?? value;
  if (field === 'priority' && value === 'none') return 'None';
  return value;
}

export function conditionLabel(c: FilterCondition): string {
  const meta = fieldMeta(c.field);
  const name = meta?.label ?? c.field;
  switch (c.kind) {
    case 'text':
      if (c.op === 'contains') return `${name} contains "${c.value}"`;
      if (c.op === 'notContains') return `${name} does not contain "${c.value}"`;
      return `${name} equals "${c.value}"`;
    case 'number':
      if (c.op === 'eq') return `${name} = ${c.value}`;
      if (c.op === 'gt') return `${name} > ${c.value}`;
      if (c.op === 'lt') return `${name} < ${c.value}`;
      return `${name} between ${typeof c.value === 'object' ? `${c.value.min} and ${c.value.max}` : ''}`;
    case 'date':
      if (c.op === 'before') return `${name} before`;
      if (c.op === 'after') return `${name} after`;
      return `${name} between dates`;
    case 'enum':
      return `${name} is ${c.values.map((v) => enumLabel(c.field, v)).join(' or ')}`;
  }
}
