import { parse, stringify } from 'yaml';
import {
  APPLICATION_FILE_PATH,
  applicationFileSchema,
  type ApplicationFile,
  type ApplicationFileInput,
} from '../../../../shared/application-yaml.ts';

/*
 * `.bemmoly/application.yaml` as text: written for pull requests (UI edits, discovery) and
 * read on pushes to the default branch. Reading never throws; a file that does not parse
 * or validate says why, in words a person can fix in their editor.
 */

export type FileRead = { ok: true; file: ApplicationFile } | { ok: false; error: string };

export function readApplicationFile(content: string): FileRead {
  let raw: unknown;
  try {
    raw = parse(content, { maxAliasCount: 50 });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n', 1)[0] : String(error);
    return { ok: false, error: `The YAML does not parse: ${message}` };
  }
  const parsed = applicationFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return { ok: false, error: `${where}${issue?.message ?? 'The file is not valid'}` };
  }
  return { ok: true, file: parsed.data };
}

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
