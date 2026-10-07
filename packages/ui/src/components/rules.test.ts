import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

const sources = [...files(join(src, 'components')), ...files(join(src, 'icons'))].map((path) => ({
  path: relative(src, path),
  text: readFileSync(path, 'utf8'),
}));

/** Places allowed to use the reserved AI tokens: surfaces that show model output. */
const AI_ALLOWED = ['components/ai-surface/', 'components/command-palette/', 'components/toast/'];

describe('component source rules', () => {
  it('uses no literal colours; tokens are the only source', () => {
    for (const { path, text } of sources) {
      const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, path).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i);
    }
  });

  it('animates only behind motion-safe, so prefers-reduced-motion is respected', () => {
    for (const { path, text } of sources) {
      const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      const motion = code.match(/[\w:-]*(?:animate-|transition)[\w-]*/g) ?? [];
      for (const cls of motion) expect(`${path}: ${cls}`).toMatch(/motion-safe:|motion-reduce:/);
    }
  });

  it('keeps the AI tokens for AI surfaces only', () => {
    for (const { path, text } of sources) {
      const uses = /\b(?:bg|text|border|border-l|shadow)-ai(?:-[a-z0-9]+)?\b/.test(text);
      if (uses)
        expect(
          AI_ALLOWED.some((dir) => path.startsWith(dir)),
          path,
        ).toBe(true);
    }
  });

  it('keeps every source file under 300 lines', () => {
    for (const { path, text } of sources)
      expect(text.split('\n').length, path).toBeLessThanOrEqual(300);
  });
});
