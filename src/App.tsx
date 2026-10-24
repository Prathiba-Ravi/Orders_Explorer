import { useOrders } from './data/useOrders';

/** Temporary shell: proves the data layer end to end. Replaced by the real screen in later commits. */
export function App() {
  const data = useOrders();

  if (data.status === 'loading') {
    return <p role="status">{data.phase === 'downloading' ? 'Downloading orders…' : 'Preparing orders…'}</p>;
  }
  if (data.status === 'error') {
    return (
      <div role="alert">
        <p>{data.message}</p>
        <button onClick={data.reload}>Try again</button>
      </div>
    );
  }
  return (
    <p>
      {data.orders.length.toLocaleString('en-IN')} orders loaded ({data.stats.duplicatesRemoved} duplicates removed,{' '}
      {data.stats.skipped} skipped).
    </p>
  );
}
