/*
 * One function per thing a person does, each one HTTP request tagged with the endpoint it
 * measures. The single-budget scripts call one; the mixed workload and the soak deal them
 * out by weight.
 */
import { check, sleep } from 'k6';
import http from 'k6/http';
import {
  API,
  BASE_URL,
  authHeaders,
  boardProject,
  dataset,
  issueKeys,
  pageIds,
  pickFrom,
  writableIssueKeys,
} from './config.js';

const ok = (response, name) =>
  check(response, { [`${name} answers 2xx`]: (r) => r.status >= 200 && r.status < 300 });

const get = (person, path, endpoint) => {
  const response = http.get(`${API}${path}`, authHeaders(person, { tags: { endpoint } }));
  ok(response, endpoint);
  return response;
};

const send = (person, method, path, body, endpoint) => {
  const response = http.request(
    method,
    `${API}${path}`,
    JSON.stringify(body),
    authHeaders(person, { headers: { 'content-type': 'application/json' }, tags: { endpoint } }),
  );
  ok(response, endpoint);
  return response;
};

/** The board of the 500-issue project, as the board screen loads it. */
export function boardView(person, { verifyCards } = {}) {
  const response = get(person, `/work/boards/${boardProject.boardId}/view`, 'board_view');
  if (verifyCards !== undefined) {
    check(response, {
      [`board shows ${verifyCards} cards`]: (r) => (r.json('cards') || []).length === verifyCards,
    });
  }
  return response;
}

/** Any project's board, tagged so a Scrum sprint board and a Kanban board report apart. */
export const boardOf = (person, project, endpoint) =>
  get(person, `/work/boards/${project.boardId}/view`, endpoint);

export const issueDetail = (person, key = pickFrom(issueKeys)) =>
  get(person, `/work/issues/${key}`, 'issue_detail');

/** What ⌘K asks on each keystroke: Work's key and title suggestions, and every module's search. */
export function paletteKeystroke(person, query) {
  const q = encodeURIComponent(query);
  get(person, `/work/search/suggest?q=${q}&limit=8`, 'search_suggest');
  get(person, `/search?q=${q}`, 'palette_search');
}

/** A term typed into ⌘K one keystroke at a time, from its third letter. */
export function paletteTyping(person, term = pickFrom(dataset.searchTerms), pauseSeconds = 0) {
  for (let length = Math.min(3, term.length); length <= term.length; length += 1) {
    paletteKeystroke(person, term.slice(0, length));
    if (pauseSeconds) sleep(pauseSeconds);
  }
}

export const issueSearch = (person, term = pickFrom(dataset.searchTerms)) =>
  get(person, `/work/search?q=${encodeURIComponent(term)}&limit=20`, 'issue_search');

export const pageDetail = (person, id = pickFrom(pageIds)) =>
  get(person, `/docs/pages/${id}`, 'page_detail');

const PRIORITIES = ['low', 'medium', 'high'];

export const issueUpdate = (person) =>
  send(
    person,
    'PATCH',
    `/work/issues/${pickFrom(writableIssueKeys)}`,
    { priority: pickFrom(PRIORITIES) },
    'issue_update',
  );

export const commentCreate = (person) =>
  send(
    person,
    'POST',
    `/work/issues/${pickFrom(writableIssueKeys)}/comments`,
    {
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Checked on the load run; still reproduces.' }],
          },
        ],
      },
    },
    'comment_create',
  );

/** New issues go to the projects that are not the 500-issue board, so the board stays 500. */
export function issueCreate(person) {
  const project = pickFrom(dataset.projects.filter((p) => p.key !== dataset.boardProjectKey));
  return send(
    person,
    'POST',
    '/work/issues',
    { projectId: project.id, typeId: project.typeId, title: 'Load run: follow-up from the board' },
    'issue_create',
  );
}

/**
 * The network floor: /healthz answers without touching the database, so its latency is the
 * path between k6 and the server (proxies, port forwards) plus almost nothing. Reported next
 * to each budget so a slow path is not read as a slow server.
 */
export function floor() {
  http.get(`${BASE_URL}/healthz`, { tags: { endpoint: 'network_floor' } });
}
