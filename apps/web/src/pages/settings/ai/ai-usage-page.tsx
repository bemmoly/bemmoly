import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { BudgetSection } from '../../../components/ai/budget-section.tsx';
import { UsageTables } from '../../../components/ai/usage-tables.tsx';
import { SettingsPage } from '../../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../../components/settings/settings-states.tsx';
import { useAiAdminSettings } from '../../../hooks/use-ai-admin.ts';
import { AI_PAGE_DESCRIPTION, AI_PAGE_TITLE } from './ai-setup-page.tsx';
import { aiAdminApi } from '../../../lib/ai-admin-api.ts';

/** Settings › AI › Usage: the monthly budget and this month's spend from every AI call. */
export function AiUsagePage() {
  const admin = useAiAdminSettings();
  const usage = useQuery({
    queryKey: queryKeys.ai.usage(),
    queryFn: () => aiAdminApi.usage(),
    enabled: admin.canConfigure,
  });
  return (
    <SettingsPage
      title={AI_PAGE_TITLE}
      description={AI_PAGE_DESCRIPTION}
      loading={admin.query.isPending || usage.isPending}
      skeleton={<SettingsSkeleton sections={2} rows={4} />}
      error={admin.query.error ?? usage.error}
    >
      <BudgetSection admin={admin} budget={usage.data?.budget} />
      {usage.data ? <UsageTables usage={usage.data} /> : null}
    </SettingsPage>
  );
}
