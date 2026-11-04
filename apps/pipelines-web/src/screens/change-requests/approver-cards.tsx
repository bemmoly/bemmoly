import { useT } from '@bemmoly/core-web';
import type { ChangeRequestSummary } from '@bemmoly/module-pipelines/shared';
import { Button, Card, CardHeader, Badge, RelativeTime, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { refusalOf } from '../../parts/load-failed.tsx';
import { ChangeNumber, RiskMark, StatusChip } from './marks.tsx';
import {
  useChangeRequestOptions,
  useChangeRequests,
  useChangeRequestWrites,
} from './use-change-requests.ts';

/*
 * An approver's For you, as cards the For you screen mounts: the requests waiting for them
 * (Approve from the card, Open for the whole story), what they decided recently, and what
 * runs in the last environment on the path.
 */

const rowsOf = (query: ReturnType<typeof useChangeRequests>) =>
  query.data?.pages.flatMap((page) => page.items) ?? [];

function WaitingRow({ request }: { request: ChangeRequestSummary }) {
  const t = useT(changeRequestsText);
  const toast = useToast();
  const writes = useChangeRequestWrites();
  return (
    <li className="flex flex-col gap-2 border-b border-line-2 px-4 py-3 last:border-0">
      <span className="flex flex-wrap items-center gap-2">
        <ChangeNumber number={request.number} />
        <b className="min-w-0 truncate font-semibold">{request.title}</b>
        <RiskMark risk={request.risk} />
      </span>
      <span className="font-mono text-12 text-tx-2">
        {request.items.map((item) => `${item.application} ${item.toVersion}`).join(', ')}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-12 text-tx-3">
          {t('pipelinesChangeRequests.forYou.asked', {
            name: request.requestedBy.name,
            got: request.approvalsGot,
            needed: request.approvalsNeeded,
          })}{' '}
          <RelativeTime iso={request.createdAt} />
        </span>
        <Link
          to="/changes/$number"
          params={{ number: request.number }}
          className="text-13 text-acc hover:underline"
        >
          {t('pipelinesChangeRequests.forYou.open')}
        </Link>
        <Button
          size="sm"
          variant="primary"
          icon={<Icon name="check" size={14} />}
          loading={writes.approve.isPending}
          onClick={() =>
            writes.approve.mutate(
              { number: request.number },
              {
                onSuccess: () =>
                  toast.show({ tone: 'ok', title: t('pipelinesChangeRequests.forYou.approved') }),
                onError: (error) =>
                  toast.show({
                    tone: 'danger',
                    title: t('pipelinesChangeRequests.actions.failed'),
                    body: refusalOf(error)?.sentence ?? '',
                  }),
              },
            )
          }
        >
          {t('pipelinesChangeRequests.actions.approve')}
        </Button>
      </span>
    </li>
  );
}

export function WaitingForYouCard() {
  const t = useT(changeRequestsText);
  const waiting = rowsOf(useChangeRequests({ tab: 'waiting_for_me' }));
  return (
    <Card>
      <CardHeader
        title={t('pipelinesChangeRequests.forYou.waiting')}
        actions={<Badge tone={waiting.length ? 'warn' : 'neutral'}>{waiting.length}</Badge>}
      />
      {waiting.length ? (
        <ul>
          {waiting.map((request) => (
            <WaitingRow key={request.id} request={request} />
          ))}
        </ul>
      ) : (
        <p className="p-4 text-13 text-tx-3">{t('pipelinesChangeRequests.forYou.caughtUp')}</p>
      )}
    </Card>
  );
}

export function DecidedRecentlyCard() {
  const t = useT(changeRequestsText);
  const decided = rowsOf(useChangeRequests({ tab: 'decided', limit: 8 }));
  return (
    <Card>
      <CardHeader
        title={t('pipelinesChangeRequests.forYou.decided')}
        actions={
          <Link to="/changes" className="text-13 text-acc hover:underline">
            {t('pipelinesChangeRequests.forYou.allChanges')}
          </Link>
        }
      />
      {decided.length ? (
        <ul>
          {decided.map((request) => (
            <li key={request.id} className="border-b border-line-2 last:border-0">
              <Link
                to="/changes/$number"
                params={{ number: request.number }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-line-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-13 font-semibold">
                    {request.number} · {request.title}
                  </b>
                  <span className="truncate font-mono text-12 text-tx-3">
                    {request.items
                      .map((item) => `${item.application} ${item.toVersion}`)
                      .join(', ')}
                  </span>
                </span>
                <StatusChip
                  status={request.status}
                  got={request.approvalsGot}
                  needed={request.approvalsNeeded}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-13 text-tx-3">
          {t('pipelinesChangeRequests.forYou.nothingDecided')}
        </p>
      )}
    </Card>
  );
}

/** What runs in the last environment on the path, by service. */
export function LiveInLastCard() {
  const t = useT(changeRequestsText);
  const first = useChangeRequestOptions({});
  const last = first.data?.environments.at(-1);
  const options = useChangeRequestOptions(last ? { environment: last.key } : null);
  if (!last) return null;
  const live = options.data?.services.filter((service) => service.current) ?? [];
  return (
    <Card>
      <CardHeader title={t('pipelinesChangeRequests.forYou.liveIn', { name: last.name })} />
      {live.length ? (
        <ul>
          {live.map((service) => (
            <li
              key={service.key}
              className="flex items-center gap-3 border-b border-line-2 px-4 py-2 text-13 last:border-0"
            >
              <span className="min-w-0 flex-1 truncate font-mono">{service.key}</span>
              <span className="font-mono text-tx-2">{service.current?.version}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-13 text-tx-3">{t('pipelinesChangeRequests.forYou.nothingLive')}</p>
      )}
    </Card>
  );
}

/** The three cards together, laid out as the approver's For you draws them. */
export function ApproverForYou() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <WaitingForYouCard />
        <DecidedRecentlyCard />
      </div>
      <LiveInLastCard />
    </div>
  );
}
