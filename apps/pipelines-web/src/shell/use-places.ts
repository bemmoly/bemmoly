import { visiblePlaces, type Place } from './places.ts';

/**
 * The places the signed-in person's role shows. Every place until the role arrives from
 * Pipelines' /me (stream S1 reads `api.roles.me` here and passes its `places`).
 */
export function usePlaces(): readonly Place[] {
  return visiblePlaces(undefined);
}
