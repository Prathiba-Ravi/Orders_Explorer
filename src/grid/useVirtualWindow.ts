import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Options {
  count: number;
  rowHeight: number;
  /** Height of the sticky header that sits above the first row inside the scroller. */
  headerHeight: number;
  /** Extra rows rendered above and below the viewport so fast scrolling never shows blanks. */
  overscan?: number;
}

/**
 * Works out which rows are on screen. State only changes when the first or last
 * row changes, so scrolling a few pixels does not re-render anything.
 */
export function useVirtualWindow({ count, rowHeight, headerHeight, overscan = 8 }: Options) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const bodyViewport = Math.max(0, el.clientHeight - headerHeight);
    const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
    const end = Math.min(count, Math.ceil((top + bodyViewport) / rowHeight) + overscan);
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [count, rowHeight, headerHeight, overscan]);

  // Re-measure when the data size changes (the browser clamps scrollTop when content shrinks).
  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  // Never trust a stale range for one render after `count` shrinks.
  const end = Math.min(range.end, count);
  const start = Math.min(range.start, end);

  return { scrollerRef, start, end, onScroll: measure, totalHeight: count * rowHeight };
}
