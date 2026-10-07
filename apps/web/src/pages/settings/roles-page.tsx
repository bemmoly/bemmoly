import { Button } from '@bemmoly/ui';
import { useState } from 'react';
import { CreateRoleModal } from '../../components/people/create-role-modal.tsx';
import { PermissionMatrix } from '../../components/people/permission-matrix.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { NO_PEOPLE_ACCESS } from '../../hooks/use-people.ts';
import { useRolesMatrix } from '../../hooks/use-roles.ts';

export function RolesPage() {
  const matrix = useRolesMatrix();
  const [creating, setCreating] = useState(false);
  const locked = matrix.canManage ? undefined : NO_PEOPLE_ACCESS;
  return (
    <SettingsPage
      title="Roles and permissions"
      description="Org roles set the ceiling. Project admins can grant less than this to their members, never more. Rows you lock can't be changed at project level."
      loading={matrix.query.isPending}
      error={matrix.query.error}
      actions={
        <>
          <Button
            variant="secondary"
            disabled={!matrix.canManage}
            title={locked}
            onClick={() => setCreating(true)}
          >
            Create custom role
          </Button>
          <Button
            variant="primary"
            disabled={!matrix.dirty}
            title={locked}
            loading={matrix.save.isPending}
            onClick={matrix.submit}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="-mt-2">
        <PermissionMatrix matrix={matrix} />
      </div>
      <CreateRoleModal open={creating} onClose={() => setCreating(false)} roles={matrix.roles} />
    </SettingsPage>
  );
}
