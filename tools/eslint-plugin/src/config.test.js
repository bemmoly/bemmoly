import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Lints virtual files through the repository's real eslint.config.js, proving
 * that the boundary and file-size rules are wired in and fail the build.
 */
const root = path.resolve(import.meta.dirname, '../../..');
const eslint = new ESLint({ cwd: root });

async function ruleIds(rel, code) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, rel) });
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId);
}

describe('repository ESLint config', () => {
  it('fails a module that imports another module', async () => {
    const ids = await ruleIds(
      'modules/sample/server/src/services/fixture.ts',
      "import { docs } from '@bemmoly/module-docs';\nexport const value = docs;\n",
    );
    expect(ids).toContain('bemmoly/boundaries');
  });

  it('fails a kernel service that imports a controller', async () => {
    const ids = await ruleIds(
      'packages/core/src/services/system/fixture.ts',
      "import { createHealthController } from '../../controllers/health.controller.ts';\nexport const c = createHealthController;\n",
    );
    expect(ids).toContain('bemmoly/boundaries');
  });

  it('fails an app that imports a module package', async () => {
    const ids = await ruleIds(
      'apps/server/src/fixture.ts',
      "import sample from '@bemmoly/module-sample';\nexport default sample;\n",
    );
    expect(ids).toContain('bemmoly/boundaries');
  });

  it('fails a file over 300 lines, counting blank lines and comments', async () => {
    const code = `${Array.from({ length: 300 }, (_, i) => (i % 2 ? '' : `// line ${i}`)).join('\n')}\nexport const x = 1;\n`;
    const ids = await ruleIds('packages/shared/src/fixture.ts', code);
    expect(ids).toContain('max-lines');
  });

  it('fails reading process.env outside config/env.ts', async () => {
    const ids = await ruleIds(
      'packages/core/src/services/system/fixture.ts',
      "export const p = process.env['PORT'];\n",
    );
    expect(ids).toContain('no-restricted-properties');
  });

  it('passes a module that stays inside its folder and the kernel', async () => {
    const ids = await ruleIds(
      'modules/sample/server/src/services/fixture.ts',
      "import { defineModule } from '@bemmoly/core';\nimport { local } from './local.ts';\nexport const value = [defineModule, local];\n",
    );
    expect(ids).toEqual([]);
  });

  it('fails a glyph character set as an icon in UI code', async () => {
    const ids = await ruleIds(
      'packages/ui/src/components/fixture.tsx',
      'export const Done = () => <span>✓</span>;\n',
    );
    expect(ids).toContain('bemmoly/no-glyph-characters');
  });
});
