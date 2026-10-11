import { fileURLToPath } from 'node:url';
import { DOCS_AI_COMMANDS, type DocsAiCommand } from '../../../../shared/editor-ai.ts';

/*
 * The editor's prompts are Markdown files in ../../prompts, registered with the AI runtime at
 * boot (ctx.ai.addPromptFile), shown in Settings › AI › Prompts and overridable there. Each
 * /ai command has its own file, so an admin can tune one without touching the rest.
 */

export const EDITOR_PROMPTS = {
  complete: 'docs.autocomplete',
  fix: 'docs.comment_fix',
} as const;

export const writePromptId = (command: DocsAiCommand) => `docs.write.${command}`;

const file = (name: string) => fileURLToPath(new URL(`../../prompts/${name}.md`, import.meta.url));

/** Every editor prompt file, as ctx.ai.addPromptFile takes them. */
export const EDITOR_PROMPT_FILES: readonly { name: string; path: string }[] = [
  { name: EDITOR_PROMPTS.complete, path: file('autocomplete') },
  { name: EDITOR_PROMPTS.fix, path: file('comment-fix') },
  ...DOCS_AI_COMMANDS.map((command) => ({
    name: writePromptId(command),
    path: file(`write-${command}`),
  })),
];
