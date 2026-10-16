import type { SprintReportIssue, SprintScope } from '@bemmoly/module-work/shared';
import { useId } from 'react';
import { points } from './model.ts';

const SECTIONS: { id: keyof SprintScope; title: string; empty: string }[] = [
  { id: 'completed', title: 'Completed', empty: 'Nothing was finished.' },
  { id: 'notCompleted', title: 'Not completed', empty: 'Everything was finished.' },
  { id: 'added', title: 'Added after the start', empty: 'No issues joined after the start.' },
  { id: 'removed', title: 'Removed', empty: 'No issues left the sprint.' },
];

const total = (issues: readonly SprintReportIssue[]) =>
  Math.round(issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) * 100) / 100;

function IssueList({
  title,
  issues,
  empty,
  onOpen,
}: {
  title: string;
  issues: readonly SprintReportIssue[];
  empty: string;
  onOpen: (key: string) => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h3 id={id} className="m-0 mb-1 flex items-baseline gap-2 text-13 font-semibold text-tx">
        {title}
        <span className="text-12 font-normal text-tx-3">
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'}, {total(issues)} pts
        </span>
      </h3>
      {issues.length === 0 ? (
        <p className="m-0 px-2 py-1.5 text-13 text-tx-3">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {issues.map((issue) => (
            <li key={issue.issueId}>
              <button
                type="button"
                onClick={() => onOpen(issue.key)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-2 py-1.5 text-left text-13 text-tx hover:bg-hover focus-ring"
              >
                <span className="shrink-0 font-mono text-12 text-tx-2">{issue.key}</span>
                <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                <span className="shrink-0 text-12 text-tx-3">{points(issue.estimate)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The sprint report's lists: what was done, what was not, and how the scope moved. */
export function SprintIssues({
  scope,
  onOpen,
}: {
  scope: SprintScope;
  onOpen: (key: string) => void;
}) {
  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      {SECTIONS.map((section) => (
        <IssueList
          key={section.id}
          title={section.title}
          issues={scope[section.id]}
          empty={section.empty}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
