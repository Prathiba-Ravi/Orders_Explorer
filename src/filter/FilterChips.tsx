import { conditionLabel } from './conditionLabel';
import { conditionStatus } from './status';
import type { FilterRoot } from './types';
import './filter.css';

interface FilterChipsProps {
  filter: FilterRoot;
  onChange: (next: FilterRoot) => void;
  onClearAll: () => void;
}

export function FilterChips({ filter, onChange, onClearAll }: FilterChipsProps) {
  const groups = filter.groups.filter((g) => g.conditions.length > 0);
  if (groups.length === 0) return null;

  const remove = (conditionId: string) => {
    onChange({
      groups: filter.groups
        .map((g) => ({ ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }))
        .filter((g) => g.conditions.length > 0),
    });
  };

  return (
    <div className="chips" role="list" aria-label="Active filters">
      {groups.map((group, gi) => (
        <span key={group.id} className="chips__group" role="presentation">
          {gi > 0 && <span className="chips__op chips__op--and">and</span>}
          {group.conditions.map((c, ci) => {
            const status = conditionStatus(c);
            const problem =
              status.state === 'incomplete'
                ? 'Not applied yet: a value is missing.'
                : status.state === 'invalid'
                  ? `Not applied: ${status.message}`
                  : undefined;
            return (
              <span key={c.id} className="chips__pair" role="presentation">
                {ci > 0 && <span className="chips__op">or</span>}
                <span
                  className={`chips__item${status.state === 'ok' ? '' : ` chips__item--${status.state}`}`}
                  role="listitem"
                  title={problem}
                >
                  <span className="chips__text">{conditionLabel(c)}</span>
                  <button
                    type="button"
                    className="chips__remove"
                    aria-label={`Remove filter: ${conditionLabel(c)}`}
                    onClick={() => remove(c.id)}
                  >
                    ×
                  </button>
                </span>
              </span>
            );
          })}
        </span>
      ))}
      <button type="button" className="chips__clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
