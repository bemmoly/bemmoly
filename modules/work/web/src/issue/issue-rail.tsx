import type { IssueDetail } from '@bemmoly/module-work/shared';
import { formatAbsolute, RelativeTime } from '@bemmoly/ui';
import { RailPeople, RailPlanning } from './rail-planning.tsx';
import { RailProperties } from './rail-properties.tsx';
import { StatusMenu } from './status-menu.tsx';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });

/**
 * The issue's right rail: status first with its next transitions, then the properties in
 * three groups, then when it was made and last changed.
 */
export function IssueRail({ issue }: { issue: IssueDetail }) {
  return (
    <div className="flex flex-col">
      <div className="pb-3.5">
        <StatusMenu issue={issue} />
      </div>
      <RailProperties issue={issue} />
      <RailPlanning issue={issue} />
      <RailPeople issue={issue} />
      <p className="m-0 border-t border-line pt-3 text-12 text-tx-3">
        Created{' '}
        <time dateTime={issue.createdAt} title={formatAbsolute(issue.createdAt)}>
          {day(issue.createdAt)}
        </time>{' '}
        · Updated <RelativeTime iso={issue.updatedAt} />
      </p>
    </div>
  );
}
