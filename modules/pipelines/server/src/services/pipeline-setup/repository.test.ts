import { describe, expect, it } from 'vitest';
import { candidateFiles, importFile } from './repository.ts';

const WORKFLOW = `
name: Deploy
on: push
jobs:
  test:
    name: Unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test
  deploy:
    needs: test
    steps:
      - uses: some/deploy-action@v2
        name: Deploy to the cloud
      - run: ./scripts/smoke.sh
`;

describe('pipelines from repository files', () => {
  it('lists workflow and Bemmoly files, the service folder only for Bemmoly ones', () => {
    const tree = {
      commitSha: 'abc',
      read: async () => null,
      paths: [
        '.github/workflows/deploy.yml',
        'services/orders/.bemmoly/deliver.yml',
        'services/other/.bemmoly/deliver.yml',
        'README.md',
      ],
    };
    expect(candidateFiles(tree, 'services/orders')).toEqual([
      { path: 'services/orders/.bemmoly/deliver.yml', kind: 'bemmoly' },
      { path: '.github/workflows/deploy.yml', kind: 'github_actions' },
    ]);
  });

  it("reads a workflow's run steps, one step per job, naming what it cannot run", () => {
    const { definition, skipped } = importFile(WORKFLOW, '.github/workflows/deploy.yml');
    expect(
      'test' in definition && definition.test?.map((step) => [step.key, step.run, step.needs]),
    ).toEqual([
      ['test', 'pnpm install\npnpm test', []],
      ['deploy', './scripts/smoke.sh', ['test']],
    ]);
    expect(skipped).toEqual(['Deploy to the cloud (deploy)']);
  });

  it('reads a Bemmoly file as written, and refuses one that is not a pipeline', () => {
    const { definition } = importFile(
      'test:\n  - name: Unit\n    image: node:24\n    run: pnpm test\n',
      '.bemmoly/deliver.yml',
    );
    expect('test' in definition && definition.test?.[0]?.name).toBe('Unit');
    expect(() => importFile('- just a list', '.bemmoly/deliver.yml')).toThrow(/not a pipeline/);
  });
});
