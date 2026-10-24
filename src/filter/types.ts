/** One filter group: any matching condition keeps the row (OR). Groups combine with AND. */

export type TextField = 'id' | 'customer' | 'email' | 'notes';
export type NumberField = 'amount' | 'itemCount';
export type DateField = 'createdAt' | 'updatedAt';
export type EnumField = 'status' | 'region' | 'channel' | 'paymentMethod' | 'priority';

export type TextOp = 'contains' | 'notContains' | 'equals';
export type NumberOp = 'eq' | 'gt' | 'lt' | 'between';
export type DateOp = 'before' | 'after' | 'between';
export type EnumOp = 'isOneOf';

export type FilterCondition =
  | { id: string; kind: 'text'; field: TextField; op: TextOp; value: string }
  | { id: string; kind: 'number'; field: NumberField; op: NumberOp; value: number | { min: number; max: number } }
  | { id: string; kind: 'date'; field: DateField; op: DateOp; value: number | { min: number; max: number } }
  | { id: string; kind: 'enum'; field: EnumField; op: EnumOp; values: readonly string[] };

export interface FilterGroup {
  id: string;
  conditions: FilterCondition[];
}

export interface FilterRoot {
  groups: FilterGroup[];
}

export const EMPTY_FILTER: FilterRoot = { groups: [] };

export function isEmptyFilter(f: FilterRoot): boolean {
  return f.groups.length === 0 || f.groups.every((g) => g.conditions.length === 0);
}
