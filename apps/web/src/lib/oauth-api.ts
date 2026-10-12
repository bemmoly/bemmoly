import { oauthEndpoints } from '@bemmoly/api-client/oauth';
import { api } from './api.ts';

/** The consent screen and Connected apps: endpoints on the shell's client but out of its first load. */
export const oauthApi = oauthEndpoints(api.http);
