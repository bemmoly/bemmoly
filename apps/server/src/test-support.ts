import { loadModules, type BemmolyModule, type ModuleRegistry } from '@bemmoly/core';
import { importAvailableModules } from './config/modules.ts';
import fixtureModule from './test-fixtures/module/module.ts';

export const TEST_ENV = {
  BEMMOLY_TRUST_PROXY: false,
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  BEMMOLY_PUBLIC_URL: 'http://localhost:8080',
} as const;

export async function shippedModules(): Promise<ModuleRegistry> {
  return loadModules({ available: await importAvailableModules() });
}

/** The shipped modules plus the test-only fixture, which proves the module contract. */
export async function modulesWithFixture(): Promise<BemmolyModule[]> {
  return [...(await importAvailableModules()), fixtureModule];
}

/**
 * The identity suite runs with only the fixture module: a module that ships
 * but is off (Work) is absent from the catalog, as it is before an admin
 * enables it.
 */
export function identityModules(): ModuleRegistry {
  return loadModules({ available: [fixtureModule] });
}

export function modulesOf(...available: BemmolyModule[]): ModuleRegistry {
  return loadModules({ available });
}
