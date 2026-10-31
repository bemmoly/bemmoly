import type { PeopleServiceDeps } from './common.ts';
import { createDirectoryService } from './directory/index.ts';
import { createJourneysService } from './journeys/index.ts';
import { createLeaveService } from './leave/index.ts';
import { createLevelsService } from './levels/index.ts';

export type { PeopleServiceDeps } from './common.ts';

/** Every People service, built once at boot. */
export function createPeopleServices(deps: PeopleServiceDeps) {
  return {
    directory: createDirectoryService(deps),
    levels: createLevelsService(deps),
    leave: createLeaveService(deps),
    journeys: createJourneysService(deps),
  };
}

export type PeopleServices = ReturnType<typeof createPeopleServices>;
