import { Badge, SelectableCard } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { markFill } from '../../lib/logo-colors.ts';

/**
 * How a coming-soon option is muted: tile, name and description fade together, so the logo
 * is never greyed on its own; the badge stays crisp because it says why.
 */
export const COMING_SOON_MUTE = 'opacity-60';

interface BrandTileProps {
  /** Shown when there is no icon, as in the Setup mock. */
  initials: string;
  /** A logo or glyph, drawn about 18px inside the tile. */
  icon?: ReactNode;
}

/**
 * The 32px tile from the Setup mock's option cards: a logo or glyph, else initials. The chip
 * and the tx2 initials are the mock's; logos choose their own colour (see LogoMask).
 */
export function BrandTile({ initials, icon }: BrandTileProps) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-control bg-sunken text-12 font-semibold text-tx-2"
    >
      {icon ?? initials}
    </span>
  );
}

/**
 * A one-colour logo file used as a mask, so the fill is ours whatever colour the file was
 * drawn in. A mark with a published brand colour is painted in it (adjusted per light or dark
 * until it holds 3:1 on every preset's tile); a monochrome mark, such as the models.dev
 * provider logos, is painted in the primary text colour at full strength.
 */
export function LogoMask({ url, brand }: { url: string; brand?: string }) {
  return (
    <span
      aria-hidden="true"
      data-logo={url}
      data-brand={brand}
      className={`size-4.5 mask-contain mask-center mask-no-repeat ${brand ? '' : 'bg-tx'}`}
      style={{
        maskImage: `url("${url}")`,
        ...(brand ? { backgroundColor: markFill(brand) } : {}),
      }}
    />
  );
}

/** The badge an option shows until its feature ships: the neutral chip, in sentence case. */
export function ComingSoonBadge() {
  return (
    <Badge tone="neutral" className="ml-auto">
      Coming soon
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
  const mute = comingSoon ? COMING_SOON_MUTE : '';
  return (
    <SelectableCard
      selected={selected && !comingSoon}
      onClick={comingSoon ? undefined : onSelect}
      disabled={disabled}
      aria-disabled={comingSoon || undefined}
      className={comingSoon ? 'cursor-not-allowed' : 'disabled:cursor-not-allowed'}
    >
      <span className="flex w-full items-center gap-2.5">
        <span className={`flex min-w-0 items-center gap-2.5 ${mute}`}>
          <BrandTile initials={initials} icon={icon} />
          <span title={name} className="min-w-0 truncate text-14 font-semibold">
            {name}
          </span>
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
        <span className={`text-13 leading-body text-tx-3 ${mute}`}>{description}</span>
      ) : null}
      {detail ? <span className={`font-mono text-12 text-tx-3 ${mute}`}>{detail}</span> : null}
    </SelectableCard>
  );
}
