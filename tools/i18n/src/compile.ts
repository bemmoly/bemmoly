import { compileMessageOrThrow, type CompiledMessage } from '@lingui/message-utils/compileMessage';

/** `<anything>/i18n/<namespace>.<locale>.json`: one namespace in one language. */
export const CATALOG_FILE =
  /[\\/]i18n[\\/]([a-z][\w-]*)\.([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.json$/;

export type SourceCatalog = Record<string, string>;

/** Ids are `<namespace>.<area>.<name>` in camelCase segments: "shell.nav.home". */
export const ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/;

export class CatalogError extends Error {
  override readonly name = 'CatalogError';
}

/** Parses one catalog file's text; every value must be a string. */
export function parseCatalog(text: string, file: string): SourceCatalog {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new CatalogError(`${file}: not valid JSON (${(error as Error).message})`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CatalogError(`${file}: a catalog is one JSON object of id → message`);
  }
  for (const [id, message] of Object.entries(data)) {
    if (typeof message !== 'string') throw new CatalogError(`${file}: ${id} is not a string`);
  }
  return data as SourceCatalog;
}

export function compileOne(message: string, where: string): CompiledMessage {
  try {
    return compileMessageOrThrow(message);
  } catch (error) {
    throw new CatalogError(`${where}: ${(error as Error).message}`);
  }
}

/**
 * The ICU messages of a catalog compiled to Lingui's runtime form, so the browser ships no
 * parser (ADR 0024). Throws on the first message that does not parse, naming it.
 */
export function compileCatalog(catalog: SourceCatalog, file: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(catalog).map(([id, message]) => [id, compileOne(message, `${file}: ${id}`)]),
  );
}

/** The argument names a message uses, nested choices included: "{count}", "{name}". */
export function argumentsOf(message: CompiledMessage): Set<string> {
  const names = new Set<string>();
  const walk = (tokens: CompiledMessage) => {
    for (const token of tokens) {
      if (typeof token === 'string') continue;
      const [name, , format] = token;
      names.add(name);
      if (format && typeof format === 'object') {
        for (const value of Object.values(format)) {
          if (Array.isArray(value)) walk(value as CompiledMessage);
        }
      }
    }
  };
  walk(message);
  return names;
}
