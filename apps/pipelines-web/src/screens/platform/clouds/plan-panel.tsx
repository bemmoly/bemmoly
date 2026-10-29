import { useT } from '@bemmoly/core-web';
import type { LandingZonePlan } from '@bemmoly/module-pipelines/shared';
import { Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { ZoneTree } from './zone-tree.tsx';

/** One sentence on the billing account: what it pays for now and what this plan adds. */
function BillingLine({ billing }: { billing: NonNullable<LandingZonePlan['billing']> }) {
  const t = useT(pipelinesText);
  return (
    <p className="mt-2 flex items-start gap-2 text-12 text-tx-2">
      <Icon name="info" size={14} className="mt-0.5 shrink-0 text-tx-3" />
      <span>
        {t(
          billing.recorded ? 'pipelines.clouds.billingRecorded' : 'pipelines.clouds.billingUsual',
          {
            account: billing.account,
            linked: billing.linked,
            adding: billing.adding,
            limit: billing.limit,
          },
        )}
      </span>
    </p>
  );
}

/**
 * The plan before anything is applied: every folder, project, the registry and the identities,
 * each marked new, changed or kept; the billing account's headroom; what to know (moves,
 * kept projects) and what stops Apply.
 */
export function PlanPanel({
  plan,
  unit,
  error,
  onRetry,
}: {
  plan: LandingZonePlan | undefined;
  unit: string;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useT(pipelinesText);
  return (
    <Panel
      title={t('pipelines.clouds.treeLabel')}
      meta={
        plan &&
        t('pipelines.clouds.planCounts', {
          unit,
          accounts: plan.counts.accounts,
          folders: plan.counts.folders,
        })
      }
    >
      {error ? (
        <LoadFailed bare size="sm" error={error} onRetry={onRetry} />
      ) : !plan ? (
        <div aria-busy className="flex flex-col gap-2 rounded-control bg-sunken p-3">
          {[70, 55, 62, 48, 58, 40].map((width) => (
            <Skeleton key={width} width={`${width}%`} height={10} />
          ))}
        </div>
      ) : (
        <>
          <ZoneTree root={plan.root} />
          {/* Over the limit, the warning below says the same and more. */}
          {plan.billing && plan.billing.linked + plan.billing.adding <= plan.billing.limit && (
            <BillingLine billing={plan.billing} />
          )}
          {plan.warnings.length > 0 && (
            <ul
              aria-label={t('pipelines.clouds.planWarnings')}
              className="mt-2 flex flex-col gap-1 rounded-control bg-line-2 px-3 py-2 text-12 text-tx-2"
            >
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {plan.blockers.map((blocker) => (
            <p
              key={blocker}
              className="mt-2 rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx"
            >
              {blocker}
            </p>
          ))}
          <p className="mt-2 text-12 text-tx-3">{t('pipelines.clouds.planNote', { unit })}</p>
        </>
      )}
    </Panel>
  );
}
