/**
 * The filter: groups of conditions. Inside a group any condition may match (OR);
 * a row must satisfy every group (AND).
 *
 * Values are kept as the text the user typed (numbers and dates too), so an empty or
 * half-typed input is simply "incomplete" and ignored, instead of silently meaning 0.
 */

export type TextField = 'id' | 'customer' | 'email' | 'notes';
export type NumberField = 'amount' | 'itemCount';
export type DateField = 'createdAt' | 'updatedAt';
export type EnumField = 'status' | 'region' | 'channel' | 'paymentMethod' | 'priority';

export type TextOp = 'contains' | 'notContains' | 'equals';
export type NumberOp = 'eq' | 'gt' | 'lt' | 'between';
export type DateOp = 'before' | 'after' | 'between';

export type TextCondition = { id: string; kind: 'text'; field: TextField; op: TextOp; value: string };
export type NumberCondition =
  | { id: string; kind: 'number'; field: NumberField; op: 'eq' | 'gt' | 'lt'; value: string }
  | { id: string; kind: 'number'; field: NumberField; op: 'between'; min: string; max: string };
export type DateCondition =
  /** Dates are `YYYY-MM-DD` (what <input type="date"> gives), always read as UTC days. */
  | { id: string; kind: 'date'; field: DateField; op: 'before' | 'after'; value: string }
  | { id: string; kind: 'date'; field: DateField; op: 'between'; from: string; to: string };
export type EnumCondition = {
  id: string;
  kind: 'enum';
  field: EnumField;
  op: 'isOneOf';
  values: readonly string[];
};

export type FilterCondition = TextCondition | NumberCondition | DateCondition | EnumCondition;

export interface FilterGroup {
  id: string;
  conditions: FilterCondition[];
}

export interface FilterRoot {
  groups: FilterGroup[];
}

export const EMPTY_FILTER: FilterRoot = { groups: [] };
