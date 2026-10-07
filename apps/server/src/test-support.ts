import { loadModules, type BemmolyModule, type ModuleRegistry } from '@bemmoly/core';
import { importAvailableModules } from './config/modules.ts';

export const TEST_ENV = {
  BEMMOLY_TRUST_PROXY: false,
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  BEMMOLY_PUBLIC_URL: 'http://localhost:8080',
} as const;

export async function shippedModules(): Promise<ModuleRegistry> {
  return loadModules({ available: await importAvailableModules() });
}

export function modulesOf(...available: BemmolyModule[]): ModuleRegistry {
  return loadModules({ available });
}
