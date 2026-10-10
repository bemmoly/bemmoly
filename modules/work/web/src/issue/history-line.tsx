import type { IssueHistoryEntry } from '@bemmoly/module-work/shared';
import { StatusGlyph, statusStage } from '@bemmoly/ui';
import type { IssueVocabulary } from '../hooks/issue-vocabulary.ts';
import { historyVerb, type HistoryNames } from './activity-feed.ts';

function StatusName({ id, vocabulary }: { id: unknown; vocabulary: IssueVocabulary }) {
  const status = typeof id === 'string' ? vocabulary.status(id) : undefined;
  if (!status) return <span className="text-tx">another status</span>;
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap text-tx">
      <StatusGlyph
        stage={statusStage(status.category, status.name)}
        size={12}
        decorative
        className="relative top-px self-center"
      />
      {status.name}
    </span>
  );
}

/**
 * A history entry as the line reads: a status change draws both statuses with their glyphs,
 * "moved from (o) To do to (o) In progress"; every other change is its verb.
 */
export function HistoryLine({
  entry,
  vocabulary,
  names,
}: {
  entry: IssueHistoryEntry;
  vocabulary: IssueVocabulary;
  names: HistoryNames;
}) {
  if (entry.field === 'statusId') {
    return (
      <>
        moved from <StatusName id={entry.from} vocabulary={vocabulary} /> to{' '}
        <StatusName id={entry.to} vocabulary={vocabulary} />
      </>
    );
  }
  return <>{historyVerb(entry, names)}</>;
}
