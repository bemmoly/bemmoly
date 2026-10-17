import { describe, expect, it } from 'vitest';
import {
  applicationFilePath,
  applicationPathOf,
  isApplicationFile,
  readApplicationFile,
  writeApplicationFile,
} from './file.ts';
import { ownerRefOf, teamSlug } from './owners.ts';
import { editFile, summarise } from './repo-change.ts';

const FILE = `# Owned by Payments since 2024
name: checkout-api
group: checkout
owner: team/payments # reviewed by platform
tier: 0
labels: [node, pci]
pipeline:
  extends: acme/node-service@3
  with: { port: 8081 }
`;

describe('application.yaml', () => {
  it('reads a valid file with its defaults', () => {
    const read = readApplicationFile('name: lake-ingest\ngroup: lake\n');
    expect(read).toEqual({
      ok: true,
      file: expect.objectContaining({
        name: 'lake-ingest',
        tier: 2,
        labels: [],
        lifecycle: 'production',
        dependsOn: [],
      }),
    });
  });

  it('says where a file is wrong', () => {
    expect(readApplicationFile('name: Checkout API\ngroup: checkout\n')).toEqual({
      ok: false,
      error: 'name: Use lowercase letters, digits and dashes',
    });
    expect(readApplicationFile('name: [unclosed')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^The YAML does not parse/),
    });
    expect(readApplicationFile('name: x\ngroup: y\nowner: payments\n')).toEqual({
      ok: false,
      error: 'owner: Owners look like "team/payments"',
    });
  });

  it('writes a short file that reads back the same', () => {
    const text = writeApplicationFile({
      name: 'gift-cards',
      group: 'checkout',
      domain: 'commerce',
      owner: 'team/payments',
      tier: 1,
      labels: ['node'],
    });
    expect(text).toBe(
      'name: gift-cards\ngroup: checkout\ndomain: commerce\nowner: team/payments\ntier: 1\nlabels:\n  - node\n',
    );
    expect(readApplicationFile(text)).toMatchObject({
      ok: true,
      file: { name: 'gift-cards', tier: 1 },
    });
  });

  it('edits a file in place, keeping comments and the pipeline', () => {
    const edited = editFile(FILE, { tier: 1, owner: 'team/checkout-web', labels: [] });
    expect(edited).toContain('# Owned by Payments since 2024');
    expect(edited).toContain('owner: team/checkout-web');
    expect(edited).toContain('tier: 1');
    expect(edited).not.toContain('labels');
    expect(edited).toContain('extends: acme/node-service@3');
  });

  it('places files beside their code', () => {
    expect(applicationFilePath('')).toBe('.bemmoly/application.yaml');
    expect(applicationFilePath('services/checkout-api/')).toBe(
      'services/checkout-api/.bemmoly/application.yaml',
    );
    expect(applicationPathOf('services/checkout-api/.bemmoly/application.yaml')).toBe(
      'services/checkout-api',
    );
    expect(isApplicationFile('a/.bemmoly/application.yaml')).toBe(true);
    expect(isApplicationFile('a/x.bemmoly/application.yaml')).toBe(false);
  });
});

describe('owners and summaries', () => {
  it('names teams the way application.yaml does', () => {
    expect(teamSlug('Checkout web')).toBe('checkout-web');
    expect(teamSlug('  SRE / On-call ')).toBe('sre-on-call');
    expect(ownerRefOf({ name: 'Payments' })).toBe('team/payments');
  });

  it('says what an edit changes', () => {
    expect(summarise(['owner'])).toBe('Changes owner');
    expect(summarise(['owner', 'tier', 'dependsOn'])).toBe('Changes owner, tier and dependencies');
  });
});
