import { describe, expect, it } from 'vitest';
import type { PmNode } from './builders.ts';
import { BUILTIN_TEMPLATES } from './index.ts';

/*
 * What the templates are made of. Validity against the editor schema is tested in the web
 * chunk (web/src/templates/builtin.test.ts), since module server code may not import the
 * editor; these checks need only the JSON.
 */

const typesIn = (node: PmNode, out = new Set<string>()): Set<string> => {
  out.add(node.type);
  for (const child of node.content ?? []) typesIn(child, out);
  return out;
};

const template = (key: string) => BUILTIN_TEMPLATES.find((entry) => entry.key === key)!;

describe('built-in template content', () => {
  it('use the Docs blocks where they help: callouts, decisions, tables and a toc', () => {
    const used = new Set(BUILTIN_TEMPLATES.flatMap((entry) => [...typesIn(entry.snapshot)]));
    for (const type of ['callout', 'decision', 'table', 'toc']) expect(used).toContain(type);
  });

  it('record decisions as decision blocks, proposed until decided', () => {
    for (const key of ['rfc', 'meeting-notes', 'decision-log']) {
      const decisions = template(key).snapshot.content!.filter((node) => node.type === 'decision');
      expect(decisions.length).toBeGreaterThan(0);
      for (const node of decisions) {
        expect(node.attrs).toEqual({ state: 'proposed', decidedOn: null });
      }
    }
  });

  it('give every table a header row and rows as wide as it', () => {
    for (const entry of BUILTIN_TEMPLATES) {
      for (const node of entry.snapshot.content ?? []) {
        if (node.type !== 'table') continue;
        const [header, ...rows] = node.content ?? [];
        expect(header?.content?.every((cell) => cell.type === 'tableHeader')).toBe(true);
        for (const row of rows) expect(row.content).toHaveLength(header!.content!.length);
      }
    }
  });

  it('put the table of contents before the first section', () => {
    for (const entry of BUILTIN_TEMPLATES) {
      const content = entry.snapshot.content ?? [];
      const at = content.findIndex((node) => node.type === 'toc');
      if (at < 0) continue;
      expect(at).toBeLessThan(content.findIndex((node) => node.type === 'heading'));
    }
  });
});
