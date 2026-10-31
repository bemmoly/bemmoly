import {
  applicationFileSchema,
  type ApplicationFile,
} from '../../../../shared/application-yaml.ts';
import {
  REPOSITORY_FILE_PATH,
  type RepositoryEntry,
  type RepositoryFile,
  type SettingOrigin,
} from '../../../../shared/repository-yaml.ts';

/*
 * One application's settings from up to three layers: the repository file's `defaults`, its
 * entry in the repository file's central list, and the folder's own application.yaml. A later
 * layer beats an earlier one. Lists such as `paths` and `labels` add up; objects merge key by
 * key (so a build arg can be added without restating the Dockerfile); anything else is
 * replaced, and null removes what an earlier layer set. The merged settings are then checked
 * like any application.yaml, and an error names the file and the field it came from.
 */

type Values = Record<string, unknown>;

export interface Layer {
  origin: SettingOrigin;
  /** The file this layer was written in, for errors. */
  file: string;
  /** How a field is written in that file: "defaults.", "applications.3.", or "". */
  prefix: string;
  values: Values;
}

export type Merged =
  | { ok: true; file: ApplicationFile; fields: Record<string, SettingOrigin> }
  | { ok: false; file: string; error: string };

const LISTS = new Set(['paths', 'labels', 'dependsOn']);

const isPlain = (value: unknown): value is Values =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function mergeValues(base: Values, over: Values, top: boolean): Values {
  const out: Values = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    if (value === null) delete out[key];
    else if (top && LISTS.has(key) && Array.isArray(current) && Array.isArray(value)) {
      out[key] = [...new Set([...current, ...value])];
    } else if (isPlain(current) && isPlain(value)) out[key] = mergeValues(current, value, false);
    else out[key] = value;
  }
  return out;
}

/** `build` written beside the other settings goes under `pipeline`, where builds live. */
function withBuild(values: Values, build: unknown): Values {
  if (build === undefined) return values;
  const pipeline = isPlain(values.pipeline) ? values.pipeline : {};
  return { ...values, pipeline: { ...pipeline, build } };
}

export function layersFor(
  repository: RepositoryFile | null,
  entry: { index: number; value: RepositoryEntry } | null,
  own: { path: string; values: Values } | null,
): Layer[] {
  const layers: Layer[] = [];
  if (repository) {
    const { build, ...rest } = repository.defaults;
    layers.push({
      origin: 'defaults',
      file: REPOSITORY_FILE_PATH,
      prefix: 'defaults.',
      values: withBuild(rest, build),
    });
  }
  if (entry) {
    // The folder says where the application lives; it is not one of its settings.
    const { build, ...rest }: Values & { build?: unknown } = { ...entry.value, path: undefined };
    delete rest.path;
    layers.push({
      origin: 'central',
      file: REPOSITORY_FILE_PATH,
      prefix: `applications.${entry.index}.`,
      values: withBuild(rest, build),
    });
  }
  if (own) layers.push({ origin: 'file', file: own.path, prefix: '', values: own.values });
  return layers;
}

/** Top-level settings by where they came from; the pipeline's build is counted on its own. */
function originsOf(layers: readonly Layer[], merged: Values): Record<string, SettingOrigin> {
  const fields: Record<string, SettingOrigin> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer.values)) {
      if (key !== 'pipeline') fields[key] = layer.origin;
      else if (isPlain(value)) {
        if (Object.keys(value).some((name) => name !== 'build')) fields.pipeline = layer.origin;
        if ('build' in value) fields.build = layer.origin;
      }
    }
  }
  const pipeline = isPlain(merged.pipeline) ? merged.pipeline : {};
  for (const key of Object.keys(fields)) {
    if (key === 'build' ? !('build' in pipeline) : !(key in merged)) delete fields[key];
  }
  return fields;
}

export function mergeLayers(layers: readonly Layer[]): Merged {
  let merged: Values = {};
  for (const layer of layers) merged = mergeValues(merged, layer.values, true);
  if (isPlain(merged.pipeline) && Object.keys(merged.pipeline).length === 0) delete merged.pipeline;
  const fields = originsOf(layers, merged);
  const parsed = applicationFileSchema.safeParse(merged);
  if (parsed.success) return { ok: true, file: parsed.data, fields };
  const issue = parsed.error.issues[0];
  const path = issue?.path.map(String) ?? [];
  const top = path[0] === 'pipeline' && path[1] === 'build' ? 'build' : path[0];
  const origin = top ? fields[top] : undefined;
  // A field nobody set (a missing group) is the strongest layer's to add.
  const layer = layers.find((candidate) => candidate.origin === origin) ?? layers.at(-1);
  const where = path.length > 0 ? `${layer?.prefix ?? ''}${path.join('.')}: ` : '';
  return {
    ok: false,
    file: layer?.file ?? REPOSITORY_FILE_PATH,
    error: `${where}${issue?.message ?? 'The settings are not valid'}`,
  };
}
