import {
  createSsoProviderSchema,
  type CreateSsoProviderInput,
  type SsoProvider,
  type SsoRoleMapping,
  type SsoTeamMapping,
} from '@bemmoly/shared';
import { useState } from 'react';
import { validateForm, type FieldErrors } from '../lib/errors.ts';
import type { SsoPreset } from '../lib/sso-presets.ts';

/** The provider form's values, as typed: lists as text and rows, secrets empty until typed. */
export interface ProviderDraft {
  displayName: string;
  enabled: boolean;
  autoProvision: boolean;
  defaultRoleId: string;
  domains: string;
  roleMappings: SsoRoleMapping[];
  teamMappings: SsoTeamMapping[];
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  groupsClaim: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificate: string;
}

export function draftFor(preset: SsoPreset, provider?: SsoProvider): ProviderDraft {
  const config = provider?.config;
  return {
    displayName:
      provider?.displayName ?? (preset.protocol === 'saml' ? 'Single sign-on' : preset.name),
    enabled: provider?.enabled ?? true,
    autoProvision: provider?.autoProvision ?? true,
    defaultRoleId: provider?.defaultRoleId ?? '',
    domains: provider?.allowedDomains.join(', ') ?? '',
    roleMappings: provider?.roleMappings ?? [],
    teamMappings: provider?.teamMappings ?? [],
    issuerUrl: config?.protocol === 'oidc' ? config.issuerUrl : preset.issuerUrl,
    clientId: config?.protocol === 'oidc' ? config.clientId : '',
    clientSecret: '',
    groupsClaim: config?.protocol === 'oidc' ? config.groupsClaim : 'groups',
    idpEntityId: config?.protocol === 'saml' ? config.idpEntityId : '',
    idpSsoUrl: config?.protocol === 'saml' ? config.idpSsoUrl : '',
    idpCertificate: '',
  };
}

const splitList = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

/** The request body, from the draft; an empty secret or certificate keeps the stored one. */
function inputOf(preset: SsoPreset, draft: ProviderDraft, provider?: SsoProvider) {
  const config =
    preset.protocol === 'oidc'
      ? {
          protocol: 'oidc' as const,
          issuerUrl: draft.issuerUrl.trim(),
          clientId: draft.clientId.trim(),
          groupsClaim: draft.groupsClaim.trim() || 'groups',
          ...(draft.clientSecret ? { clientSecret: draft.clientSecret } : {}),
        }
      : {
          protocol: 'saml' as const,
          idpEntityId: draft.idpEntityId.trim(),
          idpSsoUrl: draft.idpSsoUrl.trim(),
          idpCertificate: draft.idpCertificate.trim(),
        };
  return {
    displayName: draft.displayName.trim(),
    preset: preset.id,
    enabled: draft.enabled,
    autoProvision: draft.autoProvision,
    defaultRoleId: draft.defaultRoleId || null,
    allowedDomains: splitList(draft.domains),
    roleMappings: draft.roleMappings.filter((row) => row.group.trim() && row.roleId),
    teamMappings: draft.teamMappings.filter((row) => row.group.trim() && row.teamId),
    // A SAML edit with no new certificate leaves the configuration as stored.
    ...(preset.protocol === 'saml' && provider && !draft.idpCertificate.trim() ? {} : { config }),
  };
}

/** Form state for adding or editing one identity provider, validated by the shared schema. */
export function useSsoProviderForm(preset: SsoPreset, provider?: SsoProvider) {
  const [draft, setDraft] = useState(() => draftFor(preset, provider));
  const [errors, setErrors] = useState<FieldErrors>({});
  const set =
    <Key extends keyof ProviderDraft>(key: Key) =>
    (value: ProviderDraft[Key]) =>
      setDraft((current) => ({ ...current, [key]: value }));

  /** The validated body, or null with the field messages shown. */
  const build = (): CreateSsoProviderInput | null => {
    const input = inputOf(preset, draft, provider);
    const schema =
      provider && !('config' in input)
        ? createSsoProviderSchema.omit({ config: true })
        : createSsoProviderSchema;
    const result = validateForm(schema, input);
    if (result.errors) {
      setErrors(result.errors);
      return null;
    }
    setErrors({});
    return result.data as CreateSsoProviderInput;
  };
  return { draft, set, errors, setErrors, build };
}

export type SsoProviderForm = ReturnType<typeof useSsoProviderForm>;
