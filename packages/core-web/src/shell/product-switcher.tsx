import { Menu, MenuItem, MenuSeparator, Tooltip, type MenuTriggerProps } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { ModuleTile } from './module-tile.tsx';
import type { Product } from './products.ts';

export interface ProductSwitcherProps {
  products: readonly Product[];
  /** The product the person is in; the start page when none. */
  currentId?: string;
  /** Opens the start page or a product: a route in this app, or a page load into another. */
  onOpen: (path: string, product?: Product) => void;
  startPath: string;
  /** Where the tooltip sits: right of the rail, below a top bar. */
  side?: 'right' | 'bottom';
  /** The trigger's classes, so each shell sizes it as its other buttons. */
  className?: string;
  /** Start open, for a story or a screenshot. */
  defaultOpen?: boolean;
}

/**
 * The grid button in every product's shell: back to the start page, or across to another
 * product the person can use. It lists only those; a product they have no access to never
 * shows, so the menu never offers a door that will not open.
 */
export function ProductSwitcher({
  products,
  currentId,
  onOpen,
  startPath,
  side = 'bottom',
  className,
  defaultOpen = false,
}: ProductSwitcherProps) {
  const label = 'Switch product';
  return (
    <Menu
      align="start"
      widthClassName="w-60"
      defaultOpen={defaultOpen}
      trigger={(props: MenuTriggerProps) => (
        <Tooltip label={label} side={side}>
          <button
            type="button"
            {...props}
            aria-label={label}
            data-testid="product-switcher"
            className={className}
          >
            <Icon name="grid" size={16} />
          </button>
        </Tooltip>
      )}
    >
      <MenuItem
        icon={<Icon name="home" />}
        checked={currentId === undefined}
        onSelect={() => onOpen(startPath)}
      >
        Start page
      </MenuItem>
      <MenuSeparator />
      {products.map((product) => (
        <MenuItem
          key={product.id}
          icon={<ModuleTile manifest={product.manifest} size={18} />}
          checked={product.id === currentId}
          onSelect={() => onOpen(product.path, product)}
        >
          {product.name}
        </MenuItem>
      ))}
    </Menu>
  );
}
