import { describe, expect, it } from 'vitest';
import { checkCatalogs } from './check.ts';
import { CATALOG_FILE, compileCatalog, CatalogError, parseCatalog } from './compile.ts';
import { planExtract, serialise } from './extract.ts';
import type { CatalogFile } from './repo.ts';
import { messageCatalogs } from './vite-plugin.ts';

const en = (messages: Record<string, string>): CatalogFile => ({
  file: 'apps/web/src/i18n/shell.en.json',
  namespace: 'shell',
  locale: 'en',
  messages,
});
const fr = (messages: Record<string, string>): CatalogFile => ({
  ...en(messages),
  file: 'apps/web/src/i18n/shell.fr.json',
  locale: 'fr',
});
const SOURCE = {
  'shell.nav.home': 'Home',
  'shell.inbox.unread': '{count, plural, one {# unread} other {# unread}}',
};
const used = (...ids: string[]) => new Map(ids.map((id) => [id, ['apps/web/src/a.tsx']]));

describe('catalog files', () => {
  it('are named <namespace>.<locale>.json inside an i18n folder', () => {
    expect(CATALOG_FILE.test('/repo/apps/web/src/i18n/shell.en.json')).toBe(true);
    expect(CATALOG_FILE.test('/repo/modules/work/web/src/i18n/work.pt-BR.json')).toBe(true);
    expect(CATALOG_FILE.test('/repo/apps/web/src/data/sso-presets.json')).toBe(false);
  });

  it('compile to the runtime form, and a broken message names itself', () => {
    expect(compileCatalog(SOURCE, 'x.json')).toEqual({
      'shell.nav.home': ['Home'],
      'shell.inbox.unread': [
        ['count', 'plural', { one: ['#', ' unread'], other: ['#', ' unread'] }],
      ],
    });
    expect(() => compileCatalog({ 'shell.bad': 'Hi {name' }, 'x.json')).toThrow(/shell\.bad/);
    expect(() => parseCatalog('{"a": 1}', 'x.json')).toThrow(CatalogError);
  });

  it('go through the Vite plugin as compiled JSON', () => {
    const plugin = messageCatalogs();
    const transform = plugin.transform as (code: string, id: string) => { code: string } | null;
    const out = transform(JSON.stringify(SOURCE), '/r/apps/web/src/i18n/shell.en.json?import');
    expect(JSON.parse(out?.code ?? '')).toMatchObject({ 'shell.nav.home': ['Home'] });
    expect(transform('{}', '/r/apps/web/src/data/other.json')).toBeNull();
  });
});

describe('checkCatalogs', () => {
  const options = { source: 'en', shipped: ['en'] };

  it('passes a clean source and warns about ids nothing names', () => {
    const result = checkCatalogs([en(SOURCE)], used('shell.nav.home'), options);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      'apps/web/src/i18n/shell.en.json: no t() call names shell.inbox.unread',
    ]);
  });

  it('fails ids outside the namespace, bad messages and ids missing from English', () => {
    const result = checkCatalogs(
      [en({ ...SOURCE, 'work.board.title': 'Board', 'shell.broken': '{count, plural' })],
      used('shell.nav.away'),
      options,
    );
    expect(result.errors.join('\n')).toMatch(/work\.board\.title must look like "shell\./);
    expect(result.errors.join('\n')).toMatch(/shell\.broken/);
    expect(result.errors.join('\n')).toMatch(/shell\.nav\.away is not in/);
  });

  it('fails a shipped locale that lacks a key, and a translation that drops a placeholder', () => {
    const translation = fr({
      'shell.nav.home': '',
      'shell.inbox.unread': '{n, plural, one {# non lu} other {# non lus}}',
    });
    const result = checkCatalogs([en(SOURCE), translation], used(), {
      source: 'en',
      shipped: ['en', 'fr'],
    });
    expect(result.errors).toContain('fr ships, but "shell" lacks 1: shell.nav.home');
    expect(result.errors.join('\n')).toMatch(
      /shell\.inbox\.unread uses \{n\}, the source \{count\}/,
    );
  });

  it('lets an unshipped locale be incomplete, but not stale', () => {
    const result = checkCatalogs([en(SOURCE), fr({ 'shell.gone': 'Parti' })], used(), options);
    expect(result.errors).toEqual([
      'apps/web/src/i18n/shell.fr.json: shell.gone is not in apps/web/src/i18n/shell.en.json; remove it',
    ]);
  });
});

describe('planExtract', () => {
  it('adds a locale beside each source and lists ids without English', () => {
    const plan = planExtract(
      [en(SOURCE), fr({ 'shell.nav.home': 'Accueil', 'shell.old': 'x' })],
      used('shell.nav.new'),
      {
        source: 'en',
        locale: 'fr',
      },
    );
    expect(plan.unwritten).toEqual(['shell.nav.new']);
    const french = plan.writes.find((write) => write.file.endsWith('shell.fr.json'));
    expect(french?.messages).toEqual({ 'shell.inbox.unread': '', 'shell.nav.home': 'Accueil' });
    expect(serialise({ b: '2', a: '1' })).toBe('{\n  "a": "1",\n  "b": "2"\n}\n');
  });
});
