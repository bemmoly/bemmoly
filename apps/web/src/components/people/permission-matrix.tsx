import type { Role } from '@bemmoly/shared';
import { Card, Checkbox, Switch } from '@bemmoly/ui';
import type { CSSProperties } from 'react';
import type { useRolesMatrix } from '../../hooks/use-roles.ts';

type Matrix = ReturnType<typeof useRolesMatrix>;

/** Capability, one 110px column per role, then the 70px lock column, as in the mock. */
function gridOf(roles: readonly Role[]): CSSProperties {
  return { gridTemplateColumns: `minmax(0,1fr) ${roles.map(() => '110px').join(' ')} 70px` };
}

function Header({ roles, grid }: { roles: readonly Role[]; grid: CSSProperties }) {
  return (
    <div
      role="row"
      style={grid}
      className="grid items-end border-b border-br2 bg-sf2 px-4 py-2.5 text-11 font-medium tracking-caps text-tx5 uppercase"
    >
      <span role="columnheader">Capability</span>
      {roles.map((role) => (
        <span
          key={role.id}
          role="columnheader"
          className={role.isSystem ? 'text-center' : 'text-center text-ac'}
        >
          {role.name}
          {!role.isSystem && (
            <span className="block font-normal tracking-[0] normal-case">custom</span>
          )}
        </span>
      ))}
      <span role="columnheader" className="text-center">
        Lock
      </span>
    </div>
  );
}

/** The roles matrix: 18px checkbox cells, Org admin fixed at .55, a lock switch per row. */
export function PermissionMatrix({ matrix }: { matrix: Matrix }) {
  const { roles, groups, canManage } = matrix;
  const grid = gridOf(roles);
  return (
    <Card>
      <div role="table" aria-label="Roles and permissions" className="overflow-x-auto">
        <Header roles={roles} grid={grid} />
        {groups.map((group) => (
          <div key={group.name} role="rowgroup">
            <div
              role="row"
              className="border-b border-br-row bg-bg2 px-4 py-2 text-12 font-semibold text-tx3"
            >
              <span role="rowheader">{group.name}</span>
            </div>
            {group.rows.map((row) => (
              <div
                key={row.name}
                role="row"
                style={grid}
                className="grid items-center border-b border-br-row px-4 py-2.25"
              >
                <div role="rowheader" className="flex flex-col gap-px">
                  <span className="font-medium">{row.label}</span>
                  {row.description && <span className="text-12 text-tx5">{row.description}</span>}
                </div>
                {roles.map((role) => (
                  <div key={role.id} role="cell" className="flex justify-center">
                    <Checkbox
                      size="md"
                      aria-label={`${row.label}: ${role.name}`}
                      checked={matrix.cell(row.name, role.id).allowed}
                      disabled={!canManage || matrix.isFixed(role)}
                      onChange={() => matrix.toggle(row.name, role.id)}
                    />
                  </div>
                ))}
                <div role="cell" className="flex justify-center">
                  <Switch
                    size="sm"
                    aria-label={`Lock ${row.label} at org level`}
                    checked={matrix.isLocked(row.name)}
                    disabled={!canManage}
                    onCheckedChange={() => matrix.toggleLock(row.name)}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
