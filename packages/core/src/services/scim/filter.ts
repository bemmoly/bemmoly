import { ValidationError } from '@bemmoly/shared';

export interface ScimFilter {
  attribute: string;
  value: string;
}

const EQUALS = /^\s*([A-Za-z][\w.:]*)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i;

/**
 * The one filter identity providers send before creating a resource: `attr eq "value"`
 * (for example `userName eq "ada@acme.dev"`). Anything richer is refused with 400, as
 * RFC 7644 allows a server that does not support a filter to do.
 */
export function parseScimFilter(filter: string | undefined, supported: readonly string[]) {
  if (filter === undefined || filter.trim() === '') return null;
  const match = EQUALS.exec(filter);
  const attribute = match?.[1];
  if (!match || !attribute) {
    throw new ValidationError('Only filters of the form attribute eq "value" are supported', {
      details: { scimType: 'invalidFilter' },
    });
  }
  const known = supported.find((name) => name.toLowerCase() === attribute.toLowerCase());
  if (!known) {
    throw new ValidationError(`Filtering on ${attribute} is not supported`, {
      details: { scimType: 'invalidFilter' },
    });
  }
  return { attribute: known, value: (match[2] ?? '').replace(/\\(.)/g, '$1') } satisfies ScimFilter;
}
