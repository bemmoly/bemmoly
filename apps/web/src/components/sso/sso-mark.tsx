import { Icon } from '@bemmoly/ui/icons';
import { ssoLogoUrl } from '../../lib/sso-logos.ts';
import type { SsoPreset } from '../../lib/sso-presets.ts';
import { BrandTile, LogoMask } from '../setup/choice-card.tsx';

/**
 * A preset's mark, about 18px: its own colours, a one-colour mask, or the key glyph. `ink` is the
 * mask's fill class when it sits on a coloured surface (the key follows the text colour).
 */
export function SsoMark({
  preset,
  ink,
}: {
  preset: Pick<SsoPreset, 'logo' | 'logoStyle'>;
  ink?: string;
}) {
  const url = ssoLogoUrl(preset.logo);
  if (!url) return <Icon name="key" size={16} />;
  if (preset.logoStyle === 'image') return <img src={url} alt="" className="size-4.5" />;
  return <LogoMask url={url} fill={ink} />;
}

/** The 32px tile the method cards and preset choices share. */
export function SsoTile({ preset }: { preset: SsoPreset }) {
  return <BrandTile initials={preset.name.slice(0, 2)} icon={<SsoMark preset={preset} />} />;
}
