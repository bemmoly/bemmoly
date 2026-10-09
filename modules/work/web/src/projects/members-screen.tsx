import type { ProjectMember } from '@bemmoly/module-work/shared';
import { Button, ConfirmChange, EmptyState, PageHeader, SearchInput, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useViewer } from '../hooks/issue-people.ts';
import { linkTo, workPaths } from '../hooks/issue-navigation.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/use-project.ts';
import { useWorkRealtime } from '../shared/use-work-realtime.ts';
import { MembersAddDialog } from './members-add-dialog.tsx';
import {
  roleOptions,
  useMemberFilter,
  usePeopleToAdd,
  useProjectMembers,
} from './members-hooks.ts';
import { MembersTable } from './members-table.tsx';

/** A breadcrumb that moves the shell without a reload, as the other Work screens link. */
const crumb = (label: string, path: string) => {
  const { href, onClick } = linkTo(path);
  return { label, href, linkProps: { onClick } };
};

const NO_ACCESS = 'You need "Configure project" here to change its members.';

/**
 * Project members at /work/members/PLT: who can open the project and the role
 * each holds in it, laid out as the People mock's user grid. Removing someone
 * is read back first, since they lose the project's issues at once.
 */
export default function MembersScreen({ projectKey }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  const members = useProjectMembers(project?.key);
  const filter = useMemberFilter(members.members);
  const loadPeople = usePeopleToAdd(members.members);
  const viewer = useViewer();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  useWorkRealtime(project?.id);

  if (!isPending && !project) {
    return (
      <EmptyState
        title="Project not found"
        description="It may have been deleted, or you are not a member of it."
      />
    );
  }
  const name = project?.name ?? '';
  const count = members.members.length;
  const failed = (error: Error | null) => error?.message ?? null;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-310 flex-col gap-4 px-10 pt-5 pb-15">
        <PageHeader
          breadcrumbs={[
            crumb('Projects', workPaths.projects()),
            ...(project ? [crumb(name, workPaths.board(project.key))] : []),
            { label: 'Members' },
          ]}
          title="Members"
          meta={members.list.isSuccess ? [`${count} ${count === 1 ? 'person' : 'people'}`] : []}
          description="Everyone here can open the project. Their project role decides what they can do in it."
          actions={
            <Button
              variant="primary"
              disabled={!members.canManage}
              title={members.canManage ? undefined : NO_ACCESS}
              onClick={() => setAdding(true)}
            >
              Add people
            </Button>
          }
        />
        <SearchInput
          aria-label="Search members by name or email"
          placeholder="Search by name or email"
          wrapperClassName="w-65"
          value={filter.query}
          onChange={(event) => filter.setQuery(event.target.value)}
        />
        {members.list.isError ? (
          <EmptyState
            title="Members could not be loaded"
            description={members.list.error.message}
          />
        ) : (
          <MembersTable
            rows={filter.rows}
            roleOptions={roleOptions(members.roles)}
            canManage={members.canManage}
            loading={members.list.isPending}
            filtered={filter.query.trim() !== ''}
            viewerId={viewer?.id ?? null}
            isLastAdmin={members.isLastAdmin}
            onRoleChange={(member, roleId) =>
              members.setRole.mutate(
                { userId: member.userId, roleId },
                {
                  onError: (error) =>
                    toast.show({ tone: 'danger', title: 'Role not changed', body: error.message }),
                },
              )
            }
            onRemove={setRemoving}
          />
        )}
      </div>
      <MembersAddDialog
        open={adding}
        projectName={name}
        roleOptions={roleOptions(members.roles)}
        loadPeople={loadPeople}
        busy={members.add.isPending}
        error={failed(members.add.error)}
        onClose={() => {
          members.add.reset();
          setAdding(false);
        }}
        onAdd={(body) =>
          members.add.mutate(body, {
            onSuccess: (added) => {
              setAdding(false);
              toast.show({
                tone: 'ok',
                title:
                  added.length === 0
                    ? 'Everyone picked is already a member'
                    : `Added ${added.length} ${added.length === 1 ? 'person' : 'people'}`,
              });
            },
          })
        }
      />
      <ConfirmChange
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''} from ${name}?`}
        description={removing?.email}
        consequences={[
          `${removing?.userId === viewer?.id ? 'You lose' : 'They lose'} access to ${project?.key ?? 'the project'}'s issues, board and backlog at once.`,
          'Issues they reported or are assigned keep their name.',
          'You can add them again at any time.',
        ]}
        confirmLabel="Remove from project"
        tone="danger"
        busy={members.remove.isPending}
        error={failed(members.remove.error)}
        onCancel={() => {
          members.remove.reset();
          setRemoving(null);
        }}
        onConfirm={() =>
          removing &&
          members.remove.mutate(removing, {
            onSuccess: () => setRemoving(null),
          })
        }
      />
    </div>
  );
}
