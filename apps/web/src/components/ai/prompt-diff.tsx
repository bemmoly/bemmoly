import type { AiPromptDiffLine } from '@bemmoly/shared';
import { SkeletonText } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';

const LOOK: Record<AiPromptDiffLine['kind'], { row: string; mark: IconName | null; word: string }> =
  {
    same: { row: 'text-tx-2', mark: null, word: 'Unchanged' },
    added: { row: 'bg-green-50 text-green-tx', mark: 'plus', word: 'Added' },
    removed: { row: 'bg-red-50 text-red-tx line-through', mark: 'minus', word: 'Removed' },
  };

/**
 * The override beside the default, one line per row: added lines on green, removed ones on
 * red and struck through, with the change named for assistive tech (colour is not the only
 * signal; each changed line has a drawn plus or minus).
 */
export function PromptDiff({
  lines,
  loading,
}: {
  lines: readonly AiPromptDiffLine[] | undefined;
  loading?: boolean;
}) {
  if (loading || !lines) {
    return (
      <div aria-busy className="rounded-control border border-line p-3">
        <SkeletonText lines={4} />
      </div>
    );
  }
  if (lines.every((line) => line.kind === 'same')) {
    return <p className="m-0 text-13 text-tx-3">No changes from the default.</p>;
  }
  return (
    <ol
      aria-label="Changes from the default"
      className="m-0 max-h-80 list-none overflow-auto rounded-control border border-line p-0 font-mono text-12 leading-body"
    >
      {lines.map((line, index) => {
        const look = LOOK[line.kind];
        return (
          <li key={index} className={`flex gap-2 px-3 py-0.5 ${look.row}`}>
            <span aria-hidden className="flex w-3 shrink-0 items-center">
              {look.mark ? <Icon name={look.mark} size={14} /> : null}
            </span>
            {line.kind === 'same' ? null : <span className="sr-only">{look.word}: </span>}
            <span className="min-w-0 break-words whitespace-pre-wrap">{line.text || ' '}</span>
          </li>
        );
      })}
    </ol>
  );
}
