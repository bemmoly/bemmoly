/** Where a key moves the focus in a graph of columns; null when the key is not the graph's. */
export function nextNode(
  columns: readonly (readonly string[])[],
  current: string,
  key: string,
  rtl: boolean,
): string | null {
  const flat = columns.flat();
  let column = columns.findIndex((ids) => ids.includes(current));
  if (column < 0) return flat[0] ?? null;
  let row = columns[column]?.indexOf(current) ?? 0;
  const at = (c: number, r: number) => {
    const ids = columns[c] ?? [];
    return ids[Math.min(r, ids.length - 1)] ?? null;
  };
  const step = (delta: number) => {
    const index = flat.indexOf(current) + delta;
    return flat[Math.max(0, Math.min(flat.length - 1, index))] ?? null;
  };
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  switch (key) {
    case forward:
      column = Math.min(columns.length - 1, column + 1);
      return at(column, row);
    case back:
      column = Math.max(0, column - 1);
      return at(column, row);
    case 'ArrowDown':
      row += 1;
      return at(column, row);
    case 'ArrowUp':
      row = Math.max(0, row - 1);
      return at(column, row);
    case 'j':
      return step(1);
    case 'k':
      return step(-1);
    case 'Home':
      return flat[0] ?? null;
    case 'End':
      return flat[flat.length - 1] ?? null;
    default:
      return null;
  }
}
