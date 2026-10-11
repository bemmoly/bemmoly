import { afterEach, describe, expect, it } from 'vitest';
import { loadUpdaterEnv, updaterEnvSchema } from './env.ts';

const TOKEN = 'u'.repeat(40);

describe('updater environment', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('keeps cosign trust cache on the writable /tmp of the read-only container', () => {
    expect(updaterEnvSchema.parse({ UPDATER_TOKEN: TOKEN }).TUF_ROOT).toBe('/tmp/sigstore');
  });

  it('exports the trust cache so cosign inherits it', () => {
    delete process.env['TUF_ROOT'];
    process.env['UPDATER_TOKEN'] = TOKEN;
    expect(loadUpdaterEnv().TUF_ROOT).toBe('/tmp/sigstore');
    expect(process.env['TUF_ROOT']).toBe('/tmp/sigstore');
  });

  it('keeps a trust cache the operator chose', () => {
    process.env['UPDATER_TOKEN'] = TOKEN;
    process.env['TUF_ROOT'] = '/var/cache/sigstore';
    expect(loadUpdaterEnv().TUF_ROOT).toBe('/var/cache/sigstore');
    expect(process.env['TUF_ROOT']).toBe('/var/cache/sigstore');
  });
});
