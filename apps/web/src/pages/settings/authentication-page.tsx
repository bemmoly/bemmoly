import { Card, CardBody, SettingsRow, Switch } from '@bemmoly/ui';
import { AuthMethodCard, type AuthMethod } from '../../components/people/auth-method-card.tsx';
import { Notice } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';

/** Password sign-in is what 0.1.0 has; the four identity providers of the mock come later. */
const METHODS: readonly AuthMethod[] = [
  {
    id: 'password',
    initials: 'PW',
    name: 'Password',
    description: 'Email and password, with a break-glass admin.',
    enabled: true,
  },
  {
    id: 'google',
    initials: 'G',
    name: 'Google Workspace',
    description: 'OIDC sign-in for everyone on your Google Workspace domain.',
    enabled: false,
  },
  {
    id: 'okta',
    initials: 'OK',
    name: 'Okta',
    description: 'SAML 2.0 sign-in, with SCIM provisioning.',
    enabled: false,
  },
  {
    id: 'entra',
    initials: 'MS',
    name: 'Microsoft Entra ID',
    description: 'SAML or OIDC. Needed if part of your org uses Microsoft 365.',
    enabled: false,
  },
  {
    id: 'oidc',
    initials: 'ID',
    name: 'Generic OIDC / LDAP',
    description: 'Keycloak, Authentik, Active Directory and anything else standards-based.',
    enabled: false,
  },
];

const POLICIES = [
  {
    title: 'Require SSO for everyone',
    description: 'Password login disabled except for break-glass admins.',
  },
  {
    title: 'Auto-provision users on first login',
    description: 'New SSO users get the Member role and no teams.',
  },
  {
    title: 'Map IdP groups to teams',
    description: 'People join teams from their identity provider groups when they sign in.',
  },
] as const;

export function AuthenticationPage() {
  return (
    <SettingsPage title="Authentication" description="How people sign in to this workspace.">
      <div className="-mt-2 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map((method) => (
            <AuthMethodCard key={method.id} method={method} />
          ))}
        </div>
        <Notice>
          Single sign-on arrives in a later release; until then everyone signs in with a password.
        </Notice>
        <Card>
          <CardBody layout="list">
            {POLICIES.map((policy) => (
              <SettingsRow
                key={policy.title}
                title={policy.title}
                description={policy.description}
                control={<Switch checked={false} disabled aria-label={policy.title} />}
              />
            ))}
          </CardBody>
        </Card>
      </div>
    </SettingsPage>
  );
}
