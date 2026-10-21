import { HeaderActions } from '@bemmoly/core-web';
import type { Role } from '@bemmoly/shared';
import { Button, Card, Checkbox, EmptyState, PageTitle, Skeleton } from '@bemmoly/ui';
import type { CSSProperties } from 'react';
import { useActionMatrix, type ActionMatrix } from './use-action-matrix.ts';

const ACTION_MIN = 220;
const ROLE_COLUMN = 110;
/** px-4 on both sides of every row. */
const ROW_PADDING = 32;

function gridOf(roles: readonly Role[]): CSSProperties {
  const columns = roles.map(() => `${ROLE_COLUMN}px`).join(' ');
  return { gridTemplateColumns: `minmax(${ACTION_MIN}px,1fr) ${columns}` };
}

function Matrix({ matrix }: { matrix: ActionMatrix }) {
  const { roles, groups } = matrix;
  const grid = gridOf(roles);
  return (
    <Card className="overflow-x-auto p-0">
      <div
        role="table"
        aria-label="Work actions by role"
        style={{ minWidth: ACTION_MIN + roles.length * ROLE_COLUMN + ROW_PADDING }}
      >
        <div
          role="row"
          style={grid}
          className="grid items-end border-b border-line bg-sunken px-4 py-2.5 text-12 text-tx-3"
        >
          <span role="columnheader">Action</span>
          {roles.map((role) => (
            <span
              key={role.id}
              role="columnheader"
              className={role.isSystem ? 'text-center' : 'text-center text-acc'}
            >
              {role.name}
              {!role.isSystem && <span className="block font-normal">custom</span>}
            </span>
          ))}
        </div>
        {groups.map((group) => (
          <div key={group.area} role="rowgroup">
            <div
              role="row"
              className="border-b border-line-2 bg-side px-4 py-2 text-12 font-semibold text-tx-2"
            >
              <span role="rowheader">{group.area}</span>
            </div>
            {group.rows.map((row) => (
              <div
                key={row.name}
                role="row"
                style={grid}
                className="grid items-center border-b border-line-2 px-4 py-2.25"
              >
                <div role="rowheader" className="flex flex-col gap-px">
                  <span className="font-medium">{row.label}</span>
                  {row.description && <span className="text-12 text-tx-3">{row.description}</span>}
                </div>
                {roles.map((role) => (
                  <div key={role.id} role="cell" className="flex justify-center">
                    <Checkbox
                      size="md"
                      aria-label={`${row.label}: ${role.name}`}
                      checked={matrix.allowed(row.name, role.id)}
                      disabled={matrix.isFixed(role) || matrix.save.isPending}
                      onChange={() => matrix.toggle(row.name, role)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Settings › Work › Permissions: which role may take which Work action, such as only the
 * Scrum Master starting a sprint. The cells are the workspace roles matrix's own, so a project
 * role can still narrow them inside one project, and Org admin always holds every action.
 */
export function PermissionsPage() {
  const matrix = useActionMatrix();
  return (
    <div className="flex flex-col gap-6">
      <HeaderActions>
        <Button disabled={!matrix.dirty || matrix.save.isPending} onClick={matrix.discard}>
          Discard
        </Button>
        <Button
          variant="primary"
          disabled={!matrix.dirty}
          loading={matrix.save.isPending}
          onClick={matrix.submit}
        >
          Save
        </Button>
      </HeaderActions>
      <PageTitle
        variant="settings"
        title="Permissions"
        description="Grant or deny each Work action per role. Inside a project, a person's project role decides."
      />
      {matrix.query.isPending && (
        <div aria-label="Loading permissions" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      )}
      {matrix.query.error && (
        <EmptyState
          title="Permissions did not load"
          description={matrix.query.error.message}
          action={<Button onClick={() => void matrix.query.refetch()}>Try again</Button>}
        />
      )}
      {matrix.query.data && <Matrix matrix={matrix} />}
    </div>
  );
}
