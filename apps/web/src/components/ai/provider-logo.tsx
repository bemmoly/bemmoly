import { Icon } from '@bemmoly/ui/icons';
import { initialsOf } from '../../hooks/use-ai-catalog.ts';
import { providerLogoUrl } from '../../lib/provider-logos.ts';
import { BrandTile, LogoMask } from '../setup/choice-card.tsx';

/**
 * The provider's mark for an option card's tile; undefined lets the tile show initials. The
 * logo bundled with the web build wins (it renders offline and in the demo); otherwise the
 * server's cached copy of the catalog's logo. The models.dev files are monochrome with no
 * brand colour, so they take the primary text colour.
 */
export function providerIcon(id: string, logoUrl?: string | null) {
  // A Local server (catalog id "custom" once connected, "local" in the picker) is a server.
  if (id === 'custom' || id === 'local') return <Icon name="server" />;
  const url = providerLogoUrl(id) ?? logoUrl ?? null;
  return url ? <LogoMask url={url} /> : undefined;
}

/** A provider's 32px tile: its logo, or its initials when there is none. */
export function ProviderLogo({
  id,
  name,
  logoUrl,
}: {
  id: string;
  name: string;
  logoUrl?: string | null;
}) {
  return <BrandTile initials={initialsOf(name)} icon={providerIcon(id, logoUrl)} />;
}
