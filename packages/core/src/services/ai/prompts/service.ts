import { readFile } from 'node:fs/promises';
import {
  NotFoundError,
  ValidationError,
  type AiPrompt,
  type AiPromptDiffResponse,
} from '@bemmoly/shared';
import type { AiRenderedPrompt } from '../../../contracts/ai.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import {
  deleteOverride,
  listOverrides,
  upsertOverride,
  type OverrideRow,
} from '../store/preferences.ts';
import { diffLines } from './diff.ts';
import {
  checkVariables,
  fill,
  parsePromptFile,
  PromptFileError,
  splitBody,
  type PromptDefinition,
} from './parse.ts';

/** A prompt file a module registered with ctx.ai.addPromptFile. */
export interface ModulePromptFile {
  moduleId: string;
  path: string;
}

export interface PromptServiceOptions {
  /** Kernel prompt files (absolute paths); their ids start with "ai.". */
  kernelFiles?: readonly string[];
  moduleFiles?: readonly ModulePromptFile[];
  /** Without a database, overrides are off (tests, no-database boots). */
  sql?: SqlExecutor;
  /** How long override rows are cached; replicas pick up an edit within this. */
  overrideTtlMs?: number;
}

export interface PromptService {
  /** Reads and validates every file; throws one error naming every bad file. */
  load(): Promise<void>;
  render(id: string, variables: Readonly<Record<string, string>>): Promise<AiRenderedPrompt>;
  list(): Promise<AiPrompt[]>;
  setOverride(id: string, template: string, userId: string | null): Promise<AiPrompt>;
  resetOverride(id: string): Promise<void>;
  diff(id: string): Promise<AiPromptDiffResponse>;
}

const bodyOf = (prompt: { system: string; template: string }) =>
  prompt.system
    ? `# System\n\n${prompt.system}\n\n# Prompt\n\n${prompt.template}`
    : `# Prompt\n\n${prompt.template}`;

export function createPromptService(options: PromptServiceOptions): PromptService {
  const prompts = new Map<string, PromptDefinition>();
  const ttl = options.overrideTtlMs ?? 30_000;
  let cached: { at: number; rows: Map<string, OverrideRow> } | null = null;

  async function overrides(): Promise<Map<string, OverrideRow>> {
    if (!options.sql) return new Map();
    if (cached && Date.now() - cached.at < ttl) return cached.rows;
    const rows = new Map((await listOverrides(options.sql)).map((row) => [row.promptId, row]));
    cached = { at: Date.now(), rows };
    return rows;
  }

  function definition(id: string): PromptDefinition {
    const prompt = prompts.get(id);
    if (!prompt) throw new NotFoundError(`There is no AI prompt "${id}"`);
    return prompt;
  }

  async function toApi(prompt: PromptDefinition): Promise<AiPrompt> {
    const override = (await overrides()).get(prompt.id);
    return {
      id: prompt.id,
      version: prompt.version,
      role: prompt.role,
      description: prompt.description,
      variables: prompt.variables,
      outputSchema: prompt.output_schema,
      defaultTemplate: bodyOf(prompt),
      override: override
        ? {
            template: override.template,
            updatedAt: override.updatedAt,
            updatedBy: override.updatedBy,
          }
        : null,
    };
  }

  return {
    async load() {
      const files = [
        ...(options.kernelFiles ?? []).map((path) => ({ prefix: 'ai.', path })),
        ...(options.moduleFiles ?? []).map((file) => ({
          prefix: `${file.moduleId}.`,
          path: file.path,
        })),
      ];
      const problems: string[] = [];
      for (const file of files) {
        try {
          const prompt = parsePromptFile(await readFile(file.path, 'utf8'), file.path);
          if (!prompt.id.startsWith(file.prefix)) {
            throw new PromptFileError(
              `${file.path}: the id "${prompt.id}" must start with "${file.prefix}"`,
            );
          }
          const existing = prompts.get(prompt.id);
          if (existing && existing.source !== file.path) {
            throw new PromptFileError(
              `${file.path}: "${prompt.id}" is already defined by ${existing.source}`,
            );
          }
          prompts.set(prompt.id, prompt);
        } catch (error) {
          problems.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (problems.length)
        throw new PromptFileError(`AI prompts are invalid:\n${problems.join('\n')}`);
    },
    async render(id, variables) {
      const prompt = definition(id);
      const override = (await overrides()).get(id);
      const body = override ? splitBody(override.template, `override of ${id}`) : prompt;
      const system = 'system' in body ? body.system : '';
      return {
        role: prompt.role,
        system: fill(system, variables, id),
        prompt: fill(body.template, variables, id),
        promptRef: { id, version: prompt.version },
        outputSchema: prompt.output_schema,
      };
    },
    async list() {
      const all = [...prompts.values()].sort((a, b) => a.id.localeCompare(b.id));
      return Promise.all(all.map(toApi));
    },
    async setOverride(id, template, userId) {
      const prompt = definition(id);
      if (!options.sql) throw new ValidationError('Prompt overrides need the database');
      try {
        const body = splitBody(template, `override of ${id}`);
        checkVariables(prompt.variables, [body.system, body.template], `override of ${id}`);
      } catch (error) {
        if (error instanceof PromptFileError) throw new ValidationError(error.message);
        throw error;
      }
      await upsertOverride(options.sql, {
        promptId: id,
        template,
        baseVersion: prompt.version,
        updatedBy: userId,
      });
      cached = null;
      return toApi(prompt);
    },
    async resetOverride(id) {
      definition(id);
      if (options.sql) await deleteOverride(options.sql, id);
      cached = null;
    },
    async diff(id) {
      const prompt = definition(id);
      const override = (await overrides()).get(id);
      const base = bodyOf(prompt);
      return { id, lines: diffLines(base, override?.template ?? base) };
    },
  };
}
