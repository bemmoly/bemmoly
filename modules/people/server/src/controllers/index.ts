import type { PeopleServices } from '../services/index.ts';
import { createDirectoryController } from './directory.controller.ts';
import { createJourneysController } from './journeys.controller.ts';
import { createLeaveController } from './leave.controller.ts';
import { createLevelsController } from './levels.controller.ts';

export function createPeopleControllers(services: PeopleServices) {
  return {
    directory: createDirectoryController(services.directory),
    levels: createLevelsController(services.levels),
    leave: createLeaveController(services.leave),
    journeys: createJourneysController(services.journeys),
  };
}

export type PeopleControllers = ReturnType<typeof createPeopleControllers>;
