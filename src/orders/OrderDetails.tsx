import type { Order } from '../data/types';
import { EMPTY, formatCount, formatDateTimeUTC, formatINR, formatDateUTC } from '../lib/format';
import { CHANNEL_LABEL, PAYMENT_LABEL, REGION_LABEL, STATUS_LABEL } from './labels';
import './details.css';

interface OrderDetailsProps {
  order: Order;
  onClose: () => void;
}

export function OrderDetails({ order, onClose }: OrderDetailsProps) {
  return (
    <aside className="details" role="dialog" aria-label={`Order ${order.id}`}>
      <header className="details__head">
        <h2>{order.id}</h2>
        <button type="button" className="details__close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>
      <dl className="details__list">
        <Row label="Customer" value={order.customer} />
        <Row label="Email" value={order.email} />
        <Row label="Status" value={STATUS_LABEL[order.status]} />
        <Row label="Amount" value={formatINR(order.amount)} />
        <Row
          label="Created At"
          value={
            order.createdAtDateOnly
              ? `${formatDateUTC(order.createdAt)} (time not recorded)`
              : formatDateTimeUTC(order.createdAt, true)
          }
        />
        <Row
          label="Updated At"
          value={order.updatedAt === null ? EMPTY : formatDateTimeUTC(order.updatedAt, true)}
        />
        <Row label="Region" value={REGION_LABEL[order.region]} />
        <Row label="Channel" value={CHANNEL_LABEL[order.channel]} />
        <Row label="Payment" value={PAYMENT_LABEL[order.paymentMethod]} />
        <Row label="Priority" value={order.priority === null ? 'None' : String(order.priority)} />
        <Row label="Items" value={formatCount(order.itemCount)} />
        <Row label="Notes" value={order.notes === '' ? EMPTY : order.notes} multiline />
      </dl>
    </aside>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={multiline ? 'details__multiline' : undefined}>{value}</dd>
    </>
  );
}
