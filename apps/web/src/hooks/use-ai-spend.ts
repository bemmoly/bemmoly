import { queryKeys } from '@bemmoly/api-client';
import type { AiBudgetStatus } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import type { CheckRow } from '../components/system/check-list.tsx';
import { formatUsd } from '../lib/ai-format.ts';
import { aiSettingsQuery, CONFIGURE_AI } from './use-ai-admin.ts';
import { useMe } from './use-session.ts';
import { aiAdminApi } from '../lib/ai-admin-api.ts';

const SETTINGS_AI = { label: 'AI and models', href: '/settings/ai' };
const USAGE = { label: 'Usage', href: '/settings/ai/usage' };

/** "$12.40 of $50 this month", or the spend alone when there is no budget. */
export function spendText(budget: AiBudgetStatus): string {
  const spent = formatUsd(budget.spentUsd);
  return budget.budgetUsd === null
    ? `${spent} this month, no budget set`
    : `${spent} of ${formatUsd(budget.budgetUsd)} this month`;
}

/**
 * System status's AI spend row, for the people who configure AI (the only ones who may read
 * spend): this month's spend against the budget, or that AI is off. Nobody else gets the row.
 */
export function useAiSpendRow(): CheckRow | null {
  const me = useMe();
  const canConfigure = me.can(CONFIGURE_AI);
  const settings = useQuery({ ...aiSettingsQuery, enabled: canConfigure });
  const on = settings.data?.privacy.enabled ?? false;
  const usage = useQuery({
    queryKey: queryKeys.ai.usage(),
    queryFn: () => aiAdminApi.usage(),
    enabled: canConfigure && on,
  });
  if (!canConfigure) return null;
  const row = { id: 'ai-spend', name: 'AI spend', prose: true };
  if (!settings.data) return { ...row, value: 'Checking…' };
  if (!on) return { ...row, value: 'AI is off', link: SETTINGS_AI };
  const budget = usage.data?.budget;
  if (!budget) return { ...row, value: usage.isError ? 'Couldn’t read spend' : 'Checking…' };
  return {
    ...row,
    value: spendText(budget),
    tone: budget.state === 'paused' ? 'danger' : budget.state === 'warning' ? 'caution' : 'ok',
    link: USAGE,
  };
}
