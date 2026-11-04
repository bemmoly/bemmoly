import type { ReactNode } from 'react';
import { useBrowserPath } from '../hooks/use-browser-path.ts';
import { usePipelinesMe } from '../hooks/use-roles.ts';
import { NotInvitedScreen, NotInViewScreen } from '../screens/roles/not-in-view.tsx';
import { placeAt } from './places.ts';

/**
 * Roles decide what you see: a place the person's role leaves out shows "Not part of your
 * view" instead of its screen, whatever the address. Settings is everyone's.
 */
export function PlaceGuard({ children }: { children: ReactNode }) {
  const pathname = useBrowserPath();
  const { data: me } = usePipelinesMe();
  if (!me) return children;
  if (!me.role) return <NotInvitedScreen />;
  const place = placeAt(pathname);
  if (place?.key && !me.places.includes(place.key)) {
    return <NotInViewScreen name={me.user.name} role={me.role} place={place} />;
  }
  return children;
}
