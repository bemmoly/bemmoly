import { describe, expect, it } from 'vitest';
import { buildTree } from './org/org-tree.tsx';
import { resolvePeopleRoute } from './routes.tsx';

describe('People routes', () => {
  it('maps each subpath to its screen', () => {
    expect(resolvePeopleRoute('')?.name).toBe('directory');
    expect(resolvePeopleRoute('/p/u1')).toMatchObject({ name: 'p', props: { segment: 'u1' } });
    expect(resolvePeopleRoute('/time-off/new')).toMatchObject({
      name: 'time-off',
      props: { segment: 'new' },
    });
    expect(resolvePeopleRoute('/journeys/j1')?.props.segment).toBe('j1');
    expect(resolvePeopleRoute('/nowhere')).toBeNull();
  });
});

describe('the org tree', () => {
  const row = (userId: string, managerId: string | null) => ({ userId, managerId }) as never;

  it('puts people whose manager is not listed at the top', () => {
    const tree = buildTree([row('a', null), row('b', 'a'), row('c', 'b'), row('d', 'gone')]);
    expect(tree.roots.map((p: { userId: string }) => p.userId)).toEqual(['a', 'd']);
    expect(tree.children.get('b')?.map((p) => p.userId)).toEqual(['c']);
  });
});
