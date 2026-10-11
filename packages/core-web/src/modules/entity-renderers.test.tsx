import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEntityRendererRegistry,
  EntityRenderersProvider,
  useEntityRenderer,
  type EntityRenderer,
} from './entity-renderers.tsx';

const issue: EntityRenderer = {
  kind: 'issue',
  Chip: ({ entityKey }) => <span>live {entityKey}</span>,
};

function Embed({ entityKey }: { entityKey: string }) {
  const renderer = useEntityRenderer('issue');
  return renderer?.Chip ? <renderer.Chip entityKey={entityKey} /> : <span>{entityKey}</span>;
}

describe('entity renderers', () => {
  afterEach(cleanup);

  it('draws with an enabled module’s renderer once its file loads, once', async () => {
    const load = vi.fn(async () => ({ default: [issue] }));
    const registry = createEntityRendererRegistry({ work: load });
    render(
      <EntityRenderersProvider registry={registry} moduleIds={['docs', 'work']}>
        <Embed entityKey="PLT-1" />
        <Embed entityKey="PLT-2" />
      </EntityRenderersProvider>,
    );
    expect(screen.getByText('PLT-1')).toBeTruthy();
    expect(await screen.findByText('live PLT-1')).toBeTruthy();
    expect(screen.getByText('live PLT-2')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(registry.peek('issue', ['work'])).toBe(issue);
    expect(registry.peek('page', ['work'])).toBeNull();
  });

  it('keeps the placeholder when the owner is off, failed, or there is no provider', async () => {
    const load = vi.fn(async () => ({ default: [issue] }));
    const off = createEntityRendererRegistry({ work: load });
    render(
      <EntityRenderersProvider registry={off} moduleIds={['docs']}>
        <Embed entityKey="PLT-3" />
      </EntityRenderersProvider>,
    );
    expect(screen.getByText('PLT-3')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();

    const failing = createEntityRendererRegistry({ work: () => Promise.reject(new Error('x')) });
    expect(await failing.load('work')).toEqual([]);
    expect(failing.peek('issue', ['work'])).toBeNull();

    render(<Embed entityKey="PLT-4" />);
    expect(screen.getByText('PLT-4')).toBeTruthy();
  });
});
