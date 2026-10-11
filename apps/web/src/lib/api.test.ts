import type { ApiError } from '@bemmoly/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markSession, reportUnauthenticated, setUnauthenticatedHandler } from './api.ts';

const error = { status: 401, code: 'unauthenticated' } as ApiError;

describe('reportUnauthenticated', () => {
  afterEach(() => {
    markSession(false);
    setUnauthenticatedHandler(null);
  });

  it('ignores a 401 from a visitor who never had a session', () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    reportUnauthenticated(error);
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports a session that ended, once', () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    markSession(true);
    reportUnauthenticated(error);
    reportUnauthenticated(error);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
