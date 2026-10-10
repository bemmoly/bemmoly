import { describe, expect, it } from 'vitest';
import { customerLogo } from './customer-logo.ts';

describe('customerLogo', () => {
  it('takes a logo this install serves, or an inline image', () => {
    expect(customerLogo('Acme', '/api/v1/files/logo.png')).toEqual({
      name: 'Acme',
      src: '/api/v1/files/logo.png',
    });
    expect(customerLogo('Acme', 'data:image/png;base64,AAAA')?.src).toBe(
      'data:image/png;base64,AAAA',
    );
  });

  it('draws no customer logo for an empty key or one the page may not load', () => {
    expect(customerLogo('Acme', '')).toBeNull();
    expect(customerLogo('Acme', null)).toBeNull();
    expect(customerLogo('Acme', 'https://cdn.example.com/logo.png')).toBeNull();
    expect(customerLogo('Acme', '//cdn.example.com/logo.png')).toBeNull();
    expect(customerLogo('Acme', 'data:text/html;base64,AAAA')).toBeNull();
  });
});
