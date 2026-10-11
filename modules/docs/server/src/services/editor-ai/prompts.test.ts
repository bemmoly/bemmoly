import { aiPromptFrontmatterSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { COMMENT_FIX_SCHEMA_ID, DOCS_AI_COMMANDS } from '../../../../shared/editor-ai.ts';
import { editorPrompts } from '../../testing/editor-prompts.ts';
import { EDITOR_PROMPTS, writePromptId } from './prompts.ts';

const used = (template: string) =>
  new Set([...template.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)].map((m) => m[1]));

describe('the editor prompt files', () => {
  const prompts = editorPrompts();

  it('has one file per /ai command, plus ghost text and the comment fix', () => {
    expect(prompts.map((prompt) => prompt.id).sort()).toEqual(
      [EDITOR_PROMPTS.complete, EDITOR_PROMPTS.fix, ...DOCS_AI_COMMANDS.map(writePromptId)].sort(),
    );
  });

  it.each(prompts.map((prompt) => [prompt.id, prompt] as const))(
    '%s has valid frontmatter and declares exactly the variables it uses',
    (_id, prompt) => {
      expect(prompt.id).toBe(prompt.name);
      expect(prompt.id.startsWith('docs.')).toBe(true);
      const parsed = aiPromptFrontmatterSchema.parse({
        id: prompt.id,
        version: prompt.version,
        role: prompt.role,
        description: prompt.description,
        variables: prompt.variables,
        output_schema: prompt.outputSchema,
      });
      expect(parsed.id).toBe(prompt.id);
      expect(prompt.system.length).toBeGreaterThan(40);
      expect(used(`${prompt.system}\n${prompt.prompt}`)).toEqual(new Set(prompt.variables));
    },
  );

  it('runs ghost text on the fast role and names the fix’s output schema', () => {
    const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]));
    expect(byId.get(EDITOR_PROMPTS.complete)?.role).toBe('fast');
    expect(byId.get(EDITOR_PROMPTS.fix)?.outputSchema).toBe(COMMENT_FIX_SCHEMA_ID);
    expect(byId.get(writePromptId('draft'))?.role).toBe('strong');
  });

  it('names no vendor', () => {
    for (const prompt of prompts) {
      expect(`${prompt.system} ${prompt.prompt}`).not.toMatch(/openai|anthropic|claude|gpt/i);
    }
  });
});
