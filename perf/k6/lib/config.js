/*
 * What every script shares: the install's address, the load-test people (credentials file
 * from perf/src/provision.ts) and the seeded dataset (manifest from perf/src/seed.ts), read
 * once into SharedArrays so 200 virtual users do not hold 200 copies.
 *
 *   BASE_URL     the install, e.g. https://bemmoly.example.com (default http://127.0.0.1:8080)
 *   CREDENTIALS  path to the credentials file (default /load/credentials.json)
 *   DATASET      path to the dataset manifest (default /load/dataset.json)
 */
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

export const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
export const API = `${BASE_URL}/api/v1`;
export const COLLAB_URL = `${BASE_URL.replace(/^http/, 'ws')}/collab`;
const ORIGIN = BASE_URL.replace(/^(https?:\/\/[^/]+).*$/, '$1');

const CREDENTIALS = __ENV.CREDENTIALS || '/load/credentials.json';
const DATASET = __ENV.DATASET || '/load/dataset.json';

export const people = new SharedArray('people', () => JSON.parse(open(CREDENTIALS)).users);

const readDataset = () => JSON.parse(open(DATASET));

export const dataset = new SharedArray('dataset', () => {
  const data = readDataset();
  return [
    {
      boardProjectKey: data.boardProjectKey,
      projects: data.projects.map(({ key, id, boardId, typeId, method, issueKeys }) => ({
        key,
        id,
        boardId,
        typeId,
        method,
        issues: issueKeys.length,
      })),
      spaces: data.spaces.map(({ key, id }) => ({ key, id })),
      searchTerms: data.searchTerms,
    },
  ];
})[0];

export const issueKeys = new SharedArray('issueKeys', () =>
  readDataset().projects.flatMap((project) => project.issueKeys),
);

/** Issues outside the board project, for writes that must not grow the 500-issue board. */
export const writableIssueKeys = new SharedArray('writableIssueKeys', () => {
  const data = readDataset();
  return data.projects
    .filter((project) => project.key !== data.boardProjectKey)
    .flatMap((project) => project.issueKeys);
});

export const pageIds = new SharedArray('pageIds', () =>
  readDataset().spaces.flatMap((space) => space.pageIds),
);

export const boardProject = dataset.projects.find((p) => p.key === dataset.boardProjectKey);

export const pickFrom = (items) => items[Math.floor(Math.random() * items.length)];

/**
 * The person making this request. Dealt out per iteration, not per virtual user: an
 * arrival-rate executor reuses whichever VUs are idle, and a few busy VUs on a few people
 * would trip the per-person rate limit (600 a minute) long before the server is loaded.
 */
export function personForIteration() {
  return people[exec.scenario.iterationInTest % people.length];
}

/** The pair of people a collab virtual user drives: two different people per VU. */
export function pairForVu() {
  const base = ((exec.vu.idInTest - 1) * 2) % people.length;
  return [people[base], people[(base + 1) % people.length]];
}

export const authHeaders = (person, extra = {}) => ({
  headers: { authorization: `Bearer ${person.token}`, ...extra.headers },
  tags: extra.tags,
});

/** The cookie and Origin a browser sends on the /collab upgrade. */
export const collabHeaders = (person) => ({
  Cookie: `bemmoly_session=${person.session}`,
  Origin: ORIGIN,
});
