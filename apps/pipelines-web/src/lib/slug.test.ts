import { describe, expect, it } from 'vitest';
import { slugOf } from './slug.ts';

describe('slugOf', () => {
  it('turns a name into a key', () => {
    expect(slugOf('Prod · EU West')).toBe('prod-eu-west');
    expect(slugOf('  Shop prod  ')).toBe('shop-prod');
    expect(slugOf('Café Préprod')).toBe('cafe-preprod');
  });

  it('keeps to 63 characters without a trailing dash', () => {
    const key = slugOf(`${'a'.repeat(62)} b`);
    expect(key).toBe('a'.repeat(62));
    expect(slugOf('---')).toBe('');
  });
});
