import { WORK_REALTIME_KINDS } from '@bemmoly/module-work/shared';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workKeys } from './keys.ts';
import { createGatherer, REALTIME_GATHER_MS } from './use-work-realtime.ts';

/*
 * One burst of events, one invalidation of the reads it touches: a membership change about
 * another project still refreshes the project lists, but not the board this screen shows.
 */

const VIEW = workKeys.boardView('b', {});
const PROJECTS = workKeys.projects();

function setup() {
  vi.useFakeTimers();
  const client = new QueryClient();
  client.setQueryData(VIEW, { cards: [] });
  client.setQueryData(PROJECTS, []);
  const gatherer = createGatherer(client);
  const stale = () => ({
    view: client.getQueryState(VIEW)?.isInvalidated,
    projects: client.getQueryState(PROJECTS)?.isInvalidated,
  });
  return { gatherer, stale };
}

afterEach(() => vi.useRealTimers());

describe('createGatherer', () => {
  it('leaves the board alone for a membership change in another project', () => {
    const { gatherer, stale } = setup();
    gatherer.add(WORK_REALTIME_KINDS.members, false);
    vi.advanceTimersByTime(REALTIME_GATHER_MS);
    expect(stale()).toEqual({ view: false, projects: true });
  });

  it('reads the board again for a membership change in its own project', () => {
    const { gatherer, stale } = setup();
    gatherer.add(WORK_REALTIME_KINDS.members, false);
    gatherer.add(WORK_REALTIME_KINDS.members);
    vi.advanceTimersByTime(REALTIME_GATHER_MS);
    expect(stale()).toEqual({ view: true, projects: true });
  });
});
