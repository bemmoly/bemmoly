import { useT } from '@bemmoly/core-web';
import type { Policy } from '@bemmoly/module-pipelines/shared';
import { SegmentedControl, Skeleton } from '@bemmoly/ui';
import { usePolicies } from '../../../hooks/use-access.ts';
import { useSearchState } from '../../../hooks/use-search-state.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { TierChip } from '../../../parts/tier-chip.tsx';

const VIEWS = ['sentences', 'code'] as const;

/** "T0" when a policy selects one tier, so a list of rules reads by how careful they are. */
export function tierOf(policy: Pick<Policy, 'applies'>): number | null {
  const match = /tier\s*==\s*([0-2])/.exec(policy.applies);
  return match ? Number(match[1]) : null;
}

/**
 * The policies that apply at the scope, read as sentences or opened as the code they are
 * stored as. A change to a Tier 0 policy waiting for its second Platform admin says so.
 */
export function Policies({ scope, scopeName }: { scope: string; scopeName: string }) {
  const t = useT(pipelinesText);
  const policies = usePolicies(scope);
  const [view, setView] = useSearchState('policy', VIEWS, 'sentences');
  return (
    <Panel
      title={t('pipelines.access.policies')}
      actions={
        <SegmentedControl
          size="sm"
          options={[
            { value: 'sentences', label: t('pipelines.access.sentences') },
            { value: 'code', label: t('pipelines.access.code') },
          ]}
          value={view}
          onChange={setView}
        />
      }
    >
      {policies.isError ? (
        <LoadFailed bare size="sm" error={policies.error} onRetry={() => void policies.refetch()} />
      ) : policies.isPending ? (
        <div aria-busy className="flex flex-col gap-3 py-2">
          <Skeleton width="40%" />
          <Skeleton width="90%" height={10} />
          <Skeleton width="35%" />
          <Skeleton width="80%" height={10} />
        </div>
      ) : policies.data.items.length === 0 ? (
        <p className="py-2 text-13 text-tx-3">{t('pipelines.access.policiesEmpty')}</p>
      ) : (
        <ul className="flex flex-col">
          {policies.data.items.map((policy) => (
            <li
              key={policy.id}
              className="flex flex-col gap-1 border-b border-line-2 py-2.5 last:border-b-0"
            >
              <span className="flex flex-wrap items-center gap-2 text-13 font-medium text-tx">
                <TierChip tier={tierOf(policy)} />
                {policy.name}
                {!policy.enabled && (
                  <span className="text-12 font-normal text-tx-3">
                    {t('pipelines.access.policyOff')}
                  </span>
                )}
                {policy.scope.name !== scopeName && (
                  <span className="text-12 font-normal text-tx-3">
                    {t('pipelines.access.policyFrom', { scope: policy.scope.name })}
                  </span>
                )}
              </span>
              {view === 'sentences' ? (
                <p className="text-12 leading-body text-tx-2">{policy.sentence}</p>
              ) : (
                <pre className="overflow-x-auto rounded-control bg-sunken p-2.5 font-mono text-12 leading-body whitespace-pre text-tx">
                  {policy.source}
                </pre>
              )}
              {policy.pending && (
                <p className="rounded-control bg-amber-50 px-2.5 py-1.5 text-12 text-amber-tx">
                  {t('pipelines.access.pending', { sentence: policy.pending.sentence })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
