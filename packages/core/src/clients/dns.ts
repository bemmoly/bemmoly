import { Resolver } from 'node:dns/promises';

const NO_RECORD_CODES = new Set(['ENODATA', 'ENOTFOUND', 'NXDOMAIN']);

export class DnsLookupError extends Error {
  override readonly name = 'DnsLookupError';
}

export type TxtLookup = (name: string) => Promise<string[]>;

/**
 * TXT records of a name, each record's strings joined. A name with no TXT
 * records answers `[]`; a resolver that fails or times out throws.
 */
export function createTxtLookup(timeoutMs: number): TxtLookup {
  const resolver = new Resolver({ timeout: timeoutMs, tries: 2 });
  return async (name) => {
    try {
      const records = await resolver.resolveTxt(name);
      return records.map((chunks) => chunks.join(''));
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === 'string' && NO_RECORD_CODES.has(code)) return [];
      throw new DnsLookupError(`Could not look up TXT records for ${name}`, { cause: error });
    }
  };
}
