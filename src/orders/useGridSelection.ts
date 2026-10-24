import { useCallback, useMemo, useState } from 'react';

interface Options {
  view: ArrayLike<number>;
  rowKey: (dataIndex: number) => number;
}

export function useGridSelection({ view, rowKey }: Options) {
  const [selected, setSelectedState] = useState(() => new Set<number>());
  const [anchorViewIndex, setAnchorViewIndex] = useState<number | null>(null);

  const visibleKeys = useMemo(() => {
    const keys: number[] = [];
    for (let i = 0; i < view.length; i++) keys.push(rowKey(view[i]!));
    return keys;
  }, [view, rowKey]);

  const isSelected = useCallback((key: number) => selected.has(key), [selected]);

  const setSelected = useCallback((keys: Iterable<number>) => {
    setSelectedState(new Set(keys));
  }, []);

  const toggleKey = useCallback((key: number) => {
    setSelectedState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectViewIndex = useCallback(
    (viewIndex: number, mode: 'replace' | 'toggle' | 'range') => {
      const key = rowKey(view[viewIndex]!);
      if (mode === 'replace') {
        setSelectedState(new Set([key]));
        setAnchorViewIndex(viewIndex);
        return;
      }
      if (mode === 'toggle') {
        toggleKey(key);
        setAnchorViewIndex(viewIndex);
        return;
      }
      setSelectedState((prev) => {
        const next = new Set(prev);
        const anchor = anchorViewIndex ?? viewIndex;
        const lo = Math.min(anchor, viewIndex);
        const hi = Math.max(anchor, viewIndex);
        for (let i = lo; i <= hi; i++) next.add(rowKey(view[i]!));
        return next;
      });
    },
    [anchorViewIndex, rowKey, toggleKey, view],
  );

  const selectAllVisible = useCallback(
    (on: boolean) => {
      setSelectedState((prev) => {
        const next = new Set(prev);
        if (!on) {
          for (const k of visibleKeys) next.delete(k);
        } else {
          for (const k of visibleKeys) next.add(k);
        }
        return next;
      });
    },
    [visibleKeys],
  );

  const selectionState = useMemo(() => {
    let visSelected = 0;
    for (const k of visibleKeys) if (selected.has(k)) visSelected++;
    const all = visibleKeys.length > 0 && visSelected === visibleKeys.length;
    const some = visSelected > 0 && !all;
    return { set: selected, count: selected.size, visSelected, all, some };
  }, [selected, visibleKeys]);

  return {
    selection: selectionState,
    isSelected,
    selectViewIndex,
    selectAllVisible,
    setSelected,
    toggleKey,
  };
}
