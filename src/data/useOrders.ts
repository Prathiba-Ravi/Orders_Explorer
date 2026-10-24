import { useCallback, useEffect, useState } from 'react';
import type { WorkerMessage } from './orders.worker';
import type { NormalizeStats, Order } from './types';

export type OrdersState =
  | { status: 'loading'; phase: 'downloading' | 'preparing' }
  | { status: 'ready'; orders: Order[]; stats: NormalizeStats }
  | { status: 'error'; message: string };

/**
 * Loads and cleans orders.json off the main thread so the page never freezes.
 * `reload` retries after an error.
 */
export function useOrders(): OrdersState & { reload: () => void } {
  const [state, setState] = useState<OrdersState>({ status: 'loading', phase: 'downloading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState({ status: 'loading', phase: 'downloading' });
    const worker = new Worker(new URL('./orders.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'phase') setState({ status: 'loading', phase: msg.phase });
      else if (msg.type === 'done') {
        setState({ status: 'ready', orders: msg.result.orders, stats: msg.result.stats });
        worker.terminate();
      } else {
        setState({ status: 'error', message: msg.message });
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setState({ status: 'error', message: 'The data loader crashed unexpectedly.' });
      worker.terminate();
    };

    // The worker resolves URLs from its own location, so hand it an absolute one.
    const url = new URL(`${import.meta.env.BASE_URL}orders.json`, window.location.href).href;
    worker.postMessage({ type: 'load', url });

    return () => worker.terminate();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
