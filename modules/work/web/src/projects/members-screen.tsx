import type { ProjectMember } from '@bemmoly/module-work/shared';
import { HeaderActions } from '@bemmoly/core-web';
import {
  Button,
  ConfirmChange,
  EmptyState,
  PageTitle,
  SearchInput,
  SegmentedControl,
  useToast,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useViewer } from '../hooks/issue-people.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { LineSkeleton } from '../skeletons/parts.tsx';
import { useProject } from '../shared/use-project.ts';
import { useWorkRealtime } from '../shared/use-work-realtime.ts';
import { MembersAddDialog } from './members-add-dialog.tsx';
import {
  type MemberSegment,
  roleOptions,
  useMemberFilter,
  usePeopleToAdd,
  useProjectMembers,
} from './members-hooks.ts';
import { MembersTable } from './members-table.tsx';

const segmentLabel = (label: string, n: number) => (
  <span className="tabular-nums">
    {label}
    {n > 0 && <span className="text-tx-3"> · {n}</span>}
  </span>
);

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
  const alone =
    members.list.isSuccess &&
    count === 1 &&
    members.members[0]?.userId === viewer?.id &&
    filter.query.trim() === '';
  const failed = (error: Error | null) => error?.message ?? null;

  return (
    <>
      <HeaderActions>
        <Button
          variant="primary"
          icon={<Icon name="plus" size={14} />}
          disabled={!members.canManage}
          title={members.canManage ? undefined : NO_ACCESS}
          onClick={() => setAdding(true)}
        >
          Add people
        </Button>
      </HeaderActions>
      <div className="flex flex-col gap-4">
        <PageTitle
          title="Members"
          meta={
            members.list.isSuccess
              ? [`${count} ${count === 1 ? 'person' : 'people'}`]
              : [<LineSkeleton key="count" width={52} size="text-13" bar={8} />]
          }
          description={`Everyone here can open ${name || 'the project'}. Their project role decides what they can change.`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            aria-label="Search members by name or email"
            placeholder="Search members…"
            wrapperClassName="w-full sm:w-65"
            value={filter.query}
            onChange={(event) => filter.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && filter.query) {
                event.stopPropagation();
                filter.setQuery('');
              }
            }}
          />
          <SegmentedControl<MemberSegment>
            size="sm"
            aria-label="Show"
            value={filter.segment}
            onChange={filter.setSegment}
            options={[
              { value: 'all', label: segmentLabel('All', filter.counts.all) },
              { value: 'admins', label: segmentLabel('Admins', filter.counts.admins) },
              { value: 'invited', label: segmentLabel('Invited', filter.counts.invited) },
            ]}
          />
        </div>
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
            filtered={filter.filtered}
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
        {alone && (
          <EmptyState
            icon={<Icon name="people" />}
            title="Only you so far"
            description="Add people or a whole team so they can see the project and work on its issues."
            {...(members.canManage
              ? { action: <Button onClick={() => setAdding(true)}>Add people</Button> }
              : {})}
            className="py-8"
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
    </>
  );
}
