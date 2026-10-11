import { defineCatalog } from '@bemmoly/core-web';
import errors from '@bemmoly/shared/i18n/errors.en.json' with { type: 'json' };
import shellSource from './shell.en.json' with { type: 'json' };

/*
 * The shell's namespaces (ADR 0024). English is imported here, so it ships with the code that
 * draws it; a translated locale adds one lazy loader per namespace:
 *   defineCatalog('shell', shellSource, { fr: () => import('./shell.fr.json') })
 * Settings keeps its own namespace in ./settings.ts, loaded with the settings pages.
 */

/** The frame around every page: sidebar, menus, the phone bar, and sign-in. */
export const shell = defineCatalog('shell', shellSource);

/** The server's own messages, named by the messageId on an error body. */
export const serverErrors = defineCatalog('errors', errors);
