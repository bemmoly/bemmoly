import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { planImport, readMarkdown, titleFromName } from './plan.ts';

describe('planning an import', () => {
  it('reads a title from front matter, then a leading heading, then the name', () => {
    expect(readMarkdown('---\ntitle: "On-call"\nowner: ops\n---\nBody', 'x.md')).toEqual({
      title: 'On-call',
      body: 'Body',
    });
    expect(readMarkdown('# Deploy guide\n\nSteps', 'x.md')).toEqual({
      title: 'Deploy guide',
      body: 'Steps',
    });
    expect(readMarkdown('Just text', 'release-notes_2.md').title).toBe('Release notes 2');
    expect(titleFromName('.md')).toBe('Untitled');
  });

  it('turns folders into parent pages and index files into the folder page', () => {
    const plan = planImport('markdown', [
      { path: 'guides/deploy.md', content: '# Deploy\nSteps' },
      { path: './guides/README.md', content: '# Guides\nStart here' },
      { path: 'guides/api/auth.md', content: 'Tokens' },
      { path: 'faq.md', content: 'Questions' },
    ]);
    expect(plan.map((page) => [page.key, page.parentKey, page.title, page.content])).toEqual([
      ['guides', null, 'Guides', 'Start here'],
      ['guides/deploy.md', 'guides', 'Deploy', 'Steps'],
      ['guides/api', 'guides', 'Api', null],
      ['guides/api/auth.md', 'guides/api', 'Auth', 'Tokens'],
      ['faq.md', null, 'Faq', 'Questions'],
    ]);
  });

  it('names Confluence pages from the export, else the file', () => {
    const plan = planImport('confluence', [
      { path: 'ENG/runbook.html', content: '<p>Restart</p>', title: 'Runbook' },
      { path: 'ENG/runbook/deploy.xhtml', content: '<p>Ship</p>' },
    ]);
    expect(plan.map((page) => [page.key, page.parentKey, page.title])).toEqual([
      ['ENG', null, 'ENG'],
      ['ENG/runbook.html', 'ENG', 'Runbook'],
      ['ENG/runbook', 'ENG', 'Runbook'],
      ['ENG/runbook/deploy.xhtml', 'ENG/runbook', 'Deploy'],
    ]);
  });

  it('refuses files of the wrong kind and duplicates', () => {
    expect(() => planImport('markdown', [{ path: 'a.pdf', content: '' }])).toThrow(ValidationError);
    expect(() =>
      planImport('markdown', [
        { path: 'a.md', content: '' },
        { path: './a.md', content: '' },
      ]),
    ).toThrow(/twice/);
  });
});
