import { useRecordRecent } from '@bemmoly/core-web';
import { SegmentedControl } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { workPaths } from '../hooks/issue-navigation.ts';
import { IssueSlideOver } from '../issue/index.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { api, useProject, useWorkRealtime, workKeys } from '../shared/index.ts';
import { useIssuePeek } from '../shared/issue-peek.ts';
import { setSearchParams, useSearchParam } from '../shared/url-state.ts';
import { isRange, RANGE_LABELS, RANGES, rangeQuery, type PairingRange } from './model.ts';
import { PairPanel } from './pair-panel.tsx';
import { PairingError, PairingNobody } from './pairing-empty.tsx';
import { PairingMatrixTable } from './pairing-matrix.tsx';
import { PairingSkeleton } from './pairing-skeleton.tsx';
import { SuggestedPairs } from './suggested-pairs.tsx';

/*
 * The Pairing view (docs/design/premium/interaction/pairing.md): who held issues at the same
 * time as whom in one project, over 30 days, 90 or a year. The range and the open pair live in
 * the address; a shared issue opens in the peek.
 */

function useRange(): PairingRange {
  const value = useSearchParam('range');
  return isRange(value) ? value : '90';
}

export default function PairingScreen({ projectKey }: WorkScreenProps) {
  const { project, isPending: projectPending } = useProject(projectKey);
  const range = useRange();
  const pair = useSearchParam('pair');
  const key = project?.key;
  const matrix = useQuery({
    queryKey: workKeys.pairing(key ?? '', range),
    queryFn: ({ signal }) => api.work.pairing(key ?? '', rangeQuery(range), { signal }),
    enabled: Boolean(key),
  });
  useWorkRealtime(project?.id);
  const peek = useIssuePeek(() => []);
  useRecordRecent(
    project
      ? {
          id: `work.pairing:${project.key}`,
          title: 'Pairing',
          context: project.name,
          path: workPaths.pairing(project.key),
          look: { kind: 'icon', icon: 'grid', moduleId: 'work' },
          group: 'Pairing',
        }
      : null,
  );

  if (projectPending || (key && matrix.isPending)) return <PairingSkeleton />;
  if (!matrix.data) {
    return (
      <PairingError
        message={
          matrix.error ? `${matrix.error.message.replace(/\.$/, '')}.` : 'There is no such project.'
        }
        onRetry={() => void matrix.refetch()}
      />
    );
  }
  const [a, b] = pair?.split(',') ?? [];
  const openPair = (x: string, y: string) =>
    setSearchParams({ pair: x < y ? `${x},${y}` : `${y},${x}` });
  const closePair = () => {
    setSearchParams({ pair: null });
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[data-cell][tabindex="0"]')?.focus(),
    );
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-auto px-6 py-4 max-md:px-4">
        <h1 className="sr-only">Pairing</h1>
        <div className="mb-4 flex items-center gap-3">
          <SegmentedControl
            aria-label="Range"
            size="sm"
            options={RANGES.map((value) => ({ value, label: RANGE_LABELS[value] }))}
            value={range}
            onChange={(value) => setSearchParams({ range: value === '90' ? null : value })}
          />
        </div>
        {matrix.data.people.length === 0 ? (
          <PairingNobody
            onWiden={range === '365' ? null : () => setSearchParams({ range: '365' })}
          />
        ) : (
          <>
            {matrix.data.suggestions && (
              <SuggestedPairs
                matrix={matrix.data}
                suggestions={matrix.data.suggestions}
                onOpen={openPair}
              />
            )}
            <PairingMatrixTable matrix={matrix.data} open={pair} onOpen={openPair} />
            {matrix.data.cells.length === 0 && (
              <p className="mt-3 text-13 text-tx-2">
                No two people were assigned to an issue at the same time in this range.
              </p>
            )}
            {a && b && (
              <PairPanel
                matrix={matrix.data}
                a={a}
                b={b}
                onClose={closePair}
                onOpenIssue={peek.open}
              />
            )}
          </>
        )}
      </div>
      <IssueSlideOver issueKey={peek.issueKey} onClose={peek.close} variant="overlay" />
    </div>
  );
}
