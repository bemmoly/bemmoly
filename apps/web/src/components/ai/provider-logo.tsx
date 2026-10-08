import { initialsOf } from '../../hooks/use-ai-catalog.ts';
import { providerLogoUrl } from '../../lib/provider-logos.ts';
import { BrandTile, LogoMask } from '../setup/choice-card.tsx';

/** The provider's mark for an option card's tile; undefined lets the tile show initials. */
export function providerIcon(id: string) {
  const url = providerLogoUrl(id);
  return url ? <LogoMask url={url} /> : undefined;
}

/** A provider's 32px tile: its bundled logo, or its initials when none is bundled. */
export function ProviderLogo({ id, name }: { id: string; name: string }) {
  return <BrandTile initials={initialsOf(name)} icon={providerIcon(id)} />;
}
