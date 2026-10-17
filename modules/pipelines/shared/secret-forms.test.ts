import { describe, expect, it } from 'vitest';
import { maskWith, secretForms } from './secret-forms.ts';

const mask = (values: string[], line: string) => maskWith(secretForms(values, 4), line);
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

describe('secret forms', () => {
  it('masks the value and each line of a multi-line value', () => {
    const key = '-----BEGIN KEY-----\nMIIBOgIBAAJBAKj34\n-----END KEY-----\n';
    expect(mask([key], 'got MIIBOgIBAAJBAKj34 back')).toBe('got *** back');
    expect(mask(['s3cr3t-value'], 'a=s3cr3t-value')).toBe('a=***');
  });

  it('masks the value base64-encoded at every alignment, with and without a newline', () => {
    const secret = 'hunter2-is-my-password';
    for (const prefix of ['', 'a', 'ab', 'user:']) {
      const encoded = b64(`${prefix}${secret}`);
      expect(mask([secret], `Authorization: Basic ${encoded}`)).not.toContain(encoded.slice(8, -4));
    }
    expect(mask([secret], b64(`${secret}\n`))).toMatch(/^\*\*\*.{0,4}$/);
    const urlSafe = b64(`${secret}??>>`).replace(/\+/g, '-').replace(/\//g, '_');
    expect(mask([`${secret}??>>`], urlSafe)).toMatch(/^\*\*\*.{0,4}$/);
  });

  it('masks the value URL-encoded and JSON-escaped', () => {
    const secret = 'p@ss w/rd"quote';
    expect(mask([secret], `https://x:${encodeURIComponent(secret)}@host`)).toBe(
      'https://x:***@host',
    );
    expect(mask([secret], JSON.stringify({ password: secret }))).toBe('{"password":"***"}');
  });

  it('leaves short values and ordinary text alone', () => {
    expect(mask(['on', 'abc'], 'turn it on, abc')).toBe('turn it on, abc');
    expect(secretForms(['abcd'], 4)).toEqual(['abcd']);
  });
});
