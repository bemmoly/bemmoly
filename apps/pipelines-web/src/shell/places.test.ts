import { ROLE_PLACES } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { phonePlaces, visiblePlaces } from './places.ts';

describe('the places a role shows', () => {
  it('shows every place until the role is known', () => {
    expect(visiblePlaces(undefined).map((place) => place.id)).toEqual([
      'forYou',
      'services',
      'runs',
      'changes',
      'environments',
      'platform',
    ]);
  });

  it('shows an approver For you and Changes only', () => {
    expect(visiblePlaces(ROLE_PLACES.approver).map((place) => place.id)).toEqual([
      'forYou',
      'changes',
    ]);
  });

  it('puts the fifth place onwards and Settings behind More on a phone', () => {
    const { bar, more } = phonePlaces(visiblePlaces(undefined));
    expect(bar).toHaveLength(4);
    expect(more.map((place) => place.id)).toEqual(['environments', 'platform', 'settings']);
  });
});
