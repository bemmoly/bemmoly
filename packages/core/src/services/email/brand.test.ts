import { describe, expect, it } from 'vitest';
import { defaultLogoUrl } from './brand.ts';

describe('defaultLogoUrl', () => {
  const key = '/api/v1/workspace/logo/abc.png';

  it('puts an uploaded logo under the workspace URL', () => {
    expect(defaultLogoUrl(key, 'https://work.acme.dev')).toBe(
      'https://work.acme.dev/api/v1/workspace/logo/abc.png',
    );
    expect(defaultLogoUrl(key, 'https://acme.dev/bemmoly/')).toBe(
      'https://acme.dev/bemmoly/api/v1/workspace/logo/abc.png',
    );
  });

  it('keeps an https key and refuses anything a mail client should not fetch', () => {
    expect(defaultLogoUrl('https://cdn.acme.dev/l.png')).toBe('https://cdn.acme.dev/l.png');
    expect(defaultLogoUrl(key)).toBeNull();
    expect(defaultLogoUrl(key, 'http://10.0.0.5')).toBeNull();
    expect(defaultLogoUrl('//evil.test/x.png', 'https://acme.dev')).toBeNull();
    expect(defaultLogoUrl('data:image/png;base64,AAAA', 'https://acme.dev')).toBeNull();
  });
});
