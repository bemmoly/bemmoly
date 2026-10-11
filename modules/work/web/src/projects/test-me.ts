import { http, HttpResponse } from 'msw';
import { IDS } from '../issue/test-support.tsx';

const STAMP = '2026-10-01T10:00:00.000Z';

/** GET /me for tests: Rohan, signed in, holding the given workspace capabilities. */
export function meHandler(capabilities: string[]) {
  return http.get('*/api/v1/me', () =>
    HttpResponse.json({
      user: {
        id: IDS.rohan,
        email: 'rohan@acme.test',
        name: 'Rohan S.',
        avatarKey: null,
        status: 'active',
        isBreakGlass: false,
        roleId: '018f0000-0000-7000-8000-000000000001',
        teamIds: [],
        themePref: null,
        locale: null,
        timezone: null,
        lastSeenAt: null,
        createdAt: STAMP,
      },
      capabilities,
      modules: ['work'],
      workspace: {
        name: 'Acme',
        url: 'http://bemmoly.test',
        aiEnabled: false,
        appearance: {
          theme: 'classic',
          brandColor: '#2456c9',
          font: 'plex',
          logoKey: '',
          mode: 'light',
          surfaces: 'neutral',
          memberModeSwitch: true,
          personalThemes: false,
        },
      },
    }),
  );
}
