import { useT } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { pipelinesText } from '../i18n/catalog.ts';
import type { Place } from './places.ts';

const keepScope = (previous: { scope?: string }) =>
  previous.scope ? { scope: previous.scope } : {};

/**
 * One place in the rail or the phone bar: an 18px icon over an 11px label, because people new
 * to the product read before they memorise. Moving between scoped screens keeps the scope.
 */
export function PlaceLink({
  place,
  active,
  layout,
}: {
  place: Place;
  active: boolean;
  layout: 'rail' | 'bar';
}) {
  const t = useT(pipelinesText);
  const label = t(`pipelines.shell.place.${place.id}`);
  return (
    <Link
      to={place.path}
      search={place.scoped ? keepScope : {}}
      aria-current={active ? 'page' : undefined}
      title={layout === 'rail' ? `${label} (${place.keys})` : undefined}
      className={[
        'flex flex-col items-center justify-center gap-1 rounded-control text-11 font-medium focus-ring',
        'motion-safe:transition-colors motion-safe:duration-(--duration-fast)',
        layout === 'rail' ? 'h-13 w-15' : 'h-12 min-w-0 flex-1',
        active ? 'bg-acc-50 text-acc' : 'text-tx-2 hover:bg-hover hover:text-tx',
      ].join(' ')}
    >
      <Icon name={place.icon} size={18} />
      <span className="max-w-full truncate px-0.5">{label}</span>
    </Link>
  );
}
