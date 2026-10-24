import { ENUM_OPTIONS, FILTER_FIELDS, fieldMeta } from './fields';
import { dateBetweenValue, dateOpValue, msToDateInput } from './dates';
import { newFilterId } from './newId';
import type {
  DateField,
  EnumField,
  FilterCondition,
  FilterGroup,
  FilterRoot,
  NumberField,
  TextField,
} from './types';
import './filter.css';

interface FilterBuilderProps {
  filter: FilterRoot;
  onChange: (next: FilterRoot) => void;
}

export function FilterBuilder({ filter, onChange }: FilterBuilderProps) {
  const groups = filter.groups;

  const setGroups = (next: FilterGroup[]) => onChange({ groups: next });

  if (groups.length === 0) {
    return (
      <section className="filter" aria-label="Filter builder">
        <button type="button" className="filter__link" onClick={() => setGroups([emptyGroup()])}>
          + Add filter
        </button>
      </section>
    );
  }

  const updateGroup = (groupId: string, patch: (g: FilterGroup) => FilterGroup) => {
    setGroups(groups.map((g) => (g.id === groupId ? patch(g) : g)));
  };

  return (
    <section className="filter" aria-label="Filter builder">
      {groups.map((group, gi) => (
        <div key={group.id} className="filter__group">
          {gi > 0 && <div className="filter__and">AND</div>}
          <div className="filter__group-inner">
            <span className="filter__or-label">Match any</span>
            {group.conditions.map((cond, ci) => (
              <div key={cond.id} className="filter__row">
                {ci > 0 && <span className="filter__or">OR</span>}
                <ConditionRow
                  condition={cond}
                  onChange={(next) =>
                    updateGroup(group.id, (g) => ({
                      ...g,
                      conditions: g.conditions.map((c) => (c.id === cond.id ? next : c)),
                    }))
                  }
                  onRemove={() =>
                    updateGroup(group.id, (g) => ({
                      ...g,
                      conditions: g.conditions.filter((c) => c.id !== cond.id),
                    }))
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="filter__link"
              onClick={() =>
                updateGroup(group.id, (g) => ({
                  ...g,
                  conditions: [...g.conditions, defaultCondition('status')],
                }))
              }
            >
              + Condition
            </button>
            {groups.length > 1 && (
              <button type="button" className="filter__link filter__link--danger" onClick={() => setGroups(groups.filter((g) => g.id !== group.id))}>
                Remove group
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="filter__link" onClick={() => setGroups([...groups, emptyGroup()])}>
        + Group
      </button>
    </section>
  );
}

function emptyGroup(): FilterGroup {
  return { id: newFilterId('g'), conditions: [defaultCondition('status')] };
}

function defaultCondition(fieldId: string): FilterCondition {
  const meta = fieldMeta(fieldId)!;
  const id = newFilterId('c');
  if (meta.kind === 'text') {
    return { id, kind: 'text', field: meta.id as TextField, op: 'contains', value: '' };
  }
  if (meta.kind === 'number') {
    return { id, kind: 'number', field: meta.id as NumberField, op: 'gt', value: 0 };
  }
  if (meta.kind === 'date') {
    return { id, kind: 'date', field: meta.id as DateField, op: 'after', value: 0 };
  }
  return { id, kind: 'enum', field: meta.id as EnumField, op: 'isOneOf', values: [] };
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  onChange: (c: FilterCondition) => void;
  onRemove: () => void;
}) {
  const onField = (fieldId: string) => {
    const m = fieldMeta(fieldId);
    if (!m) return;
    onChange(defaultCondition(fieldId));
  };

  return (
    <div className="filter__condition">
      <select className="filter__select" value={condition.field} onChange={(e) => onField(e.target.value)} aria-label="Field">
        {FILTER_FIELDS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      {condition.kind === 'text' && (
        <>
          <select
            className="filter__select"
            value={condition.op}
            onChange={(e) => onChange({ ...condition, op: e.target.value as typeof condition.op })}
            aria-label="Operator"
          >
            <option value="contains">contains</option>
            <option value="notContains">does not contain</option>
            <option value="equals">equals</option>
          </select>
          <input
            className="filter__input"
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            aria-label="Value"
          />
        </>
      )}

      {condition.kind === 'number' && (
        <>
          <select
            className="filter__select"
            value={condition.op}
            onChange={(e) => {
              const op = e.target.value as typeof condition.op;
              const value = op === 'between' ? { min: 0, max: 0 } : 0;
              onChange({ ...condition, op, value });
            }}
            aria-label="Operator"
          >
            <option value="eq">equals</option>
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
            <option value="between">between</option>
          </select>
          {condition.op === 'between' ? (
            <>
              <input
                type="number"
                className="filter__input filter__input--num"
                value={condition.value.min}
                onChange={(e) =>
                  onChange({
                    ...condition,
                    value: { ...condition.value, min: Number(e.target.value) },
                  })
                }
                aria-label="Minimum"
              />
              <input
                type="number"
                className="filter__input filter__input--num"
                value={condition.value.max}
                onChange={(e) =>
                  onChange({
                    ...condition,
                    value: { ...condition.value, max: Number(e.target.value) },
                  })
                }
                aria-label="Maximum"
              />
            </>
          ) : (
            <input
              type="number"
              className="filter__input filter__input--num"
              value={typeof condition.value === 'number' ? condition.value : 0}
              onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
              aria-label="Value"
            />
          )}
        </>
      )}

      {condition.kind === 'date' && (
        <>
          <select
            className="filter__select"
            value={condition.op}
            onChange={(e) => {
              const op = e.target.value as typeof condition.op;
              const value = op === 'between' ? { min: 0, max: 0 } : 0;
              onChange({ ...condition, op, value });
            }}
            aria-label="Operator"
          >
            <option value="before">before</option>
            <option value="after">after</option>
            <option value="between">between</option>
          </select>
          {condition.op === 'between' ? (
            <>
              <input
                type="date"
                className="filter__input"
                value={typeof condition.value === 'object' ? msToDateInput(condition.value.min) : ''}
                onChange={(e) => {
                  const to =
                    typeof condition.value === 'object' ? msToDateInput(condition.value.max) : e.target.value;
                  const range = dateBetweenValue(e.target.value, to);
                  if (range) onChange({ ...condition, value: range });
                }}
                aria-label="From date"
              />
              <input
                type="date"
                className="filter__input"
                value={typeof condition.value === 'object' ? msToDateInput(condition.value.max) : ''}
                onChange={(e) => {
                  const from =
                    typeof condition.value === 'object' ? msToDateInput(condition.value.min) : e.target.value;
                  const range = dateBetweenValue(from, e.target.value);
                  if (range) onChange({ ...condition, value: range });
                }}
                aria-label="To date"
              />
            </>
          ) : (
            <input
              type="date"
              className="filter__input"
              onChange={(e) => {
                const v = dateOpValue(condition.op, e.target.value);
                if (v !== null) onChange({ ...condition, value: v });
              }}
              aria-label="Date"
            />
          )}
        </>
      )}

      {condition.kind === 'enum' && (
        <EnumPicker
          field={condition.field}
          values={condition.values}
          onChange={(values) => onChange({ ...condition, values })}
        />
      )}

      <button type="button" className="filter__remove" onClick={onRemove} aria-label="Remove condition">
        ×
      </button>
    </div>
  );
}

function EnumPicker({
  field,
  values,
  onChange,
}: {
  field: EnumField;
  values: readonly string[];
  onChange: (v: string[]) => void;
}) {
  const options = ENUM_OPTIONS[field];
  const set = new Set(values);
  return (
    <div className="filter__enum" role="group" aria-label="Values">
      {options.map((o) => (
        <label key={o.value} className="filter__enum-item">
          <input
            type="checkbox"
            checked={set.has(o.value)}
            onChange={() => {
              const next = new Set(set);
              if (next.has(o.value)) next.delete(o.value);
              else next.add(o.value);
              onChange([...next]);
            }}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
