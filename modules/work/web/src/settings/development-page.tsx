import type { CodeTransitions } from '@bemmoly/module-work/shared';
import { Card, PageTitle, Select, Skeleton, useToast } from '@bemmoly/ui';
import { useCodeTransitions } from '../hooks/code-links.ts';
import { useCreateStatuses } from '../hooks/create-options.ts';
import { NO_PROJECT_PERMISSION, useSettingsAccess } from '../hooks/settings-access.ts';
import { useProject } from '../shared/index.ts';

const LEAVE = 'leave';

const MOVES: ReadonlyArray<{ field: keyof CodeTransitions; label: string; hint: string }> = [
  {
    field: 'pullRequestOpened',
    label: 'When a pull request opens',
    hint: 'Opened, reopened or marked ready for review. Drafts move nothing.',
  },
  {
    field: 'pullRequestMerged',
    label: 'When a pull request merges',
    hint: 'The first merge of a linked pull or merge request.',
  },
];

/**
 * Project settings › Development: where an issue moves when a pull request that names its key
 * opens or merges. Each choice saves on its own. Moves follow the workflow; one it does not
 * allow from the issue's status is skipped and noted in the code host's delivery log.
 */
export function DevelopmentPage({ projectKey }: { projectKey: string | undefined }) {
  const { project } = useProject(projectKey);
  const access = useSettingsAccess();
  const { statuses } = useCreateStatuses(project?.id);
  const { query, save } = useCodeTransitions(project?.key);
  const toast = useToast();
  const options = [
    { value: LEAVE, label: 'Leave the status as it is' },
    ...statuses.map((status) => ({ value: status.id, label: `Move to ${status.name}` })),
  ];
  const locked = access.configureProject ? undefined : NO_PROJECT_PERMISSION;

  const choose = (field: keyof CodeTransitions, value: string) =>
    save.mutate(
      { [field]: value === LEAVE ? null : value },
      {
        onSuccess: () => toast.show({ title: 'Saved' }),
        onError: (error) =>
          toast.show({ tone: 'danger', title: 'The move was not saved', body: error.message }),
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        variant="settings"
        title="Development"
        description="Pull requests, branches and commits link to an issue when they name its key. Choose whether linked work moves the issue."
      />
      <Card className="flex flex-col divide-y divide-line-2 p-0">
        {MOVES.map((move) => (
          <div
            key={move.field}
            className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span id={`move-${move.field}`} className="text-13 font-medium text-tx">
                {move.label}
              </span>
              <span className="text-12 text-tx-3">{move.hint}</span>
            </div>
            {query.isPending ? (
              <Skeleton width={220} height={32} shape="block" />
            ) : (
              <Select
                aria-labelledby={`move-${move.field}`}
                className="w-full sm:w-60"
                value={query.data?.[move.field] ?? LEAVE}
                options={options}
                disabled={Boolean(locked) || query.isError}
                {...(locked ? { title: locked } : {})}
                onChange={(event) => choose(move.field, event.value)}
              />
            )}
          </div>
        ))}
      </Card>
      {query.isError && (
        <p className="m-0 text-13 text-red-tx">
          The project's moves did not load. Reload the page to try again.
        </p>
      )}
    </div>
  );
}
