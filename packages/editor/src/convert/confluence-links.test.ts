import { describe, expect, it } from 'vitest';
import { fromConfluence } from './from-confluence.ts';

describe('fromConfluence for importers', () => {
  it('rewrites links through the importer', () => {
    const doc = fromConfluence(
      '<p><a href="https://acme.example.test/wiki/spaces/ENG/pages/42/Plan">plan</a></p>',
      { rewriteLink: (href) => (href.includes('/pages/42/') ? '/docs/p/page-42' : null) },
    );
    expect(JSON.stringify(doc)).toContain('"href":"/docs/p/page-42"');
  });

  it('resolves a Data Center user by user key', () => {
    const doc = fromConfluence('<p><ac:link><ri:user ri:userkey="ff80"/></ac:link></p>', {
      resolveUser: (account) => (account === 'ff80' ? { id: 'user-1', label: 'Ada' } : null),
    });
    expect(JSON.stringify(doc)).toContain('"id":"user-1","label":"Ada"');
  });
});
