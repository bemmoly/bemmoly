import { ssoEndpoints } from '@bemmoly/api-client/sso';
import { api } from './api.ts';

/** Sign-in's single sign-on options and Settings › Sign-in: endpoints on the shell's client but out of its first load. */
export const ssoApi = ssoEndpoints(api.http);
