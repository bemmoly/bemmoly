import { formatDateTime, useT } from '@bemmoly/core-web';
import { Avatar, Breadcrumbs, RelativeTime, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link, useParams } from '@tanstack/react-router';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { DecisionActions } from './decision-actions.tsx';
import {
  ActivityCard,
  ChangesCard,
  CommitsCard,
  EvidenceCard,
  RollbackCard,
  WhyCard,
} from './detail-cards.tsx';
import { ChangeNumber, RiskMark, StatusChip } from './marks.tsx';
import { RouteCard } from './route-card.tsx';
import { useChangeRequest } from './use-change-requests.ts';

/**
 * One change request: what moves where and why, what backs it, the approval route with each
 * picked person's state, and its activity. An approver decides here; the person who asked
 * sends, edits or withdraws it.
 */
export default function ChangeRequestScreen() {
  const t = useT(changeRequestsText);
  const { number = '' } = useParams({ strict: false }) as { number?: string };
  const query = useChangeRequest(number);
  const request = query.data;
  const crumbs = [
    {
      label: t('pipelinesChangeRequests.list.title'),
      href: '/changes',
      linkProps: { to: '/changes' },
    },
    { label: number },
  ];
  if (!request) {
    return (
      <ScreenFrame title={number}>
        <Breadcrumbs items={crumbs} linkAs={Link} />
        {query.isError ? (
          <LoadFailed error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </ScreenFrame>
    );
  }
  const open = request.steps.find((step) => step.state === 'waiting');
  const got = open?.approvals.filter((a) => a.decision === 'approved').length ?? 0;
  const last = open ? got + 1 >= open.count && request.steps.at(-1) === open : false;
  const when =
    request.when.kind === 'at'
      ? t('pipelinesChangeRequests.when.at', {
          time: formatDateTime(request.when.at),
        })
      : t('pipelinesChangeRequests.when.asap');
  return (
    <ScreenFrame
      title={request.title}
      heading={
        <div className="flex min-w-0 flex-col gap-1.5">
          <Breadcrumbs items={crumbs} linkAs={Link} />
          <span className="flex flex-wrap items-center gap-2">
            <ChangeNumber number={request.number} />
            <StatusChip status={request.status} got={got} needed={open?.count ?? 0} />
            <RiskMark risk={request.risk} />
          </span>
          <h1 className="text-20 leading-title font-semibold text-tx">{request.title}</h1>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12 text-tx-2">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={request.requestedBy.name} size={18} />
              {t('pipelinesChangeRequests.detail.asked', { name: request.requestedBy.name })}{' '}
              <RelativeTime iso={request.sentAt ?? request.createdAt} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="layers" size={14} />
              {t('pipelinesChangeRequests.list.toEnvironment', { name: request.environment.name })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={14} />
              {when}
            </span>
          </span>
        </div>
      }
      actions={<DecisionActions request={request} />}
    >
      {request.can.approve ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-card border border-line bg-acc-50 px-4 py-3 text-13 text-tx"
        >
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-acc" />
          {t(
            last
              ? 'pipelinesChangeRequests.detail.youAreLast'
              : 'pipelinesChangeRequests.detail.youArePicked',
            { name: request.environment.name },
          )}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <WhyCard request={request} />
          <ChangesCard request={request} />
          <CommitsCard request={request} />
          <div className="grid gap-4 md:grid-cols-2">
            <EvidenceCard request={request} />
            <RollbackCard request={request} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <RouteCard request={request} />
          <ActivityCard request={request} />
        </div>
      </div>
    </ScreenFrame>
  );
}
