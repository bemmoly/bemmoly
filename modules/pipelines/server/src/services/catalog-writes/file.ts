import { parse, stringify } from 'yaml';
import {
  APPLICATION_FILE_PATH,
  applicationFileSchema,
  type ApplicationFile,
  type ApplicationFileInput,
} from '../../../../shared/application-yaml.ts';
import {
  REPOSITORY_FILE_PATH,
  repositoryFileSchema,
  type RepositoryFile,
} from '../../../../shared/repository-yaml.ts';

/*
 * `.bemmoly/application.yaml` as text: written for pull requests (UI edits, discovery) and
 * read on pushes to the default branch. Reading never throws; a file that does not parse
 * or validate says why, in words a person can fix in their editor.
 */

export type FileRead = { ok: true; file: ApplicationFile } | { ok: false; error: string };

export type RawRead = { ok: true; values: Record<string, unknown> } | { ok: false; error: string };

/** The YAML as a mapping, unchecked, for merging with the repository file first. */
export function readYamlMapping(content: string): RawRead {
  let raw: unknown;
  try {
    raw = parse(content, { maxAliasCount: 50 });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n', 1)[0] : String(error);
    return { ok: false, error: `The YAML does not parse: ${message}` };
  }
  if (raw === null || raw === undefined) return { ok: true, values: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'The file must be a mapping of settings, such as name: orders' };
  }
  return { ok: true, values: raw as Record<string, unknown> };
}

function firstIssue(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
  const issue = issues[0];
  const where = issue?.path.length ? `${issue.path.map(String).join('.')}: ` : '';
  return `${where}${issue?.message ?? 'The file is not valid'}`;
}

export function readApplicationFile(content: string): FileRead {
  const raw = readYamlMapping(content);
  if (!raw.ok) return raw;
  const parsed = applicationFileSchema.safeParse(raw.values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  return { ok: true, file: parsed.data };
}

export type RepositoryRead = { ok: true; file: RepositoryFile } | { ok: false; error: string };

export function readRepositoryFile(content: string): RepositoryRead {
  const raw = readYamlMapping(content);
  if (!raw.ok) return raw;
  const parsed = repositoryFileSchema.safeParse(raw.values);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  return { ok: true, file: parsed.data };
}

export const isRepositoryFile = (path: string) => path === REPOSITORY_FILE_PATH;

/** The file for an application, leaving out what equals the defaults so it stays short. */
export function writeApplicationFile(file: ApplicationFileInput): string {
  const out: Record<string, unknown> = { name: file.name, group: file.group };
  if (file.domain) out.domain = file.domain;
  if (file.owner) out.owner = file.owner;
  out.tier = file.tier ?? 2;
  if (file.labels?.length) out.labels = file.labels;
  if (file.lifecycle && file.lifecycle !== 'production') out.lifecycle = file.lifecycle;
  if (file.runtime) out.runtime = file.runtime;
  if (file.description) out.description = file.description;
  if (file.dependsOn?.length) out.dependsOn = file.dependsOn;
  if (file.paths?.length) out.paths = file.paths;
  if (file.pipeline) out.pipeline = file.pipeline;
  return stringify(out, { lineWidth: 100 });
}

/** Where an application's file sits: next to its code in a monorepo, else at the root. */
export function applicationFilePath(appPath: string): string {
  const base = appPath.replace(/^\/+|\/+$/g, '');
  return base ? `${base}/${APPLICATION_FILE_PATH}` : APPLICATION_FILE_PATH;
}

/** The application's folder for a file found at `filePath`. */
export function applicationPathOf(filePath: string): string {
  return filePath.endsWith(APPLICATION_FILE_PATH)
    ? filePath.slice(0, -APPLICATION_FILE_PATH.length).replace(/\/+$/, '')
    : '';
}

export const isApplicationFile = (path: string) =>
  path === APPLICATION_FILE_PATH || path.endsWith(`/${APPLICATION_FILE_PATH}`);
