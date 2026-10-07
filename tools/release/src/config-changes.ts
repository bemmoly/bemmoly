/** Configuration changes between two releases, read from apps/server/.env.example. */

export const ENV_EXAMPLE_PATH = 'apps/server/.env.example';

export interface ConfigChanges {
  added: string[];
  removed: string[];
}

export function envKeys(envExample: string): Set<string> {
  const keys = new Set<string>();
  for (const line of envExample.split('\n')) {
    const key = /^([A-Z][A-Z0-9_]*)=/.exec(line.trim())?.[1];
    if (key) keys.add(key);
  }
  return keys;
}

export function diffConfig(before: string, after: string): ConfigChanges {
  const old = envKeys(before);
  const next = envKeys(after);
  return {
    added: [...next].filter((key) => !old.has(key)).sort(),
    removed: [...old].filter((key) => !next.has(key)).sort(),
  };
}
