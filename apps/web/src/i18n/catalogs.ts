import { defineCatalog } from '@bemmoly/core-web';
import errors from '@bemmoly/shared/i18n/errors.en.json' with { type: 'json' };
import shellSource from './shell.en.json' with { type: 'json' };

/*
 * The shell's namespaces (ADR 0024). English is imported here, so it ships with the code that
 * draws it; a translated locale adds one lazy loader per namespace:
 *   defineCatalog('shell', shellSource, { fr: () => import('./shell.fr.json') })
 * Settings (./settings.ts) and sign-in (./auth.ts) keep their own namespaces, loaded with
 * their pages.
 */

/** The frame around every page: sidebar, menus and the phone bar. */
export const shellText = defineCatalog('shell', shellSource);

/** The server's own messages, named by the messageId on an error body. */
export const errorsText = defineCatalog('errors', errors);
