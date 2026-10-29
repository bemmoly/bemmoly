import { useT } from '@bemmoly/core-web';
import type { JourneyTask } from '../../../shared/index.ts';
import { addDays } from '../../../shared/index.ts';
import {
  Avatar,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ProgressBar,
  Select,
  SkeletonCard,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { useDateText } from '../shared/format.ts';
import { peopleKeys } from '../shared/keys.ts';
import { PeopleLayout } from '../shared/layout.tsx';
import { peoplePaths } from '../shared/paths.ts';
import { useDirectory, usePeopleById, useSession } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';

type Phase = 'before' | 'day' | 'week' | 'later';
const PHASES: readonly Phase[] = ['before', 'day', 'week', 'later'];

const phaseOf = (task: JourneyTask, anchor: string): Phase =>
  task.dueDate < anchor
    ? 'before'
    : task.dueDate === anchor
      ? 'day'
      : task.dueDate <= addDays(anchor, 7)
        ? 'week'
        : 'later';

/** One journey: its tasks in phases around the date, each with its owner and a tick. */
export function JourneyDetail({ id }: { id: string }) {
  const t = useT(peopleText);
  const date = useDateText();
  const client = useQueryClient();
  const people = usePeopleById();
  const everyone = useDirectory();
  const { userId, can } = useSession();
  const manager = can('people.journeys.manage');
  const journey = useQuery({
    queryKey: peopleKeys.journey(id),
    queryFn: () => api.people.journeys.get(id),
    retry: false,
  });
  const update = useMutation({
    mutationFn: ({
      taskId,
      body,
    }: {
      taskId: string;
      body: { done?: boolean; ownerId?: string };
    }) => api.people.journeys.updateTask(taskId, body),
    onSuccess: async (detail) => {
      client.setQueryData(peopleKeys.journey(id), detail);
      await client.invalidateQueries({ queryKey: peopleKeys.myTasks() });
    },
  });
  const list = { label: t('people.nav.journeys'), path: peoplePaths.journeys() };

  if (journey.isPending) {
    return (
      <PeopleLayout trail={[list]}>
        <SkeletonCard />
      </PeopleLayout>
    );
  }
  if (journey.isError) {
    const status = (journey.error as { status?: number }).status;
    return (
      <PeopleLayout trail={[list]}>
        {status === 404 || status === 403 ? (
          <EmptyState
            headingLevel={1}
            icon={<Icon name="checklist" />}
            title={t('people.journeys.notFoundTitle')}
            description={t('people.journeys.notFoundBody')}
          />
        ) : (
          <LoadError onRetry={() => void journey.refetch()} />
        )}
      </PeopleLayout>
    );
  }
  const data = journey.data;
  const person = people.name(data.userId) ?? t('people.someone');
  const progress = t('people.journeys.progress', { done: data.doneCount, total: data.taskCount });
  return (
    <PeopleLayout trail={[list, { label: person, path: peoplePaths.journey(id) }]}>
      <div className="flex flex-wrap items-center gap-3.5">
        <Avatar name={person} size={40} />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 truncate text-20 font-semibold text-tx">{person}</h1>
          <span className="text-13 text-tx-2">
            {t(`people.journeys.${data.kind}`)} · {data.templateName} ·{' '}
            {t(
              data.kind === 'onboarding' ? 'people.journeys.startsOn' : 'people.journeys.lastDay',
              {
                date: date(data.anchorDate),
              },
            )}
          </span>
        </div>
        <span className="ms-auto flex w-48 flex-col gap-1">
          <ProgressBar
            label={progress}
            value={data.taskCount ? (data.doneCount / data.taskCount) * 100 : 0}
          />
          <span className="text-12 text-tx-3 tabular-nums">{progress}</span>
        </span>
      </div>
      {PHASES.map((phase) => {
        const tasks = data.tasks.filter((task) => phaseOf(task, data.anchorDate) === phase);
        if (tasks.length === 0) return null;
        return (
          <Card key={phase} className="overflow-hidden">
            <CardHeader title={t(`people.journeys.phase.${phase}`)} />
            {tasks.map((task) => {
              const mine = task.ownerId === userId;
              const owner = people.name(task.ownerId);
              return (
                <div
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line-2 px-3.5 py-2.5 last:border-b-0"
                >
                  <Checkbox
                    aria-label={t('people.journeys.taskDone', { title: task.title })}
                    checked={task.doneAt !== null}
                    disabled={!(mine || manager) || update.isPending}
                    onChange={(event) =>
                      update.mutate({ taskId: task.id, body: { done: event.target.checked } })
                    }
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-13 ${task.doneAt ? 'text-tx-3 line-through' : 'text-tx'}`}
                  >
                    {task.title}
                  </span>
                  {manager ? (
                    <Select
                      size="sm"
                      variant="ghost"
                      searchable
                      aria-label={t('people.journeys.handTo')}
                      value={task.ownerId ?? ''}
                      placeholder={t('people.journeys.noOwner')}
                      onChange={(event) =>
                        update.mutate({ taskId: task.id, body: { ownerId: event.value } })
                      }
                      options={(everyone.data ?? []).map((p) => ({
                        value: p.userId,
                        label: p.name,
                      }))}
                    />
                  ) : (
                    <span className="flex items-center gap-1.5 text-13 text-tx-2">
                      {owner ? <Avatar name={owner} size={18} /> : null}
                      {owner ?? t('people.journeys.noOwner')}
                    </span>
                  )}
                  <span className="w-24 shrink-0 text-end text-12 text-tx-3 tabular-nums">
                    {t('people.journeys.due', { date: date(task.dueDate) })}
                  </span>
                </div>
              );
            })}
          </Card>
        );
      })}
    </PeopleLayout>
  );
}
