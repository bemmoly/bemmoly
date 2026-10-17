import { describe, expect, it } from 'vitest';
import { connectCloudBodySchema } from '../../../../../shared/clouds.ts';
import { pullQuery } from '../../../clients/docker.ts';
import { localConfig, releaseRepository } from './runtime.ts';

const DIGEST = `sha256:${'b'.repeat(64)}`;

const release = (imageRepository: string | null) => ({
  id: '00000000-0000-7000-8000-000000000001',
  version: '1.0.0',
  commitSha: 'a1c9e3f',
  imageRepository,
  imageDigests: { 'linux/amd64': DIGEST },
  resolvedConfig: {},
});

describe('the local connection Docker host', () => {
  it.each([
    'unix:///var/run/docker.sock',
    'unix:///Users/me/.colima/default/docker.sock',
    'unix:///run/user/1000/podman/podman.sock',
    'tcp://127.0.0.1:2375',
    'tcp://localhost:2376',
  ])('accepts %s', (dockerHost) => {
    expect(localConfig({ dockerHost }).dockerHost).toBe(dockerHost);
    const body = { provider: 'local', name: 'Laptop', dockerHost };
    expect(connectCloudBodySchema.safeParse(body).success).toBe(true);
  });

  it.each([
    'tcp://10.0.0.5:2375',
    'tcp://169.254.169.254:80',
    'tcp://127.0.0.1.attacker.example:2375',
    'http://127.0.0.1:2375',
    'unix:///var/run/postgresql/.s.PGSQL.5432',
    'unix:///var/run/../../tmp/docker.sock',
    'unix://relative/docker.sock',
  ])('refuses %s, at the API and when a stored connection is used', (dockerHost) => {
    const body = { provider: 'local', name: 'Laptop', dockerHost };
    expect(connectCloudBodySchema.safeParse(body).success).toBe(false);
    expect(() => localConfig({ dockerHost })).toThrow(/Docker socket on this machine/);
  });

  it('defaults to the usual socket', () => {
    expect(localConfig({}).dockerHost).toBe('unix:///var/run/docker.sock');
  });
});

describe('the image a release runs as', () => {
  it('comes from a repository name, or is the demo program', () => {
    expect(releaseRepository(release('ghcr.io/acme/api'))).toBe('ghcr.io/acme/api');
    expect(releaseRepository(release(null))).toBeNull();
  });

  it.each(['ghcr.io/acme/api?fromSrc=x', 'ghcr.io/acme/api:1.0', '../containers/x'])(
    'refuses a repository that is not one: %s',
    (repository) => {
      expect(() => releaseRepository(release(repository))).toThrow(/not an image repository/);
    },
  );

  it('pulls a digest reference whole and splits a tag', () => {
    expect(pullQuery(`ghcr.io/acme/api@${DIGEST}`)).toBe(
      `fromImage=${encodeURIComponent(`ghcr.io/acme/api@${DIGEST}`)}`,
    );
    expect(pullQuery('localhost:5000/app:1.2')).toBe('fromImage=localhost%3A5000%2Fapp&tag=1.2');
    expect(pullQuery('alpine')).toBe('fromImage=alpine&tag=latest');
  });
});
