import { isThemeId, RETIRED_PRESETS } from '@bemmoly/ui/tokens';
import type { MockDb } from './db.ts';
import { ssoOf } from './routes/sso.ts';
import { seedAcmeLogo } from './seed/logo.ts';

const MODES = ['light', 'dark', 'system'] as const;

/** The providers `?sso=` seeds, from the presets the sign-in page knows marks for. */
const PROVIDERS = [
  { id: '0192a000-0000-7000-8000-000000000001', displayName: 'Okta', preset: 'okta' },
  {
    id: '0192a000-0000-7000-8000-000000000002',
    displayName: 'Google Workspace',
    preset: 'google-workspace',
  },
  {
    id: '0192a000-0000-7000-8000-000000000003',
    displayName: 'Microsoft Entra ID',
    preset: 'entra-id',
  },
] as const;

/**
 * Query parameters that set up the sign-in pages in the dev mock and the demo, so every state
 * can be opened from a URL:
 *
 * - `theme=pine&mode=dark`: the workspace look (a retired preset id maps to its theme);
 * - `logo=acme`: Acme Labs' own logo, so "Powered by Bemmoly" shows at the foot;
 * - `sso=1|3`: one provider (Okta) or three (Okta, Google Workspace, Entra ID); `sso=required`
 *   is Okta as the only way in, with Rohan as the password fallback; `sso=google` is Google
 *   Workspace alone, a full-colour mark;
 * - `down=1`: the server stops answering sign-in and /readyz;
 * - `pdf=on|off`: the optional PDF renderer runs, or not (Export as PDF);
 * - `deactivate=<email>`: that person's account is turned off.
 */
export function applyAuthParams(db: MockDb, params: URLSearchParams): void {
  const asked = params.get('theme') ?? '';
  const retired = RETIRED_PRESETS[asked];
  const theme = isThemeId(asked) ? asked : retired?.theme;
  if (theme) db.settings['appearance.theme'] = theme;
  if (retired) db.settings['appearance.font'] = retired.font;
  const mode = MODES.find((entry) => entry === params.get('mode')) ?? retired?.mode;
  if (mode) db.settings['appearance.defaultMode'] = mode;
  if (params.get('logo') === 'acme') seedAcmeLogo(db);
  if (params.get('logo') === 'none') db.settings['appearance.logoKey'] = '';
  const sso = params.get('sso');
  if (sso) seedProviders(db, sso);
  if (params.has('down')) db.authDown = params.get('down') !== '0';
  if (params.has('pdf')) db.pdfRenderer = params.get('pdf') === 'on';
  const off = params.get('deactivate')?.toLowerCase();
  const user = off ? db.users.find((entry) => entry.email === off) : undefined;
  if (user) user.status = 'deactivated';
}

function seedProviders(db: MockDb, value: string) {
  const state = ssoOf(db);
  const count = value === '3' ? 3 : value === '0' ? 0 : 1;
  const now = new Date().toISOString();
  const chosen = value === 'google' ? PROVIDERS.slice(1, 2) : PROVIDERS.slice(0, count);
  state.providers = chosen.map((provider) => ({
    // Fixed ids, so a remembered "Last used" provider survives a reload of the mock.
    id: provider.id,
    displayName: provider.displayName,
    protocol: 'oidc' as const,
    preset: provider.preset,
    enabled: true,
    config: {
      protocol: 'oidc' as const,
      issuerUrl: `https://${provider.preset}.example.com`,
      clientId: 'bemmoly',
      hasClientSecret: true,
      scopes: ['openid', 'email', 'profile'],
    },
    access: { jitProvisioning: true, allowedDomains: [], defaultRoleId: null },
    createdAt: now,
    updatedAt: now,
  })) as unknown as typeof state.providers;
  state.requireSso = value === 'required';
}
