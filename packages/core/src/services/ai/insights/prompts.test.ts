import { readFile } from 'node:fs/promises';
import { AI_INSIGHT_OUTPUT_SCHEMAS } from '@bemmoly/shared/ai-insights';
import { describe, expect, it } from 'vitest';
import { parsePromptFile } from '../prompts/parse.ts';
import { INSIGHT_PROMPT_FILES } from './index.ts';

describe('the kernel insight prompts', () => {
  it.each(INSIGHT_PROMPT_FILES)(
    '%s parses, declares its variables and names a known schema',
    async (path) => {
      const prompt = parsePromptFile(await readFile(path, 'utf8'), path);
      expect(prompt.id.startsWith('ai.')).toBe(true);
      expect(prompt.variables).toContain('context');
      expect(Object.keys(AI_INSIGHT_OUTPUT_SCHEMAS)).toContain(prompt.output_schema);
    },
  );
});
