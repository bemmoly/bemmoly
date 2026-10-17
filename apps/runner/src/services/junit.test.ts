import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { testReportUploadSchema } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { collectJUnit, parseJUnit, summarise } from './junit.ts';

const FIXTURES = path.resolve(import.meta.dirname, '../../test/fixtures');
const fixture = (name: string) => readFile(path.join(FIXTURES, name), 'utf8');

describe('JUnit parsing', () => {
  it('reads passes, failures, errors and skips across nested suites', async () => {
    const cases = parseJUnit(await fixture('junit-mixed.xml'));
    expect(cases).toEqual([
      {
        file: 'src/cart.test.ts',
        name: 'adds an item',
        line: 12,
        outcome: 'passed',
        durationMs: 12,
        message: null,
      },
      {
        file: 'src/cart.test.ts',
        name: 'removes an item',
        line: null,
        outcome: 'failed',
        durationMs: 500,
        message: 'expected 1 to be 0',
      },
      {
        file: 'src/cart.test.ts',
        name: 'later',
        line: null,
        outcome: 'skipped',
        durationMs: 0,
        message: 'not yet',
      },
      {
        file: 'com/acme/shop/CheckoutTest',
        name: 'pays',
        line: null,
        outcome: 'failed',
        durationMs: 1250,
        message: expect.stringContaining('NullPointerException'),
      },
      {
        file: 'com/acme/shop/CheckoutTest',
        name: 'refunds',
        line: null,
        outcome: 'passed',
        durationMs: 0,
        message: null,
      },
    ]);
  });

  it('summarises into the upload the contract accepts', async () => {
    const report = summarise(parseJUnit(await fixture('junit-mixed.xml')));
    expect(report).toMatchObject({ total: 5, passed: 2, failed: 2, skipped: 1, durationMs: 1762 });
    expect(testReportUploadSchema.safeParse(report).success).toBe(true);
  });

  it('refuses a document that is not XML', async () => {
    expect(() => parseJUnit(`not xml at all <<`)).toThrow(/Not valid JUnit XML/);
  });

  it('collects every matching file and names the ones it could not read', async () => {
    const { report, files, problems } = await collectJUnit('junit-*.xml', FIXTURES);
    expect(files).toEqual(['junit-broken.xml', 'junit-mixed.xml', 'junit-single.xml']);
    expect(problems.map((p) => p.file)).toEqual(['junit-broken.xml']);
    expect(report).toMatchObject({ total: 6, passed: 3 });
  });
});
