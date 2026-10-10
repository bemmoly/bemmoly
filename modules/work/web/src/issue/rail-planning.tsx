import type { IssueDetail } from '@bemmoly/module-work/shared';
import {
  Avatar,
  FieldSwatch,
  PropertyEmpty,
  PropertyGroup,
  PropertyRow,
  propertyValueClass,
  type SelectOption,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useWatchers } from '../hooks/issue-activity.ts';
import { linkTo, workPaths } from '../hooks/issue-navigation.ts';
import { usePeople, useViewer } from '../hooks/issue-people.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { useIssueTypes, useSprints, useVersions } from '../hooks/projects-catalog.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { cx } from './cx.ts';
import { epicSwatch } from './epic-color.ts';
import { ChoiceField, InlineValue } from './field-editors.tsx';
import { useWatchToggle } from './issue-header.tsx';
import { useIssueEdit } from './use-issue-edit.ts';
import { formatDay } from './vocabulary.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** The project's epics, for the Epic picker. */
function useEpics(issue: IssueDetail) {
  const types = useIssueTypes(projectKeyOf(issue.key));
  const epicType = types.types.find((type) => type.level === 'epic');
  return useQuery({
    queryKey: [...workKeys.all(), 'epics', issue.projectId, epicType?.id ?? ''],
    queryFn: async () =>
      (await api.work.issues.list({ projectId: issue.projectId, typeId: epicType?.id, limit: 100 }))
        .items,
    enabled: Boolean(epicType) && issue.type.level === 'standard',
    staleTime: 60_000,
  });
}

/** Planning: sprint, epic in its own colour, fix version and due date. */
export function RailPlanning({ issue }: { issue: IssueDetail }) {
  const projectKey = projectKeyOf(issue.key);
  const { edit } = useIssueEdit(issue.key);
  const sprints = useSprints(projectKey);
  const versions = useVersions(projectKey);
  const epics = useEpics(issue);
  const overdue = issue.dueAt && issue.dueAt < today() && issue.status.category !== 'done';
  const parentLabel = issue.type.level === 'subtask' ? 'Parent' : 'Epic';

  const epicOptions: SelectOption[] = (epics.data ?? []).map((epic) => ({
    value: epic.id,
    label: epic.title,
    icon: <FieldSwatch colorClassName={epicSwatch(epic.id)} />,
  }));
  if (issue.parent && !epicOptions.some((option) => option.value === issue.parent?.id)) {
    epicOptions.unshift({
      value: issue.parent.id,
      label: issue.parent.title,
      icon: <FieldSwatch colorClassName={epicSwatch(issue.parent.id)} />,
    });
  }

  return (
    <PropertyGroup title="Planning">
      <PropertyRow label="Sprint">
        <ChoiceField
          label="Sprint"
          value={issue.sprintId}
          placeholder="Add to sprint"
          clearLabel="Move to backlog"
          options={(sprints.data ?? [])
            .filter((sprint) => sprint.state !== 'closed' || sprint.id === issue.sprintId)
            .map((sprint) => ({
              value: sprint.id,
              label: sprint.name,
              icon: <Icon name="target" size={14} className="text-tx-3" />,
            }))}
          onSave={(sprintId) => {
            const sprint = sprints.data?.find((entry) => entry.id === sprintId);
            edit({
              body: { sprintId },
              shown: { sprint: sprint ? { id: sprint.id, name: sprint.name, state: sprint.state } : null },
              what: 'The sprint',
            });
          }}
        />
      </PropertyRow>
      <PropertyRow label={parentLabel}>
        {issue.type.level === 'standard' && epics.isSuccess ? (
          <ChoiceField
            label="Epic"
            value={issue.parentId}
            placeholder="Add epic"
            clearLabel="Remove from epic"
            options={epicOptions}
            onSave={(parentId) => {
              const epic = epics.data.find((entry) => entry.id === parentId);
              edit({
                body: { parentId },
                shown: {
                  parent: epic
                    ? { id: epic.id, key: epic.key, title: epic.title, statusId: epic.statusId, typeId: epic.typeId }
                    : null,
                },
                what: 'The epic',
              });
            }}
          />
        ) : issue.parent ? (
          <a {...linkTo(workPaths.issue(issue.parent.key))} className={cx(propertyValueClass, 'no-underline')}>
            <FieldSwatch colorClassName={epicSwatch(issue.parent.id)} />
            <span className="truncate">{issue.parent.title}</span>
          </a>
        ) : (
          <PropertyEmpty>No {parentLabel.toLowerCase()}</PropertyEmpty>
        )}
      </PropertyRow>
      <PropertyRow label="Fix version">
        <ChoiceField
          label="Fix version"
          value={issue.fixVersionId}
          placeholder="Add version"
          clearLabel="Clear"
          options={(versions.data ?? [])
            .filter((version) => version.status === 'unreleased' || version.id === issue.fixVersionId)
            .map((version) => ({ value: version.id, label: version.name }))}
          onSave={(fixVersionId) => {
            const version = versions.data?.find((entry) => entry.id === fixVersionId);
            edit({
              body: { fixVersionId },
              shown: { fixVersion: version ? { id: version.id, name: version.name } : null },
              what: 'The fix version',
            });
          }}
        />
      </PropertyRow>
      <PropertyRow label="Due date">
        <InlineValue
          label="Due date"
          type="date"
          placeholder="Add date"
          value={issue.dueAt ?? ''}
          display={
            issue.dueAt ? (
              <span className={cx(overdue && 'text-amber-tx')}>
                {formatDay(issue.dueAt)}
                {overdue ? ' · overdue' : ''}
              </span>
            ) : null
          }
          onSave={(next) => edit({ body: { dueAt: next || null }, what: 'The due date' })}
        />
      </PropertyRow>
    </PropertyGroup>
  );
}

/** People: who reported it, and who watches it, with Watch for the viewer. */
export function RailPeople({ issue }: { issue: IssueDetail }) {
  const watchers = useWatchers(issue.key);
  const { person } = usePeople();
  const viewer = useViewer();
  const toggle = useWatchToggle(issue);
  const others = (watchers.data ?? []).filter((row) => row.userId !== viewer?.id);
  const summary = issue.watching
    ? others.length === 0
      ? 'Only you'
      : `You and ${issue.watchersCount - 1} more`
    : issue.watchersCount === 0
      ? 'Nobody yet'
      : `${issue.watchersCount} watching`;

  return (
    <PropertyGroup title="People">
      <PropertyRow label="Reporter">
        {issue.reporter ? (
          <span className="inline-flex min-w-0 items-center gap-1.75 text-13 text-tx">
            <Avatar name={issue.reporter.name} size={20} />
            <span className="truncate">{issue.reporter.name}</span>
          </span>
        ) : (
          <PropertyEmpty>Unknown</PropertyEmpty>
        )}
      </PropertyRow>
      <PropertyRow label="Watchers">
        <button
          type="button"
          aria-pressed={issue.watching}
          aria-label={`${summary}. ${issue.watching ? 'Stop watching' : 'Watch'}`}
          onClick={() => toggle(!issue.watching)}
          className={propertyValueClass}
        >
          <span className="flex -space-x-1">
            {(watchers.data ?? []).slice(0, 3).map((row) => (
              <Avatar key={row.userId} name={person(row.userId).name} size={18} className="ring-2 ring-canvas" />
            ))}
          </span>
          <span className="truncate text-tx-3">{summary}</span>
        </button>
      </PropertyRow>
    </PropertyGroup>
  );
}
