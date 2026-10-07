import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCssFiles } from '../src/css.ts';

for (const [path, css] of Object.entries(renderCssFiles())) {
  const file = fileURLToPath(new URL(`../src/${path}`, import.meta.url));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, css);
}
