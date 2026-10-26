import type { GridColumn } from '../grid/types';
import type { Order } from '../data/types';
import { EMPTY, formatCount, formatDateTimeUTC, formatINR, truncate } from '../lib/format';
import { CHANNEL_LABEL, PAYMENT_LABEL, REGION_LABEL, STATUS_LABEL } from './labels';

/** Longest slice of a note placed in the DOM. The full text is in the cell tooltip and the details view. */
const NOTES_PREVIEW_CHARS = 160;
/** Browsers stop showing very long tooltips anyway. */
const TOOLTIP_CHARS = 600;

const muted = (text: string) => <span className="is-muted">{text}</span>;

export const ORDER_COLUMNS: readonly GridColumn<Order>[] = [
  { id: 'id', header: 'Order ID', width: 112, mono: true, sortable: true, render: (o) => o.id },
  {
    id: 'customer',
    header: 'Customer',
    width: 150,
    sortable: true,
    render: (o) => o.customer,
    title: (o) => o.customer,
  },
  {
    id: 'status',
    header: 'Status',
    width: 108,
    sortable: true,
    render: (o) => (
      <span className={`status status--${o.status}`}>
        <i aria-hidden="true" />
        {STATUS_LABEL[o.status]}
      </span>
    ),
  },
  {
    id: 'amount',
    header: 'Amount',
    width: 104,
    align: 'right',
    sortable: true,
    render: (o) => formatINR(o.amount),
  },
  {
    id: 'createdAt',
    header: 'Created At',
    width: 148,
    sortable: true,
    render: (o) => formatDateTimeUTC(o.createdAt),
  },
  {
    id: 'updatedAt',
    header: 'Updated At',
    width: 148,
    sortable: true,
    render: (o) => (o.updatedAt === null ? muted(EMPTY) : formatDateTimeUTC(o.updatedAt)),
  },
  { id: 'region', header: 'Region', width: 92, sortable: true, render: (o) => REGION_LABEL[o.region] },
  { id: 'channel', header: 'Channel', width: 78, sortable: true, render: (o) => CHANNEL_LABEL[o.channel] },
  {
    id: 'paymentMethod',
    header: 'Payment',
    width: 96,
    sortable: true,
    render: (o) => PAYMENT_LABEL[o.paymentMethod],
  },
  {
    id: 'priority',
    header: 'Priority',
    width: 76,
    align: 'right',
    sortable: true,
    render: (o) => (o.priority === null ? muted('None') : o.priority),
  },
  {
    id: 'itemCount',
    header: 'Items',
    width: 64,
    align: 'right',
    sortable: true,
    render: (o) => formatCount(o.itemCount),
  },
  {
    id: 'email',
    header: 'Email',
    width: 220,
    sortable: true,
    render: (o) => o.email,
    title: (o) => o.email,
  },
  {
    id: 'notes',
    header: 'Notes',
    width: 280,
    sortable: true,
    render: (o) => (o.notes === '' ? muted(EMPTY) : truncate(o.notes, NOTES_PREVIEW_CHARS)),
    title: (o) => (o.notes === '' ? undefined : truncate(o.notes, TOOLTIP_CHARS)),
  },
];
