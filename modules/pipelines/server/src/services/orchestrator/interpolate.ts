import { ValidationError } from '@bemmoly/shared';
import {
  INTERPOLATION_PATTERN,
  MATRIX_INTERPOLATION_PATTERN,
  type Scalar,
} from '../../../../shared/pipeline-spec.ts';

/**
 * Replaces `${{ inputs.x }}` and `${{ matrix.y }}` in one string. A name that is not there
 * fails the run before it starts rather than running a step with a hole in its command.
 */
export function interpolate(
  text: string,
  inputs: Readonly<Record<string, Scalar>>,
  matrix: Readonly<Record<string, Scalar>> | null = null,
): string {
  const withInputs = text.replace(new RegExp(INTERPOLATION_PATTERN.source, 'g'), (_, name) => {
    const value = inputs[name as string];
    if (value === undefined)
      throw new ValidationError(`"${text}" names input "${name}", which has no value`);
    return String(value);
  });
  return withInputs.replace(new RegExp(MATRIX_INTERPOLATION_PATTERN.source, 'g'), (_, name) => {
    const value = matrix?.[name as string];
    if (value === undefined)
      throw new ValidationError(
        `"${text}" names matrix axis "${name}", which this step does not have`,
      );
    return String(value);
  });
}

export function interpolateRecord(
  record: Readonly<Record<string, string>>,
  inputs: Readonly<Record<string, Scalar>>,
  matrix: Readonly<Record<string, Scalar>> | null = null,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, interpolate(value, inputs, matrix)]),
  );
}
