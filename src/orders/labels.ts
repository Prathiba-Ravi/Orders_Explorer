import type { Channel, PaymentMethod, Region, Status } from '../data/types';

/** One display style for every enum: sentence case, short, scannable. */
export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const REGION_LABEL: Record<Region, string> = {
  NORTH: 'North',
  SOUTH: 'South',
  EAST: 'East',
  WEST: 'West',
  CENTRAL: 'Central',
  NORTHEAST: 'Northeast',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  web: 'Web',
  app: 'App',
  phone: 'Phone',
  store: 'Store',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  cod: 'COD',
  wallet: 'Wallet',
};
