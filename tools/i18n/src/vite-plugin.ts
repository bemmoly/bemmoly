import type { Plugin } from 'vite';
import { CATALOG_FILE, compileCatalog, parseCatalog } from './compile.ts';

/**
 * Compiles every message catalog (`…/i18n/<namespace>.<locale>.json`) as it is imported, so
 * the web build ships Lingui's small runtime and no ICU parser. The output is still JSON, so
 * Vite's own JSON handling, chunking and lazy imports work unchanged. A message that does
 * not parse fails the build with its file and id.
 */
export function messageCatalogs(): Plugin {
  return {
    name: 'bemmoly:message-catalogs',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!CATALOG_FILE.test(file)) return null;
      return { code: JSON.stringify(compileCatalog(parseCatalog(code, file), file)), map: null };
    },
  };
}
