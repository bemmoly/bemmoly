import { useT } from '@bemmoly/core-web';
import { buttonClassName, EmptyState, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useApprovalGroups, useEnvironmentsV2 } from '../../../hooks/use-environments-v2.ts';
import { environmentsText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RuleCard } from './rule-card.tsx';

/**
 * Platform › Approval rules: one card per environment, in path order. Every environment deploys
 * without approval until a rule is added to it (product rule 4); none is special.
 */
export default function ApprovalRulesScreen() {
  const t = useT(environmentsText);
  const list = useEnvironmentsV2();
  const groups = useApprovalGroups().data ?? [];
  const items = list.data?.items ?? [];
  const none = items.every((environment) => !environment.approvalRule);
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      <h2 className="sr-only">{t('pipelinesEnvironments.approvals.title')}</h2>
      {list.isError ? (
        <LoadFailed error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {none && (
            <div className="rounded-card border border-line bg-card py-10 shadow-e1">
              <EmptyState
                icon={<Icon name="checklist" size={18} />}
                title={t('pipelinesEnvironments.approvals.emptyTitle')}
                description={t('pipelinesEnvironments.approvals.emptyText')}
                headingLevel={3}
                action={
                  items.length === 0 ? (
                    <Link to="/environments" className={buttonClassName({})}>
                      {t('pipelinesEnvironments.approvals.openEnvironments')}
                    </Link>
                  ) : undefined
                }
              />
            </div>
          )}
          {items.map((environment, index) => (
            <RuleCard
              key={environment.id}
              environment={environment}
              groups={groups}
              previous={items[index - 1]?.name ?? null}
            />
          ))}
        </>
      )}
    </div>
  );
}
