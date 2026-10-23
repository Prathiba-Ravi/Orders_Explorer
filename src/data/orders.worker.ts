/// <reference lib="webworker" />
import { normalizeOrders } from './normalize';
import type { NormalizeResult } from './types';

export type WorkerRequest = { type: 'load'; url: string };
export type WorkerMessage =
  | { type: 'phase'; phase: 'downloading' | 'preparing' }
  | { type: 'done'; result: NormalizeResult }
  | { type: 'error'; message: string };

const post = (m: WorkerMessage) => self.postMessage(m);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'load') return;
  try {
    post({ type: 'phase', phase: 'downloading' });
    const res = await fetch(event.data.url);
    if (!res.ok) throw new Error(`Could not download orders (HTTP ${res.status}).`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('orders.json is not a JSON array.');
    post({ type: 'phase', phase: 'preparing' });
    post({ type: 'done', result: normalizeOrders(json) });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error while loading orders.' });
  }
};
