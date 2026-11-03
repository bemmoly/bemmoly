import { usePipelinesMe } from '../hooks/use-roles.ts';
import { visiblePlaces, type Place } from './places.ts';

/**
 * The places the signed-in person's role shows, from Pipelines' /me. Every place shows until
 * it answers; the route guard and the server still keep out what a role may not see.
 */
export function usePlaces(): readonly Place[] {
  const { data } = usePipelinesMe();
  return visiblePlaces(data?.places);
}
