import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../components/settings/settings-states.tsx';
import { MethodsSection } from '../../components/sso/methods-section.tsx';
import { PolicySection } from '../../components/sso/policy-section.tsx';
import { ProviderDialog } from '../../components/sso/provider-dialog.tsx';
import { ScimSection } from '../../components/sso/scim-section.tsx';
import { useSearchParam } from '../../hooks/use-search-param.ts';
import { useMe } from '../../hooks/use-session.ts';
import { useScimTokens, useSsoPolicy, useSsoProviders } from '../../hooks/use-sso-admin.ts';

export const SSO_CAPABILITY = 'workspace.sso.configure';

/**
 * Settings › Sign-in and SSO: the methods people sign in with (password, then each identity
 * provider with its test), the require-SSO policy, and SCIM provisioning. The open dialog is in
 * the address (`?provider=new`, `new:<preset>` or an id), so reload and Back keep it.
 */
export function AuthenticationPage() {
  const me = useMe();
  const allowed = me.can(SSO_CAPABILITY);
  const providers = useSsoProviders(allowed);
  const policy = useSsoPolicy(allowed);
  const tokens = useScimTokens(allowed);
  const [dialog, setDialog] = useSearchParam('provider');
  const add = () => setDialog('new');
  return (
    <SettingsPage
      title="Sign-in and SSO"
      description="How people sign in to this workspace, and how your identity provider keeps people and teams in step."
      actions={
        allowed ? (
          <Button size="sm" icon={<Icon name="plus" />} onClick={add}>
            Add identity provider…
          </Button>
        ) : null
      }
      loading={allowed && (providers.query.isPending || policy.query.isPending)}
      skeleton={<SettingsSkeleton sections={3} rows={2} />}
      error={providers.query.error ?? policy.query.error ?? tokens.query.error}
    >
      {allowed ? (
        <>
          <MethodsSection
            providers={providers}
            policy={policy.policy}
            onEdit={(id) => setDialog(id)}
            onAdd={add}
          />
          <PolicySection policy={policy} providers={providers.items} />
          <ScimSection tokens={tokens} />
          <ProviderDialog state={dialog} providers={providers} onState={setDialog} />
        </>
      ) : (
        <Notice>
          Only people who can configure single sign-on see these settings. Ask an org admin.
        </Notice>
      )}
    </SettingsPage>
  );
}
