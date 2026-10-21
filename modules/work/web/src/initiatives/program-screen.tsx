import { HeaderActions, useRecordRecent } from '@bemmoly/core-web';
import { Button, EmptyState, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { workPaths } from '../hooks/issue-navigation.ts';
import { useInitiative, useInitiativeActions } from '../hooks/initiatives.ts';
import { programSummary } from '../hooks/program-summary.ts';
import { RoadmapBody } from '../roadmap/roadmap-screen.tsx';
import { api } from '../shared/api.ts';
import { useIssuePeek } from '../shared/issue-peek.ts';
import { workKeys } from '../shared/keys.ts';
import { RoadmapSkeleton } from '../skeletons/roadmap-skeleton.tsx';
import { InitiativeDialog } from './initiative-dialog.tsx';
import { LinkEpicDialog } from './link-epic-dialog.tsx';
import { ProgramHeader } from './program-header.tsx';

/*
 * One initiative's program view at /work/initiatives/<id>: its rollup above the Roadmap's own
 * timeline, read with ?initiative=, so every epic across its teams sits on one axis with its
 * forecast and the dependencies between them, amber where their dates conflict.
 */

export default function ProgramScreen({ initiativeId }: { initiativeId: string }) {
  const initiative = useInitiative(initiativeId);
  const query = { initiative: initiativeId };
  const view = useQuery({
    queryKey: workKeys.roadmap(query),
    queryFn: ({ signal }) => api.work.roadmap.view(query, { signal }),
  });
  const actions = useInitiativeActions();
  const toast = useToast();
  const peek = useIssuePeek(() => []);
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const summary = useMemo(() => (view.data ? programSummary(view.data) : null), [view.data]);
  const data = initiative.data;
  useRecordRecent(
    data
      ? {
          id: `work.initiative:${data.id}`,
          title: data.name,
          context: 'Initiative',
          path: workPaths.initiatives(data.id),
          look: { kind: 'icon', icon: 'target', moduleId: 'work' },
          group: 'Initiatives',
        }
      : null,
  );

  if (initiative.isPending || view.isPending) return <RoadmapSkeleton />;
  if (!data || !view.data || !summary) {
    const failure = initiative.error ?? view.error;
    return (
      <EmptyState
        icon={<Icon name="alert" />}
        title="The initiative did not load"
        description={`${failure?.message.replace(/\.$/, '') ?? 'The server did not answer'}. Nothing was changed; try again.`}
        action={
          <Button
            onClick={() => {
              void initiative.refetch();
              void view.refetch();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }
  const archived = data.archivedAt !== null;
  const linked = new Set(view.data.items.map((item) => item.id));
  const unlink = (epicId: string) =>
    actions.unlink.mutate(
      { id: data.id, epicId },
      {
        onSuccess: () => toast.show({ tone: 'ok', title: `Unlinked from ${data.name}` }),
        onError: (failure) =>
          toast.show({
            tone: 'danger',
            title: "Couldn't unlink the epic",
            body: failure.message,
          }),
      },
    );
  const unarchive = () => actions.archive.mutate({ id: data.id, archived: false });

  return (
    <>
      {data.canManage && !archived && (
        <HeaderActions>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button
            variant="primary"
            icon={<Icon name="plus" size={14} />}
            onClick={() => setLinking(true)}
          >
            Link epic
          </Button>
        </HeaderActions>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <ProgramHeader
          initiative={data}
          view={view.data}
          summary={summary}
          onUnlink={unlink}
          onUnarchive={unarchive}
          onOpenIssue={peek.open}
        />
        {view.data.items.length === 0 ? (
          <EmptyState
            icon={<Icon name="target" />}
            title="No epics in this initiative yet"
            description="Link epics from any project; their issues, dates and dependencies show here."
            {...(data.canManage && !archived
              ? {
                  action: (
                    <Button variant="primary" onClick={() => setLinking(true)}>
                      Link epic
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <RoadmapBody view={view.data} oneProject={false} projectKey={undefined} heading={false} />
        )}
      </div>
      <InitiativeDialog open={editing} onClose={() => setEditing(false)} initiative={data} />
      <LinkEpicDialog
        initiative={data}
        linked={linked}
        open={linking}
        onClose={() => setLinking(false)}
      />
    </>
  );
}
