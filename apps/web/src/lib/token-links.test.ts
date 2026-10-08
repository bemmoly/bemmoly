import {
  ACCEPT_INVITATION_PATH,
  RESET_PASSWORD_PATH,
  tokenLinkPath,
  tokenOfLink,
} from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { invitationRoute, resetPasswordRoute } from '../router/public-routes.tsx';

const pathOf = (route: { options: object }) => (route.options as { path?: string }).path;

/**
 * The server builds invitation and reset links from the shared paths; this holds the router
 * to the same paths, so an emailed or copied link always opens a page that exists.
 */
describe('token links', () => {
  it('open routes the web router registers', () => {
    expect(pathOf(invitationRoute)).toBe(ACCEPT_INVITATION_PATH);
    expect(pathOf(resetPasswordRoute)).toBe(RESET_PASSWORD_PATH);
  });

  it('carry the token in the fragment, where the pages read it', () => {
    const link = new URL(tokenLinkPath(ACCEPT_INVITATION_PATH, 'abc_DEF-123'), 'https://b.test/');
    expect(link.pathname).toBe('/accept-invitation');
    expect(link.search).toBe('');
    expect(tokenOfLink(link.toString())).toBe('abc_DEF-123');
  });
});
