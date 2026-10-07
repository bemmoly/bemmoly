import type { CapabilityMatrix, PutRoleCapabilitiesInput, Role } from '@bemmoly/shared';
import { ORG_ADMIN_KEY } from './use-people.ts';

/**
 * The roles matrix as plain data, so the draft rules are tested without React: cells by
 * capability then role, Org admin never edited, a row lock covering every editable cell.
 */
export interface Cell {
  allowed: boolean;
  lockedByOrg: boolean;
}

export type CellMap = Readonly<Record<string, Readonly<Record<string, Cell>>>>;

export type MatrixRow = CapabilityMatrix['items'][number];

export interface MatrixGroup {
  name: string;
  rows: MatrixRow[];
}

export interface RolePayload {
  roleId: string;
  items: PutRoleCapabilitiesInput['items'];
}

const EMPTY: Cell = { allowed: false, lockedByOrg: false };

export function cellsOf(matrix: CapabilityMatrix): CellMap {
  return Object.fromEntries(matrix.items.map((row) => [row.name, row.cells]));
}

export function cellOf(cells: CellMap, capability: string, roleId: string): Cell {
  return cells[capability]?.[roleId] ?? EMPTY;
}

export function isFixedRole(role: Pick<Role, 'key'>): boolean {
  return role.key === ORG_ADMIN_KEY;
}

function editableIds(roles: readonly Role[]): string[] {
  return roles.filter((role) => !isFixedRole(role)).map((role) => role.id);
}

function withCells(
  cells: CellMap,
  capability: string,
  patch: Record<string, Partial<Cell>>,
): CellMap {
  const row = { ...cells[capability] };
  for (const [roleId, change] of Object.entries(patch)) {
    row[roleId] = { ...cellOf(cells, capability, roleId), ...change };
  }
  return { ...cells, [capability]: row };
}

/** Flips one cell; the Org admin column and unknown roles stay as they are. */
export function toggleCell(
  cells: CellMap,
  capability: string,
  roleId: string,
  roles: readonly Role[],
): CellMap {
  if (!editableIds(roles).includes(roleId)) return cells;
  const allowed = !cellOf(cells, capability, roleId).allowed;
  return withCells(cells, capability, { [roleId]: { allowed } });
}

/** A row reads as locked when every editable role's cell in it is locked by the org. */
export function isRowLocked(cells: CellMap, capability: string, roles: readonly Role[]): boolean {
  const ids = editableIds(roles);
  return ids.length > 0 && ids.every((id) => cellOf(cells, capability, id).lockedByOrg);
}

/** Locks or unlocks every editable cell in the row at once, as the mock's row switch does. */
export function toggleRowLock(cells: CellMap, capability: string, roles: readonly Role[]): CellMap {
  const lockedByOrg = !isRowLocked(cells, capability, roles);
  const patch = Object.fromEntries(editableIds(roles).map((id) => [id, { lockedByOrg }]));
  return withCells(cells, capability, patch);
}

/** One PUT body per role with changed cells; unchanged rows are left out and keep their value. */
export function rolePayloads(
  base: CellMap,
  draft: CellMap,
  rows: readonly Pick<MatrixRow, 'name'>[],
  roles: readonly Role[],
): RolePayload[] {
  return editableIds(roles).flatMap((roleId) => {
    const items = rows.flatMap(({ name }) => {
      const before = cellOf(base, name, roleId);
      const after = cellOf(draft, name, roleId);
      if (before.allowed === after.allowed && before.lockedByOrg === after.lockedByOrg) return [];
      return [{ capability: name, allowed: after.allowed, lockedByOrg: after.lockedByOrg }];
    });
    return items.length ? [{ roleId, items }] : [];
  });
}

/** Capability rows under their group, in the order the server lists them. */
export function groupRows(rows: readonly MatrixRow[]): MatrixGroup[] {
  const groups: MatrixGroup[] = [];
  for (const row of rows) {
    const group = groups.find((entry) => entry.name === row.group);
    if (group) group.rows.push(row);
    else groups.push({ name: row.group, rows: [row] });
  }
  return groups;
}
