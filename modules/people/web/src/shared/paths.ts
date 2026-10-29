/** Where People's screens live in the shell's address space. */
export const peoplePaths = {
  directory: () => '/people',
  profile: (userId: string) => `/people/p/${userId}`,
  org: () => '/people/org',
  timeOff: () => '/people/time-off',
  timeOffTab: (tab: string) => `/people/time-off/${tab}`,
  newTimeOff: () => '/people/time-off/new',
  journeys: () => '/people/journeys',
  journey: (id: string) => `/people/journeys/${id}`,
  settings: (tab = '') => `/settings/people${tab ? `/${tab}` : ''}`,
};
