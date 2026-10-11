import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatBytes, formatDateTime } from '../format.ts';
import { pickLocale } from './detect.ts';
import { pseudoMessage, pseudoText } from './pseudo.ts';
import { defineCatalog, getLocale, setLocale, translate } from './runtime.ts';
import { useT } from './use-t.ts';

const plurals = defineCatalog(
  'test',
  {
    'test.issues': '{count, plural, =0 {No issues} one {# issue} other {# issues}}',
    'test.place': '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} in line',
    'test.greeting': 'Hi {name}',
    'test.reset': '<link>Reset your password</link> if you’ve forgotten it.',
    'test.untranslated': 'Only in English',
  },
  {
    fr: async () => ({
      default: {
        'test.issues': '{count, plural, =0 {Aucun ticket} one {# ticket} other {# tickets}}',
        'test.greeting': 'Bonjour {name}',
      },
    }),
  },
);

afterEach(async () => {
  await setLocale('en');
});

describe('messages and plurals', () => {
  it('chooses the plural form by count, with exact matches first', () => {
    expect(plurals.t('test.issues', { count: 0 })).toBe('No issues');
    expect(plurals.t('test.issues', { count: 1 })).toBe('1 issue');
    expect(plurals.t('test.issues', { count: 1200 })).toBe('1,200 issues');
    expect(plurals.t('test.place', { n: 2 })).toBe('2nd in line');
    expect(plurals.t('test.place', { n: 13 })).toBe('13th in line');
  });

  it('loads a locale lazily and keeps English for what it lacks', async () => {
    await setLocale('fr');
    expect(getLocale()).toBe('fr');
    expect(plurals.t('test.issues', { count: 1200 })).toBe('1 200 tickets');
    expect(plurals.t('test.greeting', { name: 'Aisha' })).toBe('Bonjour Aisha');
    expect(plurals.t('test.untranslated')).toBe('Only in English');
    expect(formatBytes(1_400_000_000)).toBe('1,4 GB');
  });

  it('formats dates in the active locale', async () => {
    const iso = new Date(2026, 9, 7, 14, 32).toISOString();
    expect(formatDateTime(iso)).toBe('Oct 7, 02:32 PM');
    await setLocale('fr');
    expect(formatDateTime(iso)).toBe('7 oct., 14:32');
  });

  it('returns the id for a message nobody wrote', () => {
    expect(translate('test.nowhere')).toBe('test.nowhere');
  });
});

describe('the pseudo-locale', () => {
  it('accents letters, pads by about 40% and brackets the message', () => {
    expect(pseudoText('Sign in')).toBe('Šíĝñ íñ');
    const [open, ...rest] = pseudoMessage('Sign in');
    expect(open).toBe('[');
    expect(rest.join('')).toBe('Šíĝñ íñ ···]');
  });

  it('keeps placeholders, plural markers and tag names working', async () => {
    await setLocale('en-XA');
    expect(plurals.t('test.issues', { count: 3 })).toBe('[3 íššüéš ····]');
    expect(plurals.t('test.greeting', { name: 'Aisha' })).toMatch(/^\[Ĥí Aisha ·+\]$/);
    render(<Reset />);
    expect(screen.getByRole('link').textContent).toBe('Ŕéšéţ ýöüŕ þáššŵöŕð');
  });

  it('is picked only when asked for by name', () => {
    expect(pickLocale({ search: 'en-XA', browser: ['fr-FR'] })).toBe('en-XA');
    expect(pickLocale({ person: null, device: null, browser: ['en-XA'] })).toBe('en-XA');
    expect(pickLocale({ person: 'en', browser: ['de-DE'] })).toBe('en');
    expect(pickLocale({ browser: ['de-DE', 'en-GB'] })).toBe('en');
  });
});

function Reset() {
  const t = useT(plurals);
  return <p>{t.rich('test.reset', undefined, { link: (text) => <a href="/reset">{text}</a> })}</p>;
}

describe('useT', () => {
  it('re-renders when the language changes, and values never become tags', async () => {
    function Greeting({ name }: { name: string }) {
      const t = useT(plurals);
      return (
        <p data-testid="greeting">
          {t.rich('test.greeting', { name }, { link: (text) => <a href="/x">{text}</a> })}
        </p>
      );
    }
    render(<Greeting name="<link>Eve</link>" />);
    const greeting = screen.getByTestId('greeting');
    expect(greeting.textContent).toBe('Hi <link>Eve</link>');
    expect(greeting.querySelector('a')).toBeNull();
    await act(() => setLocale('fr'));
    expect(greeting.textContent).toBe('Bonjour <link>Eve</link>');
  });
});
