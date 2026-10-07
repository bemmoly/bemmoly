import { describe, expect, it, vi } from 'vitest';
import { logQueueError } from './queue-errors.ts';

const logger = () => ({ warn: vi.fn(), error: vi.fn() });

describe('job queue errors', () => {
  it('logs a disconnect by the database (57P01) as a warning with only message and code', () => {
    const log = logger();
    const error = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
      client: { connectionParameters: { password: 'hunter2' } },
    });
    logQueueError(log, error);
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      {
        err: { message: 'terminating connection due to administrator command', code: '57P01' },
      },
      'job queue connection closed by the database',
    );
  });

  it('logs anything else as an error with the error itself', () => {
    const log = logger();
    const error = Object.assign(new Error('relation "pgboss.job" does not exist'), {
      code: '42P01',
    });
    logQueueError(log, error);
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith({ err: error }, 'job queue error');
  });
});
