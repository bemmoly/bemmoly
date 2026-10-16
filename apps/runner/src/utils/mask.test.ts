import { describe, expect, it } from 'vitest';
import { SecretMasker } from './mask.ts';

describe('secret masking', () => {
  it('replaces every occurrence, longest secret first', () => {
    const masker = new SecretMasker();
    masker.add(['abc123', 'abc123-longer']);
    expect(masker.mask('a=abc123-longer b=abc123 c=abc123')).toBe('a=*** b=*** c=***');
  });

  it('masks each line of a multi-line secret and ignores values too short to matter', () => {
    const masker = new SecretMasker();
    masker.add(['-----BEGIN KEY-----\nMIIBOgIBAAJBAK\n-----END KEY-----', 'on']);
    expect(masker.mask('MIIBOgIBAAJBAK')).toBe('***');
    expect(masker.mask('turn it on')).toBe('turn it on');
  });

  it('treats secrets as text, not patterns', () => {
    const masker = new SecretMasker();
    masker.add(['a.b*c(d']);
    expect(masker.mask('x a.b*c(d y axbbc(d')).toBe('x *** y axbbc(d');
  });
});
