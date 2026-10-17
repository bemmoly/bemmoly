import { defineCatalog } from '@bemmoly/core-web';
import errors from '@bemmoly/shared/i18n/errors.en.json' with { type: 'json' };
import source from './pipelines.en.json' with { type: 'json' };

/*
 * Pipelines' words (ADR 0025): one namespace for the shell and its screens, English shipped
 * with the code that draws it. A translated locale adds a lazy loader here.
 */
export const pipelinesText = defineCatalog('pipelines', source);

/** The server's own messages, named by the messageId on an error body. */
export const errorsText = defineCatalog('errors', errors);
