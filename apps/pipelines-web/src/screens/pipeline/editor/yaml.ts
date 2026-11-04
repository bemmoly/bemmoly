import type { PipelineSpec, PipelineTrigger } from '@bemmoly/module-pipelines/shared';

/*
 * The YAML view: the same pipeline as the graph, as it would be written in the repository's
 * .bemmoly/application.yaml under `pipeline:`. Read-only text; empty values are left out.
 */

type Value = string | number | boolean | null | undefined | Value[] | { [key: string]: Value };

const PLAIN = /^[A-Za-z0-9_./@:${}() -]+$/;

function scalar(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  if (value === '' || !PLAIN.test(value) || /^[\s-]|:\s|\s$|^(true|false|null|\d)/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

const empty = (value: Value) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

function lines(value: Value, indent: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const [first = '', ...rest] = lines(item, `${indent}  `);
        return [`${indent}- ${first.trimStart()}`, ...rest];
      }
      return [`${indent}- ${scalar(item as string)}`];
    });
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => {
      if (empty(item)) return [];
      if (typeof item === 'string' && item.includes('\n')) {
        return [`${indent}${key}: |`, ...item.split('\n').map((line) => `${indent}  ${line}`)];
      }
      if (typeof item === 'object' && item !== null) {
        return [`${indent}${key}:`, ...lines(item, `${indent}  `)];
      }
      return [`${indent}${key}: ${scalar(item as string)}`];
    });
  }
  return [`${indent}${scalar(value as string)}`];
}

export function pipelineYaml(
  definition: PipelineSpec,
  triggers: readonly PipelineTrigger[],
): string {
  const document: Value = {
    on: triggers.map((trigger) => ({ ...trigger })) as Value,
    build: definition.build as Value,
    test: definition.test.map((step) => ({
      name: step.name,
      key: step.key,
      environment: step.environment,
      needs: step.needs,
      image: step.image,
      uses: step.uses,
      run: step.run,
      env: step.env,
      secrets: step.secrets,
      timeoutMinutes: step.timeoutMinutes,
    })) as Value,
  };
  return lines(document, '').join('\n');
}
