import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { Importer } from '../../contracts/importer.ts';
import { createSecretBox } from '../settings/index.ts';
import { openConnection, splitConnection } from './connection.ts';
import {
  createImporterCatalog,
  defineImporter,
  describeSource,
  importerContribution,
} from './define.ts';

const secrets = createSecretBox(Buffer.alloc(32, 3).toString('base64'));

const importer = defineImporter({
  id: 'example',
  label: 'Example',
  description: 'A source for tests',
  brings: ['Things'],
  fields: [
    {
      name: 'deployment',
      label: 'Hosting',
      kind: 'select',
      required: true,
      options: [
        { value: 'cloud', label: 'Cloud' },
        { value: 'server', label: 'Server' },
      ],
    },
    { name: 'url', label: 'Site address', kind: 'url', required: true },
    {
      name: 'email',
      label: 'Email',
      kind: 'email',
      required: true,
      showWhen: { field: 'deployment', values: ['cloud'] },
    },
    { name: 'token', label: 'Token', kind: 'secret', required: true },
  ],
  siteOf: (connection) => connection['url'] ?? '',
  discover: async () => ({ site: '', containers: [], counts: {}, warnings: [] }),
  plan: async () => ({ containers: [], counts: {}, mappings: [] }),
  run: async () => undefined,
} satisfies Importer);

describe('splitConnection', () => {
  it('seals secrets and shows only that they were given', () => {
    const split = splitConnection(
      importer,
      {
        deployment: 'cloud',
        url: ' https://a.example.test ',
        email: 'a@example.test',
        token: 'shh',
      },
      secrets,
    );
    expect(split.shown).toEqual({
      deployment: 'cloud',
      url: 'https://a.example.test',
      email: 'a@example.test',
      token: true,
    });
    expect(split.sealed).not.toContain('shh');
    expect(openConnection({ connection: split.shown, credentials: split.sealed }, secrets)).toEqual(
      {
        deployment: 'cloud',
        url: 'https://a.example.test',
        email: 'a@example.test',
        token: 'shh',
      },
    );
  });

  it('asks only for the fields shown for the chosen options', () => {
    expect(() =>
      splitConnection(importer, { deployment: 'server', url: 'https://a', token: 't' }, secrets),
    ).not.toThrow();
    expect(() =>
      splitConnection(importer, { deployment: 'cloud', url: 'https://a', token: 't' }, secrets),
    ).toThrow(ValidationError);
  });

  it('refuses fields the source does not have', () => {
    expect(() =>
      splitConnection(
        importer,
        { deployment: 'server', url: 'u', token: 't', extra: 'x' },
        secrets,
      ),
    ).toThrow(/not a field/);
  });
});

describe('the importer catalog', () => {
  it('offers only enabled modules’ importers, described for the UI', () => {
    const contributions = [
      { ...importerContribution(importer), moduleId: 'work' },
      { id: 'odd', label: 'Odd', definition: {}, moduleId: 'docs' },
    ];
    const all = createImporterCatalog(() => contributions);
    expect(all.list().map((entry) => entry.importer.id)).toEqual(['example']);
    expect(describeSource(all.get('example')!)).toMatchObject({
      id: 'example',
      moduleId: 'work',
      brings: ['Things'],
    });
    expect(
      createImporterCatalog(
        () => contributions,
        () => false,
      ).get('example'),
    ).toBeNull();
  });
});
