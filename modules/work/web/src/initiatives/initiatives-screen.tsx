import type { Initiative } from '@bemmoly/module-work/shared';
import { HeaderActions } from '@bemmoly/core-web';
import { Button, EmptyState, SegmentedControl, TableSkeleton, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { useInitiativeActions, useInitiativeList } from '../hooks/initiatives.ts';
import { useSettingsAccess } from '../hooks/settings-access.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { InitiativeDialog } from './initiative-dialog.tsx';
import { InitiativeRowMenu } from './initiative-row-menu.tsx';
import { INITIATIVE_TRACKS, InitiativesTable } from './initiatives-table.tsx';
import ProgramScreen from './program-screen.tsx';

/*
 * Initiatives at /work/initiatives (docs/design/premium/interaction/initiatives.md): programs
 * of epics across projects, each with its rolled-up progress. A row opens its program view,
 * /work/initiatives/<id>, which this file hands to ProgramScreen.
 */

type Show = 'live' | 'archived';

const SKELETON = Object.values(INITIATIVE_TRACKS).map((width) => ({ width }));

function InitiativesList() {
  const [show, setShow] = useState<Show>('live');
  const [editing, setEditing] = useState<Initiative | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useInitiativeList(show === 'archived');
  const { archive } = useInitiativeActions();
  const toast = useToast();
  const access = useSettingsAccess();
  const rows = list.data?.items ?? [];
  const canManage = rows[0]?.canManage ?? access.manageInitiatives;
  const open = (initiative: Initiative) => navigateTo(workPaths.initiatives(initiative.id));
  const toggleArchive = (initiative: Initiative) => {
    const archived = initiative.archivedAt === null;
    archive.mutate(
      { id: initiative.id, archived },
      {
        onSuccess: () =>
          toast.show({
            tone: 'ok',
            title: `${archived ? 'Archived' : 'Unarchived'} ${initiative.name}`,
          }),
        onError: (failure) =>
          toast.show({
            tone: 'danger',
            title: `Couldn't change ${initiative.name}`,
            body: failure.message,
          }),
      },
    );
  };
  const empty =
    show === 'archived' ? (
      <EmptyState
        icon={<Icon name="archive" />}
        title="Nothing archived"
        description="Archived initiatives keep their epics and can be restored here."
      />
    ) : (
      <EmptyState
        icon={<Icon name="target" />}
        title="No initiatives yet"
        description="An initiative gathers epics from several projects and teams onto one timeline, with its progress, dependencies and risks."
        {...(canManage
          ? {
              action: (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  New initiative
                </Button>
              ),
            }
          : {})}
      />
    );
  return (
    <>
      {canManage && (
        <HeaderActions>
          <Button
            variant="primary"
            icon={<Icon name="plus" size={14} />}
            onClick={() => setCreating(true)}
          >
            New initiative
          </Button>
        </HeaderActions>
      )}
      <div className="flex flex-col gap-4">
        <h1 className="sr-only">Initiatives</h1>
        <div className="flex items-center gap-2">
          <SegmentedControl<Show>
            size="sm"
            aria-label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
        {list.isPending ? (
          <TableSkeleton label="Loading initiatives" rows={3} columns={SKELETON} />
        ) : list.isError ? (
          <EmptyState
            icon={<Icon name="alert" />}
            title="Initiatives could not be loaded"
            description={`${list.error.message} Check your connection, then try again.`}
            action={<Button onClick={() => void list.refetch()}>Retry</Button>}
          />
        ) : (
          <InitiativesTable
            rows={rows}
            onOpen={open}
            empty={empty}
            menu={(initiative) => (
              <InitiativeRowMenu
                initiative={initiative}
                onOpen={() => open(initiative)}
                onEdit={() => setEditing(initiative)}
                onArchive={() => toggleArchive(initiative)}
              />
            )}
          />
        )}
      </div>
      <InitiativeDialog open={creating} onClose={() => setCreating(false)} />
      <InitiativeDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        initiative={editing ?? undefined}
      />
    </>
  );
}

export default function InitiativesScreen({ projectKey: id }: WorkScreenProps) {
  return id ? <ProgramScreen initiativeId={id} /> : <InitiativesList />;
}
