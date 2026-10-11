import type { SsoProtocol } from '@bemmoly/shared';
import data from '../data/sso-presets.json' with { type: 'json' };

/**
 * A single sign-on preset: a name, a protocol and hints for the form. Presets are data
 * (`src/data/sso-presets.json`); every provider is configured through the same generic OIDC or
 * SAML form, so no code path depends on which one is chosen.
 */
export interface SsoPreset {
  id: string;
  name: string;
  protocol: SsoProtocol;
  /** A file in assets/sso-logos, without `.svg`; null shows the key glyph. */
  logo: string | null;
  /** `image` keeps the mark's own colours; `mask` paints it in the text colour. */
  logoStyle: 'image' | 'mask';
  /** The issuer to start from, with {placeholders} for the admin to fill in. */
  issuerUrl: string;
  help: string;
}

export const SSO_PRESETS = data.presets as SsoPreset[];

export const GENERIC_PRESET: Record<SsoProtocol, string> = { oidc: 'oidc', saml: 'saml' };

export function presetById(id: string | null | undefined): SsoPreset | undefined {
  return SSO_PRESETS.find((preset) => preset.id === id);
}

/** The preset a provider was made from, else the generic one for its protocol. */
export function presetFor(provider: { preset: string | null; protocol: SsoProtocol }): SsoPreset {
  return (
    presetById(provider.preset) ?? (presetById(GENERIC_PRESET[provider.protocol]) as SsoPreset)
  );
}
