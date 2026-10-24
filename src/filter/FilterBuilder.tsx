import { ENUM_OPTIONS, FILTER_FIELDS, fieldMeta } from './fields';
import { newFilterId } from './newId';
import { conditionStatus } from './status';
import type {
  DateCondition,
  DateField,
  EnumField,
  FilterCondition,
  FilterGroup,
  FilterRoot,
  NumberCondition,
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
                updateGroup(group.id, (g) => ({ ...g, conditions: [...g.conditions, defaultCondition('status')] }))
              }
            >
              + Condition
            </button>
            {groups.length > 1 && (
              <button
                type="button"
                className="filter__link filter__link--danger"
                onClick={() => setGroups(groups.filter((g) => g.id !== group.id))}
              >
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

/** A new condition starts empty ("incomplete"), so adding one never changes the results by itself. */
function defaultCondition(fieldId: string): FilterCondition {
  const meta = fieldMeta(fieldId)!;
  const id = newFilterId('c');
  switch (meta.kind) {
    case 'text':
      return { id, kind: 'text', field: meta.id as TextField, op: 'contains', value: '' };
    case 'number':
      return { id, kind: 'number', field: meta.id as NumberField, op: 'gt', value: '' };
    case 'date':
      return { id, kind: 'date', field: meta.id as DateField, op: 'after', value: '' };
    case 'enum':
      return { id, kind: 'enum', field: meta.id as EnumField, op: 'isOneOf', values: [] };
  }
}

/** Switching operator keeps what the user already typed where it still makes sense. */
function changeNumberOp(c: NumberCondition, op: NumberCondition['op']): NumberCondition {
  const first = c.op === 'between' ? c.min : c.value;
  return op === 'between'
    ? { id: c.id, kind: 'number', field: c.field, op, min: first, max: '' }
    : { id: c.id, kind: 'number', field: c.field, op, value: first };
}

function changeDateOp(c: DateCondition, op: DateCondition['op']): DateCondition {
  const first = c.op === 'between' ? c.from : c.value;
  return op === 'between'
    ? { id: c.id, kind: 'date', field: c.field, op, from: first, to: '' }
    : { id: c.id, kind: 'date', field: c.field, op, value: first };
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
  const status = conditionStatus(condition);
  const invalid = status.state === 'invalid';

  return (
    <div className="filter__condition">
      <select
        className="filter__select"
        value={condition.field}
        onChange={(e) => onChange(defaultCondition(e.target.value))}
        aria-label="Field"
      >
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
            onChange={(e) => onChange(changeNumberOp(condition, e.target.value as NumberCondition['op']))}
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
                step="any"
                className={`filter__input filter__input--num${invalid ? ' filter__input--invalid' : ''}`}
                value={condition.min}
                onChange={(e) => onChange({ ...condition, min: e.target.value })}
                aria-label="Minimum"
                aria-invalid={invalid}
              />
              <span className="filter__or">and</span>
              <input
                type="number"
                step="any"
                className={`filter__input filter__input--num${invalid ? ' filter__input--invalid' : ''}`}
                value={condition.max}
                onChange={(e) => onChange({ ...condition, max: e.target.value })}
                aria-label="Maximum"
                aria-invalid={invalid}
              />
            </>
          ) : (
            <input
              type="number"
              step="any"
              className="filter__input filter__input--num"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
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
            onChange={(e) => onChange(changeDateOp(condition, e.target.value as DateCondition['op']))}
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
                className={`filter__input${invalid ? ' filter__input--invalid' : ''}`}
                value={condition.from}
                onChange={(e) => onChange({ ...condition, from: e.target.value })}
                aria-label="From date"
                aria-invalid={invalid}
              />
              <span className="filter__or">and</span>
              <input
                type="date"
                className={`filter__input${invalid ? ' filter__input--invalid' : ''}`}
                value={condition.to}
                onChange={(e) => onChange({ ...condition, to: e.target.value })}
                aria-label="To date"
                aria-invalid={invalid}
              />
            </>
          ) : (
            <input
              type="date"
              className="filter__input"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
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

      {status.state === 'invalid' && (
        <span className="filter__problem" role="alert">
          {status.message} Not applied until fixed.
        </span>
      )}
      {status.state === 'incomplete' && <span className="filter__hint">Not applied yet</span>}
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
