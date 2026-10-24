import { conditionLabel } from './conditionLabel';
import type { FilterRoot } from './types';
import './filter.css';

interface FilterChipsProps {
  filter: FilterRoot;
  onChange: (next: FilterRoot) => void;
  onClearAll: () => void;
}

export function FilterChips({ filter, onChange, onClearAll }: FilterChipsProps) {
  const chips = filter.groups.flatMap((g) => g.conditions);
  if (chips.length === 0) return null;

  const remove = (conditionId: string) => {
    onChange({
      groups: filter.groups
        .map((g) => ({ ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }))
        .filter((g) => g.conditions.length > 0),
    });
  };

  return (
    <div className="chips" role="list" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.id} className="chips__item" role="listitem">
          <span className="chips__text">{conditionLabel(c)}</span>
          <button type="button" className="chips__remove" aria-label="Remove filter" onClick={() => remove(c.id)}>
            ×
          </button>
        </span>
      ))}
      <button type="button" className="chips__clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
