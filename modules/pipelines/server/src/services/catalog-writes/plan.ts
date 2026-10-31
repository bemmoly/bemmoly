import type { ApplicationFile } from '../../../../shared/application-yaml.ts';
import {
  REPOSITORY_FILE_PATH,
  type RepositoryEntry,
  type SettingOrigin,
} from '../../../../shared/repository-yaml.ts';
import {
  applicationPathOf,
  isApplicationFile,
  isRepositoryFile,
  readRepositoryFile,
  readYamlMapping,
} from './file.ts';
import { layersFor, mergeLayers } from './merge.ts';

/*
 * What a push's catalog files mean, before anything is written: which applications to apply
 * with which merged settings, which files' applications to archive, and what is wrong. Pure,
 * so precedence and archiving are tested without a database.
 *
 * Without a repository file each application.yaml stands alone, as before. With one, each
 * folder's file is merged over its central entry and the defaults. When the push changed the
 * repository file, the caller hands over every catalog file (`complete`), so every central
 * entry is applied and an application whose entry is gone is archived, the way deleting its
 * application.yaml archives it.
 */

export interface CatalogFile {
  path: string;
  content: string | null;
}

export interface PlannedApplication {
  /** The file that defines it: its own application.yaml, or the repository file. */
  path: string;
  folder: string;
  /** That file's text, to match the pull request a UI edit opened. */
  content: string;
  file: ApplicationFile;
  fields: Record<string, SettingOrigin>;
}

export interface PlanProblem {
  path: string;
  message: string;
  applied: boolean;
}

export interface CatalogPlan {
  applications: PlannedApplication[];
  problems: PlanProblem[];
  /** application.yaml files deleted with no central entry to fall back on. */
  archiveFiles: string[];
  /** When set, central applications not named here are archived. */
  keepCentral: string[] | null;
  /** The repository file read cleanly, so an error it had is gone. */
  repositoryFileFixed: boolean;
}

type Entry = { index: number; value: RepositoryEntry };

function readRepository(input: CatalogFile | undefined) {
  if (!input?.content) return { repository: null, error: null };
  const read = readRepositoryFile(input.content);
  return read.ok ? { repository: read.file, error: null } : { repository: null, error: read.error };
}

export function planCatalogFiles(files: readonly CatalogFile[], complete: boolean): CatalogPlan {
  const repositoryInput = files.find((file) => isRepositoryFile(file.path));
  const own = files.filter((file) => isApplicationFile(file.path));
  const plan: CatalogPlan = {
    applications: [],
    problems: [],
    archiveFiles: [],
    keepCentral: null,
    repositoryFileFixed: false,
  };
  const { repository, error } = readRepository(repositoryInput);
  if (error) {
    plan.problems.push({ path: REPOSITORY_FILE_PATH, message: error, applied: false });
    for (const file of own.filter((item) => item.content !== null)) {
      plan.problems.push({
        path: file.path,
        message: `Not applied until ${REPOSITORY_FILE_PATH} is fixed.`,
        applied: false,
      });
    }
    return plan;
  }
  plan.repositoryFileFixed = repository !== null;
  const entries = new Map<string, Entry>(
    (repository?.applications ?? []).map((value, index) => [value.path, { index, value }]),
  );
  const covered = new Set<string>();
  const fallBack: Entry[] = [];
  for (const { path, content } of own) {
    const folder = applicationPathOf(path);
    const entry = entries.get(folder) ?? null;
    if (content === null) {
      if (entry) fallBack.push(entry);
      else plan.archiveFiles.push(path);
      continue;
    }
    covered.add(folder);
    const raw = readYamlMapping(content);
    if (!raw.ok) {
      plan.problems.push({ path, message: raw.error, applied: false });
      continue;
    }
    const merged = mergeLayers(layersFor(repository, entry, { path, values: raw.values }));
    if (!merged.ok) {
      plan.problems.push({ path: merged.file, message: merged.error, applied: false });
      continue;
    }
    plan.applications.push({ path, folder, content, file: merged.file, fields: merged.fields });
  }
  const central = complete ? [...entries.values()] : fallBack;
  for (const entry of central) {
    if (covered.has(entry.value.path)) continue;
    const merged = mergeLayers(layersFor(repository, entry, null));
    if (!merged.ok) {
      plan.problems.push({ path: merged.file, message: merged.error, applied: false });
      continue;
    }
    plan.applications.push({
      path: REPOSITORY_FILE_PATH,
      folder: entry.value.path,
      content: repositoryInput?.content ?? '',
      file: merged.file,
      fields: merged.fields,
    });
  }
  if (complete && repositoryInput) {
    // An entry that is still listed but does not apply right now keeps its application.
    plan.keepCentral = [...entries.values()].map((entry) => entry.value.name);
  }
  return plan;
}
