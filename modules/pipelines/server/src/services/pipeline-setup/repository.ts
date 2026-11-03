import { ValidationError } from '@bemmoly/shared';
import { parse } from 'yaml';
import {
  pipelineDefinitionSchema,
  type PipelineDefinition,
  type PipelineStepSpec,
} from '../../../../shared/pipeline-spec.ts';
import type { RepositoryFileCandidate } from '../../../../shared/pipeline-setup.ts';
import type { RepositoryTree } from '../code/repository-reader.ts';
import { slugOf } from '../orchestrator/resolve.ts';

/*
 * "A file in the repository": the pipeline files Bemmoly can read in a service's repository,
 * and turning one into a pipeline. A Bemmoly file is read as written; a GitHub Actions
 * workflow gives its `run` steps, one step per job, in the jobs' order. Actions it `uses`
 * have no equivalent here and are named in the result, never dropped silently.
 */

const WORKFLOWS = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const BEMMOLY = /(^|\/)\.bemmoly\/[^/]+\.ya?ml$/;

/** Pipeline files in the tree, the service's own folder first. */
export function candidateFiles(tree: RepositoryTree, folder: string): RepositoryFileCandidate[] {
  const own = (path: string) =>
    folder ? path.startsWith(`${folder}/`) : !path.includes('/.bemmoly/');
  return tree.paths
    .filter((path) => WORKFLOWS.test(path) || (BEMMOLY.test(path) && own(path)))
    .sort((a, b) => Number(WORKFLOWS.test(a)) - Number(WORKFLOWS.test(b)) || a.localeCompare(b))
    .slice(0, 50)
    .map((path) => ({ path, kind: WORKFLOWS.test(path) ? 'github_actions' : 'bemmoly' }));
}

export interface ImportedPipeline {
  definition: PipelineDefinition;
  /** Steps the file had that Bemmoly cannot run as they are. */
  skipped: string[];
}

function readYaml(content: string, path: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = parse(content, { maxAliasCount: 50 });
  } catch {
    throw new ValidationError(`${path} is not valid YAML`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError(`${path} is not a pipeline file`);
  }
  return raw as Record<string, unknown>;
}

const IMAGE = 'debian:bookworm-slim';

function fromWorkflow(file: Record<string, unknown>, path: string): ImportedPipeline {
  const jobs = file['jobs'];
  if (typeof jobs !== 'object' || jobs === null) {
    throw new ValidationError(`${path} has no jobs`);
  }
  const skipped: string[] = [];
  const test: PipelineStepSpec[] = [];
  const keys = new Set<string>();
  for (const [id, raw] of Object.entries(jobs as Record<string, unknown>)) {
    const job = (raw ?? {}) as { name?: unknown; needs?: unknown; steps?: unknown };
    const steps = Array.isArray(job.steps) ? (job.steps as Array<Record<string, unknown>>) : [];
    const commands = steps.flatMap((step) => {
      if (typeof step['run'] === 'string') return [step['run']];
      if (typeof step['uses'] === 'string' && !step['uses'].startsWith('actions/checkout')) {
        skipped.push(`${typeof step['name'] === 'string' ? step['name'] : step['uses']} (${id})`);
      }
      return [];
    });
    if (commands.length === 0) continue;
    const key = slugOf(id);
    keys.add(key);
    const needs = (Array.isArray(job.needs) ? job.needs : job.needs ? [job.needs] : [])
      .map((need) => slugOf(String(need)))
      .filter((need) => keys.has(need));
    test.push({
      name: typeof job.name === 'string' ? job.name.slice(0, 120) : id,
      key,
      image: IMAGE,
      run: commands.join('\n'),
      needs,
      locked: false,
      env: {},
      secrets: [],
      artifacts: [],
    });
  }
  if (test.length === 0) throw new ValidationError(`${path} has no steps Bemmoly can run`);
  return { definition: { inputs: {}, checkout: true, test, schedules: [] }, skipped };
}

/** The pipeline a repository file describes, or a refusal that says why it cannot be read. */
export function importFile(content: string, path: string): ImportedPipeline {
  const file = readYaml(content, path);
  if (WORKFLOWS.test(path)) return fromWorkflow(file, path);
  const candidate = 'pipeline' in file ? file['pipeline'] : file;
  const parsed = pipelineDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(
      `${path} is not a Bemmoly pipeline: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim(),
    );
  }
  return { definition: parsed.data, skipped: [] };
}
