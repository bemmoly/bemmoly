import { Icon } from '@bemmoly/ui/icons';
import { ssoLogoUrl } from '../../lib/sso-logos.ts';
import type { SsoPreset } from '../../lib/sso-presets.ts';
import { BrandTile, LogoMask } from '../setup/choice-card.tsx';

/** A preset's mark, about 18px: its own colours, a one-colour mask, or the key glyph. */
export function SsoMark({ preset }: { preset: Pick<SsoPreset, 'logo' | 'logoStyle'> }) {
  const url = ssoLogoUrl(preset.logo);
  if (!url) return <Icon name="key" size={16} />;
  if (preset.logoStyle === 'image') return <img src={url} alt="" className="size-4.5" />;
  return <LogoMask url={url} />;
}

/** The 32px tile the method cards and preset choices share. */
export function SsoTile({ preset }: { preset: SsoPreset }) {
  return <BrandTile initials={preset.name.slice(0, 2)} icon={<SsoMark preset={preset} />} />;
}
