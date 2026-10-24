import { describe, expect, it } from 'vitest';
import { fileBody, isEmptyBody, kindAllowed, pageFileOf } from './page-kind.ts';

const report = { src: '/api/v1/files/0199c0de-0000-7000-8000-0000000000c1', name: 'q3.html' };
const file = (mime = 'text/html') => ({ type: 'file', attrs: { ...report, mime } });
const blank = { type: 'paragraph' };
const words = { type: 'paragraph', content: [{ type: 'text', text: 'Notes' }] };
const doc = (...content: object[]) => ({ type: 'doc' as const, content });

describe('page kinds', () => {
  it('finds the one PDF or HTML file a body is made of, beside blank paragraphs', () => {
    expect(pageFileOf(doc(blank, file(), blank))).toEqual({ ...report, mime: 'text/html' });
    expect(pageFileOf(fileBody({ ...report, mime: 'application/pdf' }))?.mime).toBe(
      'application/pdf',
    );
  });

  it('is no file page with words, two files, an image or nothing at all', () => {
    expect(pageFileOf(doc(file(), words))).toBeNull();
    expect(pageFileOf(doc(file(), file()))).toBeNull();
    expect(pageFileOf(doc(file('image/png')))).toBeNull();
    expect(pageFileOf(null)).toBeNull();
  });

  it('reads no body and blank paragraphs as empty', () => {
    expect(isEmptyBody(null)).toBe(true);
    expect(isEmptyBody(doc(blank, blank))).toBe(true);
    expect(isEmptyBody(doc(words))).toBe(false);
    expect(isEmptyBody(doc(file()))).toBe(false);
  });

  it('allows a folder only with nothing written and a file page only with one file', () => {
    expect(kindAllowed('page', doc(words))).toBe(true);
    expect(kindAllowed('folder', doc(blank))).toBe(true);
    expect(kindAllowed('folder', doc(words))).toBe(false);
    expect(kindAllowed('file', doc(blank, file()))).toBe(true);
    expect(kindAllowed('file', doc(blank))).toBe(false);
  });
});
