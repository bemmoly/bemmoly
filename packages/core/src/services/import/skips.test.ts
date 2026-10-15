import { describe, expect, it } from 'vitest';
import { HttpStatusError } from '../../clients/http-json.ts';
import { reasonOf } from './reasons.ts';
import { csvField } from './skips.ts';

describe('csvField', () => {
  it('quotes what needs it and defuses formulas', () => {
    expect(csvField('PLT-90')).toBe('PLT-90');
    expect(csvField('Attachment, larger than 25 MB')).toBe('"Attachment, larger than 25 MB"');
    expect(csvField('Said "no"')).toBe('"Said ""no"""');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('-1')).toBe("'-1");
  });
});

describe('reasonOf', () => {
  it('says plainly that the source kept refusing', () => {
    const limited = new HttpStatusError('https://acme.example.net/rest', 429, '');
    expect(reasonOf(limited, 'Jira')).toBe('Jira kept answering “too many requests”');
    expect(reasonOf(new Error('Jira answered 429', { cause: limited }), 'Jira')).toBe(
      'Jira kept answering “too many requests”',
    );
  });

  it('keeps the importer’s own words otherwise', () => {
    const broken = new HttpStatusError('https://acme.example.net/rest', 500, '');
    expect(reasonOf(new Error('Jira answered 500', { cause: broken }), 'Jira')).toBe(
      'Jira answered 500',
    );
    expect(reasonOf('')).toBe('The import stopped with an unknown error');
  });
});
