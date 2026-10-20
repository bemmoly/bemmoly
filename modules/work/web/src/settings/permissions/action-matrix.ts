import { WORK_ACTION_AREAS, WORK_ACTIONS, type WorkActionArea } from '@bemmoly/module-work/shared';
import type { CapabilityMatrix, PutRoleCapabilitiesInput, Role } from '@bemmoly/shared';

/*
 * The Work actions matrix as plain data, so the draft rules are tested without React: the
 * kernel's roles matrix narrowed to the Work catalog, grouped by area, with a draft of
 * allowed cells keyed by action then role. Org admin holds every action and is never edited.
 */

const ORG_ADMIN_KEY = 'org_admin';

export type Allowed = Readonly<Record<string, Readonly<Record<string, boolean>>>>;

export interface ActionRow {
  name: string;
  label: string;
  description: string | null;
}

export interface ActionGroup {
  area: WorkActionArea;
  rows: ActionRow[];
}

export interface RoleChange {
  roleId: string;
  items: PutRoleCapabilitiesInput['items'];
}

export const isFixedRole = (role: Pick<Role, 'key'>) => role.key === ORG_ADMIN_KEY;

/** The Work catalog in its area order; a row the server does not list is left out. */
export function actionGroups(matrix: CapabilityMatrix): ActionGroup[] {
  const listed = new Map(matrix.items.map((item) => [item.name, item]));
  return WORK_ACTION_AREAS.map((area) => ({
    area,
    rows: WORK_ACTIONS.filter((action) => action.area === area && listed.has(action.name)).map(
      (action) => {
        const item = listed.get(action.name);
        return {
          name: action.name,
          label: item?.label ?? action.label,
          description: item?.description ?? action.description,
        };
      },
    ),
  })).filter((group) => group.rows.length > 0);
}

export function allowedOf(matrix: CapabilityMatrix): Allowed {
  return Object.fromEntries(
    matrix.items.map((item) => [
      item.name,
      Object.fromEntries(
        Object.entries(item.cells).map(([roleId, cell]) => [roleId, cell.allowed]),
      ),
    ]),
  );
}

/** Flips one cell; the Org admin column stays as it is. */
export function toggle(cells: Allowed, action: string, role: Role): Allowed {
  if (isFixedRole(role)) return cells;
  const row = cells[action] ?? {};
  return { ...cells, [action]: { ...row, [role.id]: !row[role.id] } };
}

/** One save per role whose column changed, listing only the cells that changed. */
export function roleChanges(
  base: Allowed,
  draft: Allowed,
  roles: readonly Role[],
  groups: readonly ActionGroup[],
): RoleChange[] {
  const names = groups.flatMap((group) => group.rows.map((row) => row.name));
  return roles
    .filter((role) => !isFixedRole(role))
    .map((role) => ({
      roleId: role.id,
      items: names
        .filter((name) => Boolean(base[name]?.[role.id]) !== Boolean(draft[name]?.[role.id]))
        .map((name) => ({ capability: name, allowed: Boolean(draft[name]?.[role.id]) })),
    }))
    .filter((change) => change.items.length > 0);
}
