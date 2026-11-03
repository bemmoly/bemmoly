import { defineCatalog } from '@bemmoly/core-web';
import errors from '@bemmoly/shared/i18n/errors.en.json' with { type: 'json' };
import changeRequests from './pipelinesChangeRequests.en.json' with { type: 'json' };
import editor from './pipelinesEditor.en.json' with { type: 'json' };
import environments from './pipelinesEnvironments.en.json' with { type: 'json' };
import forYou from './pipelinesForYou.en.json' with { type: 'json' };
import roles from './pipelinesRoles.en.json' with { type: 'json' };
import runs from './pipelinesRuns.en.json' with { type: 'json' };
import services from './pipelinesServices.en.json' with { type: 'json' };
import setup from './pipelinesSetup.en.json' with { type: 'json' };
import source from './pipelines.en.json' with { type: 'json' };

/*
 * Pipelines' words (ADR 0025): one namespace for the shell and its screens, English shipped
 * with the code that draws it. A translated locale adds a lazy loader here.
 */
export const pipelinesText = defineCatalog('pipelines', source);

/*
 * The simpler Pipelines keeps each area's words in its own file and namespace (ids start with
 * the file's name, e.g. "pipelinesRoles.people.title"), so the streams building the areas in
 * parallel never edit the same catalog.
 */
export const rolesText = defineCatalog('pipelinesRoles', roles);
export const environmentsText = defineCatalog('pipelinesEnvironments', environments);
export const setupText = defineCatalog('pipelinesSetup', setup);
export const changeRequestsText = defineCatalog('pipelinesChangeRequests', changeRequests);
export const editorText = defineCatalog('pipelinesEditor', editor);
export const runsText = defineCatalog('pipelinesRuns', runs);
export const servicesText = defineCatalog('pipelinesServices', services);
export const forYouText = defineCatalog('pipelinesForYou', forYou);

/** The server's own messages, named by the messageId on an error body. */
export const errorsText = defineCatalog('errors', errors);
