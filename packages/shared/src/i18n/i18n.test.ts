import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  MaintenanceError,
  NotFoundError,
  ProviderError,
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
} from '../errors/errors.ts';
import errors from './errors.en.json' with { type: 'json' };
import { canonicalLocale, negotiateLocale, PSEUDO_LOCALE, textDirection } from './locales.ts';

describe('negotiateLocale', () => {
  const available = ['en', 'fr-CA', 'pt', PSEUDO_LOCALE];

  it('takes the first exact match, in the order asked', () => {
    expect(negotiateLocale(['de', 'pt', 'en'], available)).toBe('pt');
    expect(negotiateLocale(['FR-ca'], available)).toBe('fr-CA');
  });

  it('matches by language when the region is not there', () => {
    expect(negotiateLocale(['pt-BR'], available)).toBe('pt');
    expect(negotiateLocale(['fr'], available)).toBe('fr-CA');
    expect(negotiateLocale(['en-GB'], available)).toBe('en');
  });

  it('only gives the pseudo-locale to an exact ask', () => {
    expect(negotiateLocale(['en-XA'], available)).toBe(PSEUDO_LOCALE);
    expect(negotiateLocale(['en-US'], ['en-XA', 'en'])).toBe('en');
  });

  it('skips empty and malformed tags, then falls back to the first available', () => {
    expect(negotiateLocale([null, undefined, '', 'not a tag!', 'ja'], available)).toBe('en');
    expect(negotiateLocale([])).toBe('en');
  });

  it('canonicalises tags and knows right-to-left languages', () => {
    expect(canonicalLocale('EN-us')).toBe('en-US');
    expect(canonicalLocale('??')).toBeNull();
    expect(textDirection('ar-EG')).toBe('rtl');
    expect(textDirection('he')).toBe('rtl');
    expect(textDirection('en')).toBe('ltr');
  });
});

describe('error message ids', () => {
  it.each([
    new UnauthenticatedError(),
    new NotFoundError(),
    new ForbiddenError(undefined, { code: 'module_access_denied' }),
    new ValidationError(),
    new ConflictError(),
    new RateLimitedError(),
    new MaintenanceError(),
    new ProviderError(),
  ])('%o renders its catalog message in English', (error) => {
    expect(error.messageId).toMatch(/^errors\./);
    expect(errors[error.messageId as keyof typeof errors]).toBe(error.message);
  });

  it('leaves a custom message without an id unless one is given', () => {
    expect(new NotFoundError('No such issue').messageId).toBeUndefined();
    const named = new ConflictError('Key PLT is taken', {
      messageId: 'work.projects.keyTaken',
      values: { key: 'PLT' },
    });
    expect(named.messageId).toBe('work.projects.keyTaken');
    expect(named.values).toEqual({ key: 'PLT' });
  });
});
