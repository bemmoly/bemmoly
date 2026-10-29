import { describe, expect, it } from 'vitest';
import { makeStep } from '../../test/fake-control-plane.ts';
import type { DockerCall, DockerEngine } from '../clients/docker-engine.ts';
import { DockerExecutor } from './docker.ts';

/** Answers every call with nothing, as a daemon that has every image would. */
function recordingEngine() {
  const calls: DockerCall[] = [];
  const engine = {
    json: (call: DockerCall) => {
      calls.push(call);
      if (call.path.startsWith('/containers/create')) return Promise.resolve({ Id: 'c1' });
      if (call.path.endsWith('/wait')) return Promise.resolve({ StatusCode: 0 });
      return Promise.resolve(undefined);
    },
    stream: (call: DockerCall) => {
      calls.push(call);
      return Promise.resolve((async function* () {})());
    },
  };
  return { calls, engine: engine as unknown as DockerEngine };
}

const options = (lines: string[]) => ({
  workspace: '/tmp/ws',
  env: {},
  onLine: (line: string) => lines.push(line),
  label: 'job-1',
});

describe('a step image', () => {
  it.each(['alpine?all=1', 'alpine/../../containers/abc', 'Alpine:3.20'])(
    'refuses %s before calling Docker',
    async (image) => {
      const { calls, engine } = recordingEngine();
      const lines: string[] = [];
      const result = await new DockerExecutor(engine).run(
        makeStep('test', 'true', { image }),
        options(lines),
      );
      expect(result.exitCode).toBe(1);
      expect(calls).toEqual([]);
      expect(lines.at(-1)).toMatch(/is not an image name/);
    },
  );

  it('is encoded in the Engine API path', async () => {
    const { calls, engine } = recordingEngine();
    await new DockerExecutor(engine).run(
      makeStep('test', 'true', { image: 'ghcr.io/acme/app:1.0' }),
      options([]),
    );
    expect(calls[0]?.path).toBe('/images/ghcr.io%2Facme%2Fapp%3A1.0/json');
  });

  it('runs with only the workspace mounted and no extra privileges', async () => {
    const { calls, engine } = recordingEngine();
    await new DockerExecutor(engine).run(makeStep('test', 'true', { image: 'alpine:3.20' }), {
      ...options([]),
      env: { PRIVILEGED: 'true' },
    });
    const create = calls.find((call) => call.path.startsWith('/containers/create'));
    const host = (create?.body as { HostConfig: Record<string, unknown> }).HostConfig;
    expect(host['Binds']).toEqual(['/tmp/ws:/workspace']);
    expect(host['Privileged']).toBeUndefined();
    expect(host['NetworkMode']).toBeUndefined();
  });

  it("shares the runner's volumes instead of a host path when the runner runs in a container", async () => {
    const { calls, engine } = recordingEngine();
    await new DockerExecutor(engine, 'runner-container').run(
      makeStep('test', 'true', { image: 'alpine:3.20' }),
      { ...options([]), workspace: '/workspace/.bemmoly-runner/work/job-1' },
    );
    const create = calls.find((call) => call.path.startsWith('/containers/create'));
    const body = create?.body as { WorkingDir: string; HostConfig: Record<string, unknown> };
    expect(body.HostConfig['VolumesFrom']).toEqual(['runner-container']);
    expect(body.HostConfig['Binds']).toBeUndefined();
    expect(body.WorkingDir).toBe('/workspace/.bemmoly-runner/work/job-1');
  });
});
