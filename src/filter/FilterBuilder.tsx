import type { KeyboardEvent } from 'react';
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
  onClearAll: () => void;
}

export function FilterBuilder({ filter, onChange, onClearAll }: FilterBuilderProps) {
  const groups = filter.groups;
  const setGroups = (next: FilterGroup[]) => onChange({ groups: next });
  const focusGroup = (groupId: string) => {
    requestAnimationFrame(() => {
      const group = Array.from(document.querySelectorAll<HTMLElement>('[data-filter-group-id]')).find(
        (element) => element.dataset.filterGroupId === groupId,
      );
      group?.querySelector<HTMLElement>('select, button')?.focus();
    });
  };
  const focusCondition = (conditionId: string) => {
    requestAnimationFrame(() => {
      const condition = Array.from(document.querySelectorAll<HTMLElement>('[data-filter-condition-id]')).find(
        (element) => element.dataset.filterConditionId === conditionId,
      );
      condition?.querySelector<HTMLElement>('select, input')?.focus();
    });
  };
  const addGroup = () => {
    const group = emptyGroup();
    setGroups([...groups, group]);
    focusGroup(group.id);
  };
  const addCondition = (groupId: string) => {
    const condition = defaultCondition('status');
    setGroups(
      groups.map((group) =>
        group.id === groupId ? { ...group, conditions: [...group.conditions, condition] } : group,
      ),
    );
    focusCondition(condition.id);
  };

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const command = event.ctrlKey || event.metaKey;
    const isTextInput =
      (target instanceof HTMLInputElement && target.type !== 'checkbox') ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable;

    if (command && !isTextInput && event.key === 'Backspace') {
      event.preventDefault();
      onClearAll();
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.filter__link')?.focus();
      });
      return;
    }

    if (command && event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        addGroup();
      } else {
        const groupId = target.closest<HTMLElement>('[data-filter-group-id]')?.dataset.filterGroupId;
        if (groupId) addCondition(groupId);
        else addGroup();
      }
      return;
    }

    const direction = event.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(direction)) return;

    const tagName = target.tagName;
    const isCheckbox = target instanceof HTMLInputElement && target.type === 'checkbox';
    if (tagName === 'INPUT' && !isCheckbox) return;
    if (tagName === 'SELECT' && direction !== 'ArrowLeft' && direction !== 'ArrowRight') return;

    const section = event.currentTarget;
    const cells = Array.from(
      section.querySelectorAll<HTMLElement>('button:not(:disabled), select, input:not([type="hidden"])'),
    );
    const current = cells.indexOf(target);
    if (current < 0) return;

    const currentRect = target.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;
    const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
    let nearest: HTMLElement | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const cell of cells) {
      if (cell === target) continue;
      const rect = cell.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const primary = horizontal ? (x - currentX) * sign : (y - currentY) * sign;
      if (primary <= 0) continue;
      const secondary = horizontal ? Math.abs(y - currentY) : Math.abs(x - currentX);
      const distance = primary + secondary * 2;
      if (distance < nearestDistance) {
        nearest = cell;
        nearestDistance = distance;
      }
    }

    if (nearest) {
      event.preventDefault();
      nearest.focus();
    }
  };

  if (groups.length === 0) {
    return (
      <section className="filter" aria-label="Filter builder" onKeyDown={handleFilterKeyDown}>
        <button type="button" className="filter__link" onClick={addGroup}>
          + Add filter
        </button>
      </section>
    );
  }

  const updateGroup = (groupId: string, patch: (g: FilterGroup) => FilterGroup) => {
    setGroups(groups.map((g) => (g.id === groupId ? patch(g) : g)));
  };

  return (
    <section className="filter" aria-label="Filter builder" onKeyDown={handleFilterKeyDown}>
      {groups.map((group, gi) => (
        <div key={group.id} className="filter__group">
          {gi > 0 && <div className="filter__and">AND</div>}
          <div className="filter__group-inner" data-filter-group-id={group.id}>
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
              onClick={() => addCondition(group.id)}
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
      <button type="button" className="filter__link" onClick={addGroup}>
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
    <div className="filter__condition" data-filter-condition-id={condition.id}>
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
