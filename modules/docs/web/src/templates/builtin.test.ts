import { editorSchema } from '@bemmoly/editor/schema';
import { Node } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../../../shared/builtin-templates/index.ts';

describe('built-in templates', () => {
  it('are the six the tech design names, with unique keys', () => {
    expect(BUILTIN_TEMPLATES.map((template) => template.key)).toEqual([
      'rfc',
      'meeting-notes',
      'postmortem',
      'product-spec',
      'runbook',
      'decision-log',
    ]);
  });

  it.each(BUILTIN_TEMPLATES.map((template) => [template.key, template] as const))(
    '%s is a valid document in the editor schema and round-trips unchanged',
    (_key, template) => {
      const node = Node.fromJSON(editorSchema(), template.snapshot);
      node.check();
      expect(node.toJSON()).toEqual(template.snapshot);
      expect(node.textContent.length).toBeGreaterThan(40);
    },
  );
});
