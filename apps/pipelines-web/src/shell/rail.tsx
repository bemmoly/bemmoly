import { useT } from '@bemmoly/core-web';
import { Logo } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import type { PipelinesMode } from '../hooks/use-mode.ts';
import { useBrowserPath } from '../hooks/use-browser-path.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { PersonMenu } from './person-menu.tsx';
import { PlaceLink } from './place-link.tsx';
import { PLACES, placeAt, SETTINGS } from './places.ts';

/**
 * The 72px rail: the Bemmoly mark, the seven places, then Settings and the person at its
 * foot. Hidden below 768px, where the phone bar takes over.
 */
export function Rail({ mode, onToggleMode }: { mode: PipelinesMode; onToggleMode: () => void }) {
  const t = useT(pipelinesText);
  const pathname = useBrowserPath();
  const current = placeAt(pathname);
  return (
    <nav
      aria-label={t('pipelines.shell.mainNavigation')}
      className="hidden w-18 shrink-0 flex-col items-center gap-1 border-e border-line bg-side py-2.5 md:flex"
    >
      <Link
        to="/"
        className="mb-2 grid size-10 place-items-center rounded-control focus-ring"
        aria-label={t('pipelines.shell.product')}
      >
        <Logo variant="mark" size={26} label="" />
      </Link>
      {PLACES.map((place) => (
        <PlaceLink key={place.id} place={place} active={current?.id === place.id} layout="rail" />
      ))}
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <PlaceLink place={SETTINGS} active={current?.id === 'settings'} layout="rail" />
        <PersonMenu mode={mode} onToggleMode={onToggleMode} />
      </div>
    </nav>
  );
}
