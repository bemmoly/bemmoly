import { aiPromptFrontmatterSchema, type AiPromptFrontmatter } from '@bemmoly/shared';
import { parse as parseYaml } from 'yaml';

/** A prompt as the repository defines it. */
export interface PromptDefinition extends AiPromptFrontmatter {
  /** The file it came from, for error messages. */
  source: string;
  system: string;
  template: string;
}

export class PromptFileError extends Error {
  override readonly name = 'PromptFileError';
}

const VARIABLE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function variablesUsed(text: string): Set<string> {
  return new Set([...text.matchAll(VARIABLE)].map((match) => match[1]!));
}

/**
 * The body of a prompt file: an optional `# System` section (stable per purpose, so prompt
 * caching works) and a required `# Prompt` section (the volatile user turn).
 */
export function splitBody(body: string, source: string): { system: string; template: string } {
  const lines = body.split(/\r?\n/);
  const systemAt = lines.findIndex((line) => line.trim() === '# System');
  const promptAt = lines.findIndex((line) => line.trim() === '# Prompt');
  if (promptAt === -1) throw new PromptFileError(`${source}: a prompt needs a "# Prompt" section`);
  if (systemAt > promptAt) {
    throw new PromptFileError(`${source}: "# System" must come before "# Prompt"`);
  }
  const system =
    systemAt === -1
      ? ''
      : lines
          .slice(systemAt + 1, promptAt)
          .join('\n')
          .trim();
  const template = lines
    .slice(promptAt + 1)
    .join('\n')
    .trim();
  if (!template) throw new PromptFileError(`${source}: the "# Prompt" section is empty`);
  return { system, template };
}

/** Every variable used is declared and every declared one is used. */
export function checkVariables(
  declared: readonly string[],
  texts: readonly string[],
  source: string,
): void {
  const used = new Set(texts.flatMap((text) => [...variablesUsed(text)]));
  const undeclared = [...used].filter((name) => !declared.includes(name));
  if (undeclared.length) {
    throw new PromptFileError(`${source}: uses undeclared variables ${undeclared.join(', ')}`);
  }
  const unused = declared.filter((name) => !used.has(name));
  if (unused.length) {
    throw new PromptFileError(`${source}: declares variables it never uses: ${unused.join(', ')}`);
  }
}

/** Parses and validates one prompt file's text. */
export function parsePromptFile(text: string, source: string): PromptDefinition {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new PromptFileError(`${source}: a prompt file starts with --- frontmatter ---`);
  let raw: unknown;
  try {
    raw = parseYaml(match[1]!);
  } catch (error) {
    throw new PromptFileError(`${source}: frontmatter is not valid YAML`, { cause: error });
  }
  const parsed = aiPromptFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PromptFileError(
      `${source}: frontmatter ${issue?.path.join('.') || ''} ${issue?.message ?? 'is invalid'}`.trim(),
    );
  }
  const { system, template } = splitBody(match[2]!, source);
  checkVariables(parsed.data.variables, [system, template], source);
  return { ...parsed.data, source, system, template };
}

/** Fills {{variables}}; a missing value is an error, never a silent blank. */
export function fill(
  text: string,
  variables: Readonly<Record<string, string>>,
  id: string,
): string {
  return text.replace(VARIABLE, (_, name: string) => {
    const value = variables[name];
    if (value === undefined) throw new PromptFileError(`Prompt "${id}" needs a value for ${name}`);
    return value;
  });
}
