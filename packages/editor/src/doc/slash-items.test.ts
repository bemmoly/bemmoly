import { describe, expect, it, vi } from 'vitest';
import type { DocServices } from './services.ts';
import { docSlashItems, filterSlashItems } from './slash-items.ts';

const labels = (query: string, ai = true) =>
  filterSlashItems(docSlashItems(ai ? { ai: { run: vi.fn() } } : {}), query).map(
    (item) => `${item.group}: ${item.label}`,
  );

describe('the / menu rows', () => {
  it('lists Basic blocks first, then AI, Insert and From Work', () => {
    const rows = labels('');
    expect(rows.slice(0, 2)).toEqual(['Basic blocks: Text', 'Basic blocks: Heading']);
    const groups = [...new Set(rows.map((row) => row.split(':')[0]))];
    expect(groups).toEqual(['Basic blocks', 'AI', 'Insert', 'From Work']);
  });

  it('gives every row an icon and a second line', () => {
    for (const item of docSlashItems({ ai: { run: vi.fn() } })) {
      expect(item.icon).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
  });

  it('keeps each group together and puts label matches before word matches', () => {
    expect(labels('table')).toEqual([
      'Insert: Table',
      'Insert: Table of contents',
      'From Work: Issue table from filter',
    ]);
    const c = labels('c');
    expect(c.filter((row) => row.startsWith('AI'))).toEqual([
      'AI: Continue writing',
      'AI: Create issues from this section',
      'AI: Check consistency with linked issues',
      'AI: Summarize open questions from comments',
    ]);
  });

  it('finds blocks by keyword', () => {
    expect(labels('todo', false)).toEqual(['Basic blocks: To-do list']);
    expect(labels('hr', false)).toEqual(['Insert: Divider']);
    expect(labels('h3', false)).toEqual(['Basic blocks: Subheading']);
  });

  it('hides rows whose service the host has not lent', () => {
    const ids = (services: DocServices) => docSlashItems(services).map((item) => item.id);
    expect(ids({})).not.toContain('pageLink');
    expect(ids({})).not.toContain('continue');
    const search = vi.fn(async () => []);
    expect(ids({ searchPages: search, searchPeople: search, searchIssues: search })).toEqual(
      expect.arrayContaining(['pageLink', 'mention', 'issueEmbed', 'issueCard']),
    );
  });
});
