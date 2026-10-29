import { useT } from '@bemmoly/core-web';
import { Badge, Button, Card, CardHeader, SkeletonCard, Table, useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LeaveRequest, LeaveStatus } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { BalanceRow, useBalances } from '../shared/balances.tsx';
import { todayIso, useDateText } from '../shared/format.ts';
import { peopleKeys } from '../shared/keys.ts';
import { PersonCell } from '../shared/person.tsx';
import { usePeopleById } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { useAbsences, useMyRequests } from './queries.ts';

const STATUS_TONE: Record<LeaveStatus, 'warn' | 'ok' | 'neutral' | 'outline'> = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'neutral',
  withdrawn: 'outline',
};

/** The person's balances and requests, and who is out today. */
export function OverviewTab() {
  const t = useT(peopleText);
  const date = useDateText();
  const toast = useToast();
  const client = useQueryClient();
  const balances = useBalances();
  const requests = useMyRequests();
  const today = todayIso();
  const out = useAbsences(today, today);
  const people = usePeopleById();
  const withdraw = useMutation({
    mutationFn: (id: string) => api.people.leave.withdraw(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({ tone: 'ok', title: t('people.timeOff.withdrawn') });
    },
    onError: (error) => toast.show({ tone: 'danger', title: error.message }),
  });
  const year = new Date().getUTCFullYear();

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="overflow-hidden">
          <CardHeader title={t('people.timeOff.balances', { year })} />
          {balances.isPending ? (
            <SkeletonCard className="m-3.5" />
          ) : balances.isError ? (
            <LoadError onRetry={() => void balances.refetch()} />
          ) : balances.data.length === 0 ? (
            <p className="m-0 px-3.5 py-3 text-13 text-tx-3">{t('people.timeOff.noPolicies')}</p>
          ) : (
            balances.data.map((balance) => <BalanceRow key={balance.policyId} balance={balance} />)
          )}
        </Card>
        <Table
          label={t('people.timeOff.myRequests')}
          density="sm"
          rows={requests.data ?? []}
          rowKey={(row) => row.id}
          empty={
            <p className="m-0 px-3.5 py-3 text-13 text-tx-3">{t('people.timeOff.noRequests')}</p>
          }
          columns={[
            {
              key: 'dates',
              header: t('people.timeOff.col.dates'),
              width: 'minmax(150px,2fr)',
              render: (row: LeaveRequest) => (
                <span className="text-13 text-tx tabular-nums">
                  {row.startDate === row.endDate
                    ? date(row.startDate)
                    : t('people.timeOff.range', {
                        start: date(row.startDate),
                        end: date(row.endDate),
                      })}
                </span>
              ),
            },
            {
              key: 'type',
              header: t('people.timeOff.col.type'),
              width: 'minmax(110px,1fr)',
              hideOnPhone: true,
              render: (row: LeaveRequest) => (
                <span className="text-13 text-tx-2">{t(`people.kind.${row.kind}`)}</span>
              ),
            },
            {
              key: 'days',
              header: t('people.timeOff.col.days'),
              width: '70px',
              align: 'end',
              render: (row: LeaveRequest) => (
                <span className="text-13 tabular-nums">{row.days}</span>
              ),
            },
            {
              key: 'status',
              header: t('people.timeOff.col.status'),
              width: '110px',
              render: (row: LeaveRequest) => (
                <Badge tone={STATUS_TONE[row.status]}>{t(`people.status.${row.status}`)}</Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              width: '100px',
              align: 'end',
              render: (row: LeaveRequest) =>
                row.status === 'pending' || (row.status === 'approved' && row.startDate > today) ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    loading={withdraw.isPending && withdraw.variables === row.id}
                    onClick={() => withdraw.mutate(row.id)}
                  >
                    {t('people.timeOff.withdraw')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </div>
      <Card className="self-start overflow-hidden">
        <CardHeader title={t('people.timeOff.whosOut')} />
        <div className="flex flex-col gap-2.5 px-3.5 py-3">
          {(out.data ?? []).length === 0 ? (
            <span className="text-13 text-tx-3">{t('people.timeOff.nobodyOut')}</span>
          ) : (
            (out.data ?? []).map((absence) => (
              <PersonCell
                key={absence.requestId}
                userId={absence.userId}
                name={people.name(absence.userId) ?? t('people.someone')}
                detail={t('people.timeOff.until', { date: date(absence.endDate) })}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
