import type { ModuleManifest } from '@bemmoly/shared';
import { moduleName } from './module-tile.tsx';

/** The start page, the suite's front door; every product's switcher returns to it. */
export const START_PATH = '/start';

/** One product the person can use, as the start page and the product switcher list it. */
export interface Product {
  id: string;
  name: string;
  manifest: ModuleManifest;
  /** Where it opens: its own area in Bemmoly's frame, or its own app's front door. */
  path: string;
  /** A product with its own web app (Pipelines): opening it loads that app. */
  ownApp: boolean;
}

/**
 * The person's products from the modules they may open (the server lists only those): the
 * frame's modules in sidebar order, then products with their own app.
 */
export function productsOf(manifests: readonly ModuleManifest[]): Product[] {
  return manifests
    .map((manifest, index) => ({ manifest, index, ownApp: manifest.surface === 'product' }))
    .sort(
      (a, b) =>
        Number(a.ownApp) - Number(b.ownApp) ||
        (a.manifest.order ?? 50) - (b.manifest.order ?? 50) ||
        a.index - b.index,
    )
    .map(({ manifest, ownApp }) => ({
      id: manifest.id,
      name: moduleName(manifest),
      manifest,
      path: ownApp ? `/${manifest.id}` : (manifest.sidebar?.path ?? `/${manifest.id}`),
      ownApp,
    }));
}

/** The product whose area the address is in. */
export function productAt(products: readonly Product[], pathname: string): Product | undefined {
  return products.find(
    (product) => pathname === `/${product.id}` || pathname.startsWith(`/${product.id}/`),
  );
}
