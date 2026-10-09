import type { Comment, IssueDetail } from '@bemmoly/module-work/shared';
import { formatRelative } from '@bemmoly/core-web';
import { ActivityItem, SectionHeading, SegmentedControl, Skeleton } from '@bemmoly/ui';
import { useMemo, useState } from 'react';
import {
  useAddComment,
  useComments,
  useEditComment,
  useHistory,
  useReact,
  useWorkLogs,
} from '../hooks/issue-activity.ts';
import { usePeople, useViewer } from '../hooks/issue-people.ts';
import type { IssueVocabulary } from '../hooks/issue-vocabulary.ts';
import { buildActivity, historyVerb, workVerb, type ActivityFilter } from './activity-feed.ts';
import { CommentBox } from './comment-box.tsx';
import { CommentItem } from './comment-item.tsx';
import { LogWorkForm } from './log-work-form.tsx';

const TABS: ReadonlyArray<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'comments', label: 'Comments' },
  { value: 'history', label: 'History' },
  { value: 'work', label: 'Work log' },
];

export interface ActivitySectionProps {
  issue: IssueDetail;
  vocabulary: IssueVocabulary;
  size: 'page' | 'panel';
  onCreateIssue?: (comment: Comment) => void;
}

/** Activity: the tabs, the composer and the merged feed, newest first. */
export function ActivitySection({ issue, vocabulary, size, onCreateIssue }: ActivitySectionProps) {
  const [filter, setFilter] = useState<ActivityFilter>(size === 'page' ? 'all' : 'comments');
  const comments = useComments(issue.key);
  const history = useHistory(issue.key);
  const logs = useWorkLogs(issue.key);
  const add = useAddComment(issue.key);
  const edit = useEditComment(issue.key);
  const react = useReact(issue.key);
  const viewer = useViewer();
  const { person } = usePeople();

  const entries = useMemo(
    () => buildActivity(filter, comments.data ?? [], history.data ?? [], logs.data ?? []),
    [filter, comments.data, history.data, logs.data],
  );
  const loading = comments.isPending || history.isPending || logs.isPending;
  const names = {
    status: (id: string) => vocabulary.status(id)?.name,
    person: (id: string) => person(id).name,
  };
  const me = viewer ?? { id: '', name: 'You', email: '' };
  const tabs = size === 'page' ? TABS : TABS.slice(1);

  return (
    <section className="flex flex-col gap-3" aria-label="Activity">
      <SectionHeading
        title="Activity"
        size={size}
        actions={
          <SegmentedControl
            size="sm"
            aria-label="Show in activity"
            value={filter}
            onChange={setFilter}
            options={tabs}
          />
        }
      />
      {filter === 'work' ? (
        <LogWorkForm issueKey={issue.key} />
      ) : (
        filter !== 'history' && (
          <CommentBox
            viewer={me}
            shortcut={size === 'page'}
            onSubmit={(body) => add.mutateAsync({ body })}
          />
        )
      )}
      {loading && <Skeleton shape="block" height={56} />}
      {!loading && entries.length === 0 && (
        <p className="m-0 text-12h text-tx5">
          {filter === 'work' ? 'No time logged yet.' : 'Nothing here yet.'}
        </p>
      )}
      {entries.map((entry) => {
        if (entry.kind === 'comment') {
          return (
            <CommentItem
              key={entry.id}
              comment={entry.comment}
              replies={entry.replies}
              size={size}
              viewer={me}
              person={(id) => person(id)}
              onReact={(comment, reaction, on) => react.mutate({ id: comment.id, reaction, on })}
              onReply={(parent, body) => add.mutateAsync({ body, parentId: parent.id })}
              onEdit={(comment, body) => edit.mutateAsync({ id: comment.id, body })}
              {...(onCreateIssue ? { onCreateIssue } : {})}
            />
          );
        }
        const who = entry.kind === 'history' ? entry.entry.actorId : entry.log.userId;
        return (
          <ActivityItem
            key={entry.id}
            size={size}
            person={{ name: person(who).name }}
            verb={entry.kind === 'history' ? historyVerb(entry.entry, names) : workVerb(entry.log)}
            when={formatRelative(entry.at)}
          >
            {entry.kind === 'work' && entry.log.note ? entry.log.note : undefined}
          </ActivityItem>
        );
      })}
    </section>
  );
}
