import { readFileSync } from 'node:fs';
import type { TestAi } from '@bemmoly/core/testing';
import { EDITOR_PROMPT_FILES } from '../services/editor-ai/prompts.ts';

/*
 * The editor's prompt files read the way the runtime's loader reads them (frontmatter, then
 * "# System" and "# Prompt"), for tests: the prompt checks, and createTestAi, which takes
 * prompts by hand rather than from files.
 */

export interface ParsedPrompt {
  name: string;
  id: string;
  version: number;
  role: 'fast' | 'standard' | 'strong';
  description: string;
  variables: string[];
  outputSchema: string | null;
  system: string;
  prompt: string;
}

function field(front: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(front);
  return match?.[1]?.trim() ?? '';
}

export function parsePromptFile(name: string, path: string): ParsedPrompt {
  const source = readFileSync(path, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${name}: no frontmatter`);
  const [, front = '', body = ''] = match;
  const sections = /^(?:# System\n([\s\S]*?)\n)?# Prompt\n([\s\S]*)$/m.exec(body.trim());
  if (!sections) throw new Error(`${name}: needs a "# Prompt" section`);
  const list = field(front, 'variables').replace(/^\[|\]$/g, '');
  const schema = field(front, 'output_schema');
  return {
    name,
    id: field(front, 'id'),
    version: Number(field(front, 'version')),
    role: field(front, 'role') as ParsedPrompt['role'],
    description: field(front, 'description'),
    variables: list ? list.split(',').map((item) => item.trim()) : [],
    outputSchema: schema && schema !== 'null' ? schema : null,
    system: (sections[1] ?? '').trim(),
    prompt: (sections[2] ?? '').trim(),
  };
}

export const editorPrompts = (): ParsedPrompt[] =>
  EDITOR_PROMPT_FILES.map((file) => parsePromptFile(file.name, file.path));

/** Gives a test AI every editor prompt, as the runtime would load them at boot. */
export function addEditorPrompts(ai: TestAi): void {
  for (const parsed of editorPrompts()) {
    ai.addPrompt(parsed.id, {
      role: parsed.role,
      system: parsed.system,
      prompt: parsed.prompt,
      outputSchema: parsed.outputSchema,
      version: parsed.version,
    });
  }
}
