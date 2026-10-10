import type { ModuleManifest } from '@bemmoly/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createHomeSectionRegistry,
  HomeSections,
  type HomeSectionProps,
} from './home-sections.tsx';

const manifest = (id: string): ModuleManifest => ({ id, version: '0.1.0', navigation: [] });

function MyWork({ manifest }: HomeSectionProps) {
  return <section>My work from {manifest.id}</section>;
}

function Broken(): never {
  throw new Error('boom');
}

describe('home sections', () => {
  afterEach(cleanup);

  it('renders the sections of modules that ship one, in module order, once each', async () => {
    const load = vi.fn(async () => ({ default: MyWork }));
    const registry = createHomeSectionRegistry({ work: load, docs: load });
    expect(registry.has('work')).toBe(true);
    expect(registry.resolve('sample')).toBeNull();
    expect(registry.resolve('work')).toBe(registry.resolve('work'));
    render(
      <HomeSections
        modules={[manifest('docs'), manifest('sample'), manifest('work')]}
        registry={registry}
        loading={<p>Loading</p>}
        failed={() => null}
      />,
    );
    const sections = await screen.findAllByText(/My work from/);
    expect(sections.map((section) => section.textContent)).toEqual([
      'My work from docs',
      'My work from work',
    ]);
  });

  it('puts a module\u2019s aside card in the narrow column and nothing for modules without one', async () => {
    function Sprint() {
      return <aside>Sprint card</aside>;
    }
    const registry = createHomeSectionRegistry({
      work: async () => ({ default: MyWork, HomeAside: Sprint }),
      docs: async () => ({ default: MyWork }),
    });
    const { container } = render(
      <HomeSections
        slot="aside"
        modules={[manifest('docs'), manifest('work')]}
        registry={registry}
        loading={null}
        failed={() => null}
      />,
    );
    expect(await screen.findByText('Sprint card')).toBeTruthy();
    expect(container.textContent).toBe('Sprint card');
  });

  it('keeps Home working when one section fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const registry = createHomeSectionRegistry({
      broken: async () => ({ default: Broken }),
      work: async () => ({ default: MyWork }),
    });
    render(
      <HomeSections
        modules={[manifest('broken'), manifest('work')]}
        registry={registry}
        loading={null}
        failed={(failedManifest, error) => (
          <p>
            {failedManifest.id} failed: {error.message}
          </p>
        )}
      />,
    );
    expect(await screen.findByText('broken failed: boom')).toBeTruthy();
    expect(await screen.findByText('My work from work')).toBeTruthy();
  });
});
