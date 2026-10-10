import { AI_LANGUAGE_ROLES, type AiProvider } from '@bemmoly/shared';
import { AddProviderDialog, PICKING } from '../../../components/ai/add-provider-dialog.tsx';
import { AiSwitchSection } from '../../../components/ai/ai-switch-section.tsx';
import { CatalogSection } from '../../../components/ai/catalog-section.tsx';
import { ProvidersSection } from '../../../components/ai/providers-section.tsx';
import { RolesSection } from '../../../components/ai/roles-section.tsx';
import { SettingsPage } from '../../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../../components/settings/settings-states.tsx';
import { useAiAdminSettings } from '../../../hooks/use-ai-admin.ts';
import { useAiProviders } from '../../../hooks/use-ai-providers.ts';
import { useAiRoles } from '../../../hooks/use-ai-roles.ts';
import { useSearchParam } from '../../../hooks/use-search-param.ts';
import { toast } from '../../../lib/toast.ts';

export const AI_PAGE_TITLE = 'AI and models';
export const AI_PAGE_DESCRIPTION =
  'Bemmoly works fully without AI. Connect providers from the catalog, choose a model for each role and decide what AI may see.';

/**
 * Settings › AI › Setup: is AI on, which providers are connected, which model fills each role,
 * and where the catalog comes from. Off and never set up, only the first-time guidance shows.
 */
export function AiSetupPage() {
  const admin = useAiAdminSettings();
  const providers = useAiProviders(admin.canConfigure);
  const roles = useAiRoles(admin.canConfigure);
  const [, setAdd] = useSearchParam('add');
  const on = admin.settings?.privacy.enabled ?? false;
  const count = providers.items.length;
  const hasLanguageRole = AI_LANGUAGE_ROLES.some((role) => roles.assignment(role) !== null);
  const connected = async (row: AiProvider) => {
    const filled = await roles.fillDefaults(row).catch(() => 0);
    if (!on) await admin.save({ privacy: { enabled: true } }).catch(() => undefined);
    toast(
      filled > 0
        ? `${row.name} connected · suggested models chosen for ${filled} ${filled === 1 ? 'role' : 'roles'}`
        : `${row.name} connected`,
    );
    providers.test(row.id);
  };
  const loading = admin.query.isPending || providers.query.isPending;
  return (
    <SettingsPage
      title={AI_PAGE_TITLE}
      description={AI_PAGE_DESCRIPTION}
      loading={loading}
      skeleton={<SettingsSkeleton sections={3} rows={3} />}
      error={admin.query.error ?? providers.query.error}
    >
      <AiSwitchSection
        admin={admin}
        providerCount={count}
        hasLanguageRole={hasLanguageRole}
        onAdd={() => setAdd(PICKING)}
      />
      {on ? (
        <>
          <ProvidersSection providers={providers} onAdd={() => setAdd(PICKING)} />
          <RolesSection roles={roles} />
          <CatalogSection admin={admin} />
        </>
      ) : null}
      <AddProviderDialog onConnected={(row) => void connected(row)} />
    </SettingsPage>
  );
}
