import { useT } from '@bemmoly/core-web';
import type {
  ChangeRequestSummary,
  ListChangeRequestsQuery,
} from '@bemmoly/module-pipelines/shared';
import {
  Avatar,
  Button,
  EmptyState,
  RelativeTime,
  Table,
  Tabs,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useSearchText } from '../../hooks/use-search-state.ts';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { ChangeNumber, RiskMark, StatusChip } from './marks.tsx';
import { useChangeRequests, usePipelinesRole } from './use-change-requests.ts';

type Tab = ListChangeRequestsQuery['tab'];

/**
 * Changes: every change request, one tab at a time. Approvers start on what waits for them;
 * everyone else on what is open. A row opens the request.
 */
export default function ChangeRequestsScreen() {
  const t = useT(changeRequestsText);
  const navigate = useNavigate();
  const role = usePipelinesRole().data?.role;
  const approver = role === 'approver';
  const readOnly = role === 'viewer' || approver;
  const tabs: Tab[] = approver
    ? ['waiting_for_me', 'decided', 'all']
    : ['open', 'mine', 'waiting_for_me', 'done', 'all'];
  const [chosen, setTab] = useSearchText('tab');
  const tab = (tabs.find((value) => value === chosen) ?? tabs[0] ?? 'open') as Tab;
  const list = useChangeRequests({ tab });
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const open = (row: ChangeRequestSummary) =>
    void navigate({ to: '/changes/$number', params: { number: row.number } });

  const columns: TableColumn<ChangeRequestSummary>[] = [
    {
      key: 'number',
      header: t('pipelinesChangeRequests.list.change'),
      width: '104px',
      render: (row) => <ChangeNumber number={row.number} />,
    },
    {
      key: 'title',
      header: t('pipelinesChangeRequests.list.titleColumn'),
      width: 'minmax(0,2fr)',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-tx">{row.title}</span>
          <span className="truncate text-12 text-tx-3">
            {t('pipelinesChangeRequests.list.toEnvironment', { name: row.environment.name })}
            {' · '}
            <RelativeTime iso={row.createdAt} />
          </span>
        </span>
      ),
    },
    {
      key: 'versions',
      header: t('pipelinesChangeRequests.list.versions'),
      width: 'minmax(0,1.3fr)',
      hideOnPhone: true,
      render: (row) => (
        <span className="flex min-w-0 flex-col text-12">
          {row.items.map((item) => (
            <span key={item.application} className="truncate font-mono">
              {item.application} <span className="text-tx-3">{item.toVersion}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      key: 'risk',
      header: t('pipelinesChangeRequests.list.risk'),
      width: '96px',
      hideOnPhone: true,
      render: (row) => <RiskMark risk={row.risk} />,
    },
    {
      key: 'by',
      header: t('pipelinesChangeRequests.list.askedBy'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (row) => (
        <span className="inline-flex min-w-0 items-center gap-2">
          <Avatar name={row.requestedBy.name} size={20} />
          <span className="truncate">{row.requestedBy.name}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t('pipelinesChangeRequests.list.status'),
      width: '150px',
      render: (row) => (
        <StatusChip status={row.status} got={row.approvalsGot} needed={row.approvalsNeeded} />
      ),
    },
  ];

  return (
    <ScreenFrame
      title={t('pipelinesChangeRequests.list.title')}
      actions={
        readOnly ? null : (
          <Button
            variant="primary"
            icon={<Icon name="plus" size={14} />}
            onClick={() => void navigate({ to: '/changes/new' })}
          >
            {t('pipelinesChangeRequests.list.new')}
          </Button>
        )
      }
    >
      <p className="-mt-2 max-w-3xl text-13 text-tx-2">{t('pipelinesChangeRequests.list.lead')}</p>
      <Tabs
        aria-label={t('pipelinesChangeRequests.list.tabs')}
        items={tabs.map((value) => ({ value, label: t(`pipelinesChangeRequests.tab.${value}`) }))}
        value={tab}
        onChange={(value) => setTab(value)}
      />
      {list.isPending ? (
        <RowsSkeleton columns={6} />
      ) : list.isError ? (
        <LoadFailed error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Table
          label={t('pipelinesChangeRequests.list.title')}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={open}
          footer={{
            hasMore: Boolean(list.hasNextPage),
            loading: list.isFetchingNextPage,
            onLoadMore: () => void list.fetchNextPage(),
          }}
          empty={
            <EmptyState
              icon={<Icon name="checklist" size={18} />}
              title={t(`pipelinesChangeRequests.empty.${tab}`)}
              description={t('pipelinesChangeRequests.empty.description')}
              headingLevel={2}
            />
          }
        />
      )}
    </ScreenFrame>
  );
}
