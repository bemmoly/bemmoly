import { homedir, hostname } from 'node:os';
import path from 'node:path';
import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { defaultDockerSocket, loadRunnerConfig, loadSplitConfig } from './env.ts';

const never = () => false;

describe('runner configuration', () => {
  it('reads flags, with sensible defaults for the rest', () => {
    const config = loadRunnerConfig(
      [
        '--url',
        'https://ci.example.com/',
        '--pool-token',
        'p'.repeat(20),
        '--labels',
        'linux, arm64,',
      ],
      { PATH: '/bin', HOME: '/home/r', SECRET: 'no' },
      never,
    );
    expect(config).toMatchObject({
      url: 'https://ci.example.com',
      poolToken: 'p'.repeat(20),
      name: hostname(),
      labels: ['linux', 'arm64'],
      local: false,
      once: false,
      dataDir: path.join(homedir(), '.bemmoly-runner'),
      dockerSocket: '/var/run/docker.sock',
      logLevel: 'info',
      hostEnv: { PATH: '/bin', HOME: '/home/r' },
    });
  });

  it('falls back to the environment, and flags win over it', () => {
    const config = loadRunnerConfig(
      ['--name', 'from-flag', '--once'],
      {
        BEMMOLY_URL: 'http://localhost:5616',
        BEMMOLY_RUNNER_NAME: 'from-env',
        BEMMOLY_POOL_TOKEN: 't'.repeat(16),
      },
      never,
    );
    expect(config).toMatchObject({ url: 'http://localhost:5616', name: 'from-flag', once: true });
    expect(config.poolToken).toBe('t'.repeat(16));
  });

  it('resolves the workspace for local mode and refuses it for containers', () => {
    const local = loadRunnerConfig(
      ['--url', 'http://x.test', '--local', '--workspace', 'here'],
      {},
      never,
    );
    expect(local.workspace).toBe(path.resolve('here'));
    expect(() =>
      loadRunnerConfig(['--url', 'http://x.test', '--workspace', 'here'], {}, never),
    ).toThrow(/only with --local/);
  });

  it('runs one job with a launch token, sharing its own volumes with steps when asked', () => {
    const config = loadRunnerConfig(
      [],
      {
        BEMMOLY_URL: 'https://ci.example.com',
        BEMMOLY_LAUNCH_TOKEN: 'l'.repeat(20),
        BEMMOLY_RUNNER_VOLUMES_FROM: 'self',
      },
      never,
    );
    expect(config).toMatchObject({
      launchToken: 'l'.repeat(20),
      once: true,
      volumesFrom: hostname(),
    });
    expect(config.poolToken).toBeUndefined();
    expect(() =>
      loadRunnerConfig(
        [
          '--url',
          'http://x.test',
          '--pool-token',
          'p'.repeat(20),
          '--launch-token',
          'l'.repeat(20),
        ],
        {},
        never,
      ),
    ).toThrow(/not both/);
    expect(() =>
      loadRunnerConfig(['--url', 'http://x.test', '--local', '--volumes-from', 'self'], {}, never),
    ).toThrow(/leave out --local/);
  });

  it('fails fast with a plain message on a missing address or an unknown flag', () => {
    expect(() => loadRunnerConfig([], {}, never)).toThrow(/--url/);
    expect(() => loadRunnerConfig(['--url', 'ftp://x.test'], {}, never)).toThrow(ValidationError);
    expect(() => loadRunnerConfig(['--url', 'http://x.test', '--nope'], {}, never)).toThrow(
      ValidationError,
    );
  });

  it('finds the Docker socket from DOCKER_HOST, then Colima, then the usual path', () => {
    expect(defaultDockerSocket({ DOCKER_HOST: 'unix:///run/user/1/docker.sock' }, never)).toBe(
      '/run/user/1/docker.sock',
    );
    expect(defaultDockerSocket({}, (p) => String(p).includes('.colima'))).toBe(
      path.join(homedir(), '.colima', 'default', 'docker.sock'),
    );
    expect(defaultDockerSocket({ DOCKER_HOST: 'tcp://1.2.3.4:2375' }, never)).toBe(
      '/var/run/docker.sock',
    );
  });
});

describe('split configuration', () => {
  it('needs the values a job step is given', () => {
    expect(() => loadSplitConfig({})).toThrow(/inside a job step/);
    const config = loadSplitConfig({
      BEMMOLY_API_URL: 'http://localhost:5616/',
      BEMMOLY_JOB_ID: '0190a0a0-0000-7000-8000-000000000001',
      BEMMOLY_JOB_TOKEN: 'tok',
    });
    expect(config.BEMMOLY_API_URL).toBe('http://localhost:5616');
  });
});

describe('a runner in a pod Pipelines started', () => {
  const pod = {
    control: '/bemmoly/control',
    logs: '/bemmoly/work/logs',
    steps: { 'node:24': 'step-0' },
    builder: 'build',
  };

  it('reads where its steps run from the pod layout Pipelines set', () => {
    const config = loadRunnerConfig(
      [],
      {
        BEMMOLY_URL: 'https://ci.example.com',
        BEMMOLY_LAUNCH_TOKEN: 'l'.repeat(20),
        BEMMOLY_RUNNER_POD: JSON.stringify(pod),
      },
      never,
    );
    expect(config).toMatchObject({ pod, once: true, launchToken: 'l'.repeat(20) });
  });

  it('stops at a layout that is not JSON or asks for local steps too', () => {
    const env = { BEMMOLY_URL: 'https://ci.example.com', BEMMOLY_LAUNCH_TOKEN: 'l'.repeat(20) };
    expect(() => loadRunnerConfig([], { ...env, BEMMOLY_RUNNER_POD: '{' }, never)).toThrow(
      /BEMMOLY_RUNNER_POD is not JSON/,
    );
    expect(() =>
      loadRunnerConfig(['--local'], { ...env, BEMMOLY_RUNNER_POD: JSON.stringify(pod) }, never),
    ).toThrow(ValidationError);
  });
});
