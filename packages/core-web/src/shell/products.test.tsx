import type { ModuleManifest } from '@bemmoly/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductSwitcher } from './product-switcher.tsx';
import { productAt, productsOf } from './products.ts';

const manifest = (id: string, extra: Partial<ModuleManifest> = {}): ModuleManifest => ({
  id,
  version: '0.1.0',
  navigation: [],
  ...extra,
});

const MANIFESTS = [
  manifest('pipelines', { name: 'Pipelines', surface: 'product' }),
  manifest('docs', { name: 'Docs', order: 20 }),
  manifest('work', {
    name: 'Work',
    order: 10,
    sidebar: { path: '/work/projects', links: [], primary: [] },
  }),
];

describe('the person’s products', () => {
  it('lists frame modules in sidebar order, then products with their own app', () => {
    const products = productsOf(MANIFESTS);
    expect(products.map((product) => [product.id, product.path, product.ownApp])).toEqual([
      ['work', '/work/projects', false],
      ['docs', '/docs', false],
      ['pipelines', '/pipelines', true],
    ]);
    expect(productAt(products, '/work/issue/PLT-1')?.id).toBe('work');
    expect(productAt(products, '/start')).toBeUndefined();
    expect(productAt(products, '/workshop')).toBeUndefined();
  });
});

describe('ProductSwitcher', () => {
  afterEach(cleanup);

  it('opens the start page or a product, ticking where the person is', () => {
    const onOpen = vi.fn();
    const products = productsOf(MANIFESTS);
    render(
      <ProductSwitcher products={products} currentId="work" onOpen={onOpen} startPath="/start" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch product' }));
    expect(screen.getByRole('menuitemradio', { name: /Work/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.getByRole('menuitemradio', { name: /Start page/ }).getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Pipelines/ }));
    expect(onOpen).toHaveBeenCalledWith('/pipelines', products[2]);

    fireEvent.click(screen.getByRole('button', { name: 'Switch product' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Start page/ }));
    expect(onOpen).toHaveBeenLastCalledWith('/start');
  });

  it('lists only the products it is given', () => {
    render(
      <ProductSwitcher
        products={productsOf([manifest('docs', { name: 'Docs' })])}
        onOpen={() => undefined}
        startPath="/start"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch product' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe('Start page');
    expect(items[1]?.textContent).toMatch(/Docs$/);
  });
});
