import { describe, expect, it, vi } from 'vitest';
import { runDbCommand } from './commands.ts';
import { ChangelogError } from './errors.ts';
import type { KernelChangelogRunner } from './runner.ts';

function fakeRunner(overrides: Partial<KernelChangelogRunner> = {}): KernelChangelogRunner {
  return {
    update: vi.fn(async () => []),
    status: vi.fn(async () => [{ module: 'core', id: '0004-users' }]),
    validate: vi.fn(async () => []),
    plan: vi.fn(async () => []),
    history: vi.fn(async () => []),
    tag: vi.fn(),
    rollback: vi.fn(async () => []),
    rollbackPlan: vi.fn(async () => ({ steps: [], irreversible: [] })),
    ...overrides,
  } as KernelChangelogRunner;
}

const deps = (runner: KernelChangelogRunner) => ({
  runner,
  contexts: ['production'],
  enabledModules: ['sample'],
});

describe('runDbCommand', () => {
  it('reports pending changesets for the enabled modules and install contexts', async () => {
    const runner = fakeRunner();
    const result = await runDbCommand(['db', 'status'], deps(runner));
    expect(result).toEqual({ exitCode: 0, output: 'core: 1 pending\n  0004-users' });
    expect(runner.status).toHaveBeenCalledWith({ contexts: ['production'], modules: ['sample'] });
  });

  it('exits 1 when validation finds an error, and prints JSON on request', async () => {
    const problem = {
      module: 'core',
      id: '0001-a',
      problem: 'gap_in_order',
      message: 'gap',
    } as const;
    const runner = fakeRunner({ validate: vi.fn(async () => [problem]) });
    const result = await runDbCommand(['db', 'validate', '--json'], deps(runner));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual([problem]);
  });

  it('passes contexts and rollback targets through', async () => {
    const runner = fakeRunner();
    await runDbCommand(['db', 'plan', '--contexts', 'demo,test'], deps(runner));
    expect(runner.plan).toHaveBeenCalledWith({ contexts: ['demo', 'test'], modules: ['sample'] });
    await runDbCommand(['db', 'rollback', '--count', '2', '--module', 'sample'], deps(runner));
    expect(runner.rollback).toHaveBeenCalledWith('sample', { count: 2 });
    await runDbCommand(['db', 'rollback', '--to-tag', '1.2.4', '--dry-run'], deps(runner));
    expect(runner.rollbackPlan).toHaveBeenCalledWith('*', { toTag: '1.2.4' });
  });

  it('turns changelog errors into exit code 1 and bad usage into 2', async () => {
    const runner = fakeRunner({
      update: vi.fn(async () => {
        throw new ChangelogError('checksum_mismatch', 'core/0001-a changed after it ran');
      }),
    });
    expect(await runDbCommand(['db', 'update'], deps(runner))).toEqual({
      exitCode: 1,
      output: 'error: core/0001-a changed after it ran',
    });
    expect((await runDbCommand(['db', 'nope'], deps(runner))).exitCode).toBe(2);
    expect((await runDbCommand(['db', 'rollback'], deps(runner))).exitCode).toBe(2);
    expect((await runDbCommand(['db', 'status', '--bogus'], deps(runner))).exitCode).toBe(2);
  });
});
