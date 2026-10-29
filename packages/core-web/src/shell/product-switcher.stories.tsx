import type { ModuleManifest } from '@bemmoly/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductSwitcher } from './product-switcher.tsx';
import { productsOf } from './products.ts';

const manifest = (
  id: string,
  name: string,
  icon: string,
  color: ModuleManifest['color'],
  extra: Partial<ModuleManifest> = {},
): ModuleManifest => ({ id, name, version: '0.1.0', navigation: [], icon, color, ...extra });

const PRODUCTS = productsOf([
  manifest('work', 'Work', 'board', 'brand-1', { order: 10 }),
  manifest('docs', 'Docs', 'docs', 'brand-2', { order: 20 }),
  manifest('pipelines', 'Pipelines', 'rocket', 'accent', { surface: 'product' }),
]);

const TRIGGER =
  'grid size-7.5 cursor-pointer place-items-center rounded-control border-0 bg-card p-0 text-tx-2 shadow-e1 hover:text-tx focus-ring';

const meta = {
  title: 'Shell/Product switcher',
  component: ProductSwitcher,
  args: {
    products: PRODUCTS,
    startPath: '/start',
    onOpen: () => undefined,
    className: TRIGGER,
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ProductSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

/** On the start page: it is ticked, and every product the person can use is listed. */
export const OnStartPage: Story = { args: { defaultOpen: true } };

/** Inside Work: Work is ticked; the start page is one Enter away. */
export const InWork: Story = { args: { defaultOpen: true, currentId: 'work' } };

/** A person with only Docs sees only Docs. */
export const OneProduct: Story = {
  args: { defaultOpen: true, products: PRODUCTS.filter((product) => product.id === 'docs') },
};
