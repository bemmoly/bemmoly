import type { BemmolyModule } from '@bemmoly/core';

/**
 * Module packages shipped in this image. The host resolves them by name at boot
 * and never imports a module directly; which ones run is BEMMOLY_MODULES.
 */
export const MODULE_PACKAGES: readonly string[] = ['@bemmoly/module-sample'];

export async function importAvailableModules(
  packages: readonly string[] = MODULE_PACKAGES,
): Promise<BemmolyModule[]> {
  return Promise.all(
    packages.map(async (name) => {
      const loaded = (await import(name)) as { default: BemmolyModule };
      return loaded.default;
    }),
  );
}
