import { useCallback, useEffect, useMemo, useRef } from 'react';

interface Options {
  /** Rows currently shown, as indices into the data (already filtered and sorted). */
  view: ArrayLike<number>;
  rowKey: (dataIndex: number) => number;
  /** The selection lives in the parent (so it can be kept in the URL and exported). */
  selected: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
}

export type SelectMode = 'replace' | 'toggle' | 'range';

export function useGridSelection({ view, rowKey, selected, onChange }: Options) {
  // Where Shift ranges start. It is a position in the current view, so it is meaningless after a re-sort or re-filter.
  const anchor = useRef<number | null>(null);
  useEffect(() => {
    anchor.current = null;
  }, [view]);

  const visibleKeys = useMemo(() => {
    const keys: number[] = [];
    for (let i = 0; i < view.length; i++) keys.push(rowKey(view[i]!));
    return keys;
  }, [view, rowKey]);

  const selectViewIndex = useCallback(
    (viewIndex: number, mode: SelectMode, anchorFallback?: number) => {
      const key = rowKey(view[viewIndex]!);
      if (mode === 'replace') {
        onChange(new Set([key]));
        anchor.current = viewIndex;
      } else if (mode === 'toggle') {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange(next);
        anchor.current = viewIndex;
      } else {
        // Range: exactly the rows between the anchor and this row (so Shift+Arrow can also shrink it).
        const from = anchor.current ?? anchorFallback ?? viewIndex;
        if (anchor.current === null) anchor.current = from;
        const next = new Set<number>();
        for (let i = Math.min(from, viewIndex); i <= Math.max(from, viewIndex); i++) next.add(rowKey(view[i]!));
        onChange(next);
      }
    },
    [onChange, rowKey, selected, view],
  );

  /** Adds or removes every row currently shown. Rows hidden by a filter are left alone. */
  const selectAllVisible = useCallback(
    (on: boolean) => {
      const next = new Set(selected);
      for (const k of visibleKeys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      onChange(next);
    },
    [onChange, selected, visibleKeys],
  );

  const selectionState = useMemo(() => {
    let visSelected = 0;
    for (const k of visibleKeys) if (selected.has(k)) visSelected++;
    const all = visibleKeys.length > 0 && visSelected === visibleKeys.length;
    const some = visSelected > 0 && !all;
    return { set: selected, count: selected.size, visSelected, hidden: selected.size - visSelected, all, some };
  }, [selected, visibleKeys]);

  return { selection: selectionState, selectViewIndex, selectAllVisible };
}
