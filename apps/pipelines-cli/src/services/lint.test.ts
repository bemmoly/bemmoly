import { describe, expect, it } from 'vitest';
import { formatProblem, kindOf, lintText } from './lint.ts';

const FILE = 'checkout/.bemmoly/application.yaml';

describe('bp lint', () => {
  it('passes a valid application file', () => {
    const text = 'name: checkout-api\ngroup: checkout\nowner: team/payments\ntier: 0\n';
    expect(lintText(FILE, text)).toEqual([]);
  });

  it('points at the line and column of each problem, in order', () => {
    const text = [
      'name: checkout-api',
      'group: checkout',
      'ownr: team/payments',
      'tier: 5',
      'pipeline:',
      '  extends: acme/node-service@3',
      '  test:',
      '    - name: Unit',
      '      run: pnpm test',
      '      uses: acme/scan@2',
    ].join('\n');
    expect(lintText(FILE, text).map(formatProblem)).toEqual([
      `${FILE}:3:1 Unknown key "ownr"`,
      `${FILE}:4:7 tier: A tier is 0, 1 or 2`,
      expect.stringMatching(/^checkout\/\.bemmoly\/application\.yaml:\d+:\d+ pipeline/),
    ]);
  });

  it('reports YAML that does not parse', () => {
    const [problem] = lintText(FILE, 'name: [unclosed\n');
    expect(problem).toMatchObject({ file: FILE, line: expect.any(Number) });
  });

  it('reads other files as pipeline templates', () => {
    expect(kindOf('templates/.bemmoly/node-service.yaml')).toBe('template');
    expect(kindOf(FILE)).toBe('application');
    const problems = lintText('t.yaml', 'build: { dockerfile: Dockerfile }\ntset: []\n');
    expect(problems.map((p) => p.message)).toEqual(['Unknown key "tset"']);
  });
});
