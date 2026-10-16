import { ValidationError } from '@bemmoly/shared';
import type { Scalar, TemplateInput } from '../../../../shared/pipeline-spec.ts';

/*
 * The values a run's inputs take: each input's default, then what the application passes
 * the template with `with`, then what a person typed on "Run pipeline…" or a schedule set.
 * Every value is checked against its declared type, so a template never sees "true" where
 * it asked for a boolean.
 */

export type InputDeclarations = Record<string, TemplateInput>;

function coerce(name: string, input: TemplateInput, value: Scalar): Scalar {
  switch (input.type) {
    case 'number': {
      const number = typeof value === 'number' ? value : Number(value);
      if (typeof value === 'boolean' || !Number.isFinite(number) || value === '') {
        throw new ValidationError(`Input "${name}" takes a number`);
      }
      return number;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 'false') return value === 'true';
      throw new ValidationError(`Input "${name}" takes true or false`);
    case 'choice': {
      const text = String(value);
      if (!input.options?.includes(text)) {
        throw new ValidationError(
          `Input "${name}" takes one of: ${(input.options ?? []).join(', ')}`,
        );
      }
      return text;
    }
    default:
      return String(value);
  }
}

/** Merges the layers in order and checks each value; unknown names and missing required fail. */
export function resolveInputValues(
  declared: InputDeclarations,
  layers: ReadonlyArray<Readonly<Record<string, Scalar>>>,
): Record<string, Scalar> {
  const values: Record<string, Scalar> = {};
  for (const [name, input] of Object.entries(declared)) {
    if (input.default !== undefined) values[name] = coerce(name, input, input.default);
  }
  for (const layer of layers) {
    for (const [name, value] of Object.entries(layer)) {
      const input = declared[name];
      if (!input) throw new ValidationError(`The pipeline has no input called "${name}"`);
      values[name] = coerce(name, input, value);
    }
  }
  for (const [name, input] of Object.entries(declared)) {
    if (input.required && values[name] === undefined) {
      throw new ValidationError(`Input "${name}" is required`);
    }
  }
  return values;
}
