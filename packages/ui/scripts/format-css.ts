import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { renderCssFiles } from '../src/css.ts';

/** Generated CSS as committed: formatted with the repository's Prettier config. */
export async function formattedCssFiles(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [path, css] of Object.entries(renderCssFiles())) {
    const file = join(dirname(fileURLToPath(import.meta.url)), '../src', path);
    const config = (await resolveConfig(file)) ?? {};
    out[path] = await format(css, { ...config, parser: 'css' });
  }
  return out;
}
