let n = 0;
export function newFilterId(prefix: string): string {
  n += 1;
  return `${prefix}${n}`;
}
