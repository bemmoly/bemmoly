import { useT } from '@bemmoly/core-web';
import { Button, Card, SkeletonCard, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, overlaps } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { todayIso, useDateText } from '../shared/format.ts';
import { peopleKeys } from '../shared/keys.ts';
import { PersonCell } from '../shared/person.tsx';
import { usePeopleById } from '../shared/queries.ts';
import { LoadError } from '../shared/states.tsx';
import { useAbsences } from './queries.ts';

/**
 * Time off waiting on the person's decision, from the kernel's approval engine. Each request
 * shows how many others on the requester's team are away on the same days.
 */
export function ApprovalsTab() {
  const t = useT(peopleText);
  const date = useDateText();
  const toast = useToast();
  const client = useQueryClient();
  const people = usePeopleById();
  const waiting = useQuery({
    queryKey: peopleKeys.approvals(),
    queryFn: async () => (await api.approvals.list({ scope: 'waiting', moduleId: 'people' })).items,
  });
  const team = useQuery({
    queryKey: peopleKeys.requests({ scope: 'team' }),
    queryFn: async () => (await api.people.leave.requests({ scope: 'team' })).items,
  });
  const today = todayIso();
  const away = useAbsences(today, addDays(today, 365));
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api.approvals.decide(id, { decision }),
    onSuccess: async (_result, { decision }) => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({
        tone: 'ok',
        title: t(
          decision === 'approve' ? 'people.approvals.approved' : 'people.approvals.rejected',
        ),
      });
    },
    onError: (error) => toast.show({ tone: 'danger', title: error.message }),
  });

  if (waiting.isPending) return <SkeletonCard />;
  if (waiting.isError) return <LoadError onRetry={() => void waiting.refetch()} />;
  if (waiting.data.length === 0) {
    return <Card className="px-3.5 py-4 text-13 text-tx-3">{t('people.approvals.empty')}</Card>;
  }
  const requests = new Map((team.data ?? []).map((request) => [request.id, request]));
  return (
    <Card className="overflow-hidden">
      {waiting.data.map((approval) => {
        const request = requests.get(approval.subject.id);
        const requester = people.byId.get(approval.requesterId);
        const others = request
          ? new Set(
              (away.data ?? [])
                .filter((a) => a.userId !== approval.requesterId)
                .filter((a) => people.byId.get(a.userId)?.teamId === requester?.teamId)
                .filter((a) =>
                  overlaps(
                    { start: request.startDate, end: request.endDate },
                    { start: a.startDate, end: a.endDate },
                  ),
                )
                .map((a) => a.userId),
            ).size
          : null;
        return (
          <div
            key={approval.id}
            className="flex flex-wrap items-center gap-3 border-b border-line-2 px-3.5 py-3 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <PersonCell
                userId={approval.requesterId}
                name={requester?.name ?? t('people.someone')}
                detail={approval.title}
              />
            </span>
            <span className="flex flex-col items-end text-12 text-tx-3">
              <span>
                {t('people.approvals.requested', { date: date(approval.createdAt.slice(0, 10)) })}
              </span>
              {others !== null ? (
                <span className={others > 0 ? 'text-amber-tx' : ''}>
                  {t('people.approvals.overlap', { count: others })}
                </span>
              ) : null}
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: approval.id, decision: 'reject' })}
              >
                {t('people.approvals.reject')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={decide.isPending && decide.variables.id === approval.id}
                onClick={() => decide.mutate({ id: approval.id, decision: 'approve' })}
              >
                {t('people.approvals.approve')}
              </Button>
            </span>
          </div>
        );
      })}
    </Card>
  );
}
