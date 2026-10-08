import { Badge, SelectableCard } from '@bemmoly/ui';
import type { ReactNode } from 'react';

interface BrandTileProps {
  /** Shown when there is no icon, as in the Setup mock. */
  initials: string;
  /** A logo or glyph, drawn about 18px inside the tile. */
  icon?: ReactNode;
}

/** The 32px tile from the Setup mock's option cards: a logo or glyph, else initials. */
export function BrandTile({ initials, icon }: BrandTileProps) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-panel bg-chip text-12 font-semibold text-tx2"
    >
      {icon ?? initials}
    </span>
  );
}

/**
 * A one-colour logo file used as a mask over the text colour, so every mark (providers,
 * import sources) follows the theme whatever colour the file was drawn in.
 */
export function LogoMask({ url }: { url: string }) {
  return (
    <span
      aria-hidden="true"
      data-logo={url}
      className="size-4.5 bg-current mask-contain mask-center mask-no-repeat"
      style={{ maskImage: `url("${url}")` }}
    />
  );
}

/** The badge an option shows until its feature ships. */
export function ComingSoonBadge() {
  return (
    <Badge tone="neutral" className="ml-auto">
      COMING SOON
    </Badge>
  );
}

interface ChoiceCardProps {
  initials: string;
  icon?: ReactNode;
  name: string;
  description?: ReactNode;
  /** A mono line such as a catalog id, for cards without a description. */
  detail?: string;
  badge?: string | null;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown but not selectable; stays focusable so its description is still read out. */
  comingSoon?: boolean;
}

/** A Setup option card: tile, 14px name, optional badge, then the description. */
export function ChoiceCard({
  initials,
  icon,
  name,
  description,
  detail,
  badge,
  selected,
  onSelect,
  disabled,
  comingSoon,
}: ChoiceCardProps) {
  return (
    <SelectableCard
      selected={selected && !comingSoon}
      onClick={comingSoon ? undefined : onSelect}
      disabled={disabled}
      aria-disabled={comingSoon || undefined}
      className={comingSoon ? 'cursor-not-allowed' : 'disabled:cursor-not-allowed'}
    >
      <span className="flex w-full items-center gap-2.5">
        <BrandTile initials={initials} icon={icon} />
        <span
          title={name}
          className={`min-w-0 truncate text-14 font-semibold ${comingSoon ? 'text-tx3' : ''}`}
        >
          {name}
        </span>
        {comingSoon ? (
          <ComingSoonBadge />
        ) : badge ? (
          <Badge tone="accent" className="ml-auto">
            {badge}
          </Badge>
        ) : null}
      </span>
      {description ? (
        <span className={`text-12h leading-body ${comingSoon ? 'text-tx5' : 'text-tx4'}`}>
          {description}
        </span>
      ) : null}
      {detail ? <span className="font-mono text-12 text-tx4">{detail}</span> : null}
    </SelectableCard>
  );
}
