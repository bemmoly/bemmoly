import { useT } from '@bemmoly/core-web';
import { Card, CardHeader, ProgressBar } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { LeaveBalance } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from './api.ts';
import { peopleKeys } from './keys.ts';

export function useBalances(userId?: string) {
  return useQuery({
    queryKey: peopleKeys.balances(userId),
    queryFn: async () => (await api.people.leave.balances(userId ? { userId } : {})).items,
    retry: false,
  });
}

/** One leave type's year: what is left, and how much is used, booked and waiting. */
export function BalanceRow({ balance }: { balance: LeaveBalance }) {
  const t = useT(peopleText);
  const spent = balance.used + balance.booked + balance.pending;
  const counts = { used: balance.used, booked: balance.booked, pending: balance.pending };
  return (
    <div className="flex flex-col gap-1.5 border-b border-line-2 px-3.5 py-3 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <span className="flex-1 truncate text-13 font-semibold text-tx">{balance.name}</span>
        <span className="text-13 text-tx tabular-nums">
          {balance.left === null
            ? t('people.timeOff.noLimit')
            : t('people.timeOff.left', { left: balance.left })}
        </span>
      </div>
      {balance.allowance !== null ? (
        <ProgressBar
          value={balance.allowance === 0 ? 0 : (spent / balance.allowance) * 100}
          label={balance.name}
          size="sm"
        />
      ) : null}
      <span className="text-12 text-tx-3 tabular-nums">
        {balance.allowance === null
          ? t('people.timeOff.usedNoLimit', counts)
          : t('people.timeOff.usedOf', { ...counts, allowance: balance.allowance })}
      </span>
    </div>
  );
}

/** A person's balances; drawn only when the viewer may see them. */
export function BalancesCard({ userId }: { userId?: string }) {
  const t = useT(peopleText);
  const balances = useBalances(userId);
  if (!balances.isSuccess || balances.data.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('people.profile.balances')} />
      {balances.data.map((balance) => (
        <BalanceRow key={balance.policyId} balance={balance} />
      ))}
    </Card>
  );
}
