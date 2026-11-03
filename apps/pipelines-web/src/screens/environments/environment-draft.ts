import {
  environmentIdSchema,
  type CreateEnvironmentV2Input,
  type EnvironmentV2View,
  type UpdateEnvironmentV2Input,
  type VersionsAllowed,
  type Weekday,
} from '@bemmoly/module-pipelines/shared';
import { slugOf } from '../../lib/slug.ts';

/* The Add and Edit dialogs' form: every optional setting starts off on a new environment. */

export interface EnvironmentDraft {
  name: string;
  /** Null: follow the name until the person types an ID. */
  key: string | null;
  project: string;
  region: string;
  /** A group's id, or empty for anyone whose role deploys. */
  deployerGroup: string;
  window: { days: 'weekdays' | 'every'; from: string; to: string; timeZone: string } | null;
  versionsAllowed: VersionsAllowed;
}

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const EVERY_DAY: Weekday[] = [...WEEKDAYS, 'sat', 'sun'];
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NEW_DRAFT: EnvironmentDraft = {
  name: '',
  key: null,
  project: '',
  region: '',
  deployerGroup: '',
  window: null,
  versionsAllowed: 'any',
};

export function draftOf(environment: EnvironmentV2View): EnvironmentDraft {
  const window = environment.window;
  return {
    name: environment.name,
    key: environment.key,
    project: environment.project?.externalId ?? '',
    region: environment.project?.region ?? '',
    deployerGroup: environment.deployers?.groups[0] ?? '',
    window: window
      ? {
          days: window.days.length === 7 ? 'every' : 'weekdays',
          from: window.from,
          to: window.to,
          timeZone: window.timeZone,
        }
      : null,
    versionsAllowed: environment.versionsAllowed,
  };
}

export const keyOf = (draft: EnvironmentDraft) => draft.key ?? slugOf(draft.name);

export const keyValid = (draft: EnvironmentDraft) =>
  environmentIdSchema.safeParse(keyOf(draft)).success;

export const windowValid = (draft: EnvironmentDraft) =>
  !draft.window || (CLOCK.test(draft.window.from) && CLOCK.test(draft.window.to));

export const draftReady = (draft: EnvironmentDraft) =>
  draft.name.trim() !== '' && keyValid(draft) && windowValid(draft);

function settingsOf(draft: EnvironmentDraft) {
  return {
    project: draft.project
      ? { provider: 'gcp' as const, externalId: draft.project, region: draft.region.trim() || null }
      : null,
    deployers: draft.deployerGroup ? { users: [], groups: [draft.deployerGroup] } : null,
    window: draft.window
      ? {
          days: draft.window.days === 'every' ? EVERY_DAY : WEEKDAYS,
          from: draft.window.from,
          to: draft.window.to,
          timeZone: draft.window.timeZone,
        }
      : null,
    versionsAllowed: draft.versionsAllowed,
  };
}

export function createBodyOf(draft: EnvironmentDraft): CreateEnvironmentV2Input {
  const { project, ...rest } = settingsOf(draft);
  return { name: draft.name.trim(), key: keyOf(draft), ...(project ? { project } : {}), ...rest };
}

/** Everything the form holds; the server keeps what is unchanged as it was. */
export function updateBodyOf(draft: EnvironmentDraft): UpdateEnvironmentV2Input {
  return { name: draft.name.trim(), key: keyOf(draft), ...settingsOf(draft) };
}
